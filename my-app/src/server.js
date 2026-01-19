import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

/**
 * REQUIRED ENV
 * --------------------------------
 * PORT=4000
 * SUPABASE_URL=...
 * SUPABASE_SERVICE_ROLE_KEY=...  (backend only)
 *
 * (optional)
 * RESEND_API_KEY=...
 * MAIL_FROM="Meeting Rooms <no-reply@yourdomain.com>"
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

function getBearerToken(req) {
    const authHeader = req.headers.authorization || "";
    return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

async function requireUser(req) {
    const token = getBearerToken(req);
    if (!token) return { ok: false, status: 401, message: "Missing access token" };

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { ok: false, status: 401, message: "Invalid token" };

    return { ok: true, user: data.user };
}

async function requireAdmin(req) {
    const u = await requireUser(req);
    if (!u.ok) return u;

    const { data: ui, error: uiErr } = await supabaseAdmin
        .from("user_info")
        .select("is_admin")
        .eq("id", u.user.id)
        .single();

    if (uiErr) {
        return { ok: false, status: 500, message: `Cannot check admin role: ${uiErr.message}` };
    }
    if (!ui?.is_admin) {
        return { ok: false, status: 403, message: "Forbidden (admin only)" };
    }
    return { ok: true, user: u.user };
}

async function sendEmailResend({ to, subject, text }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;

    if (!apiKey || !from) throw new Error("Missing RESEND_API_KEY or MAIL_FROM in env");

    const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to, subject, text }),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        const msg =
            data?.message || data?.error || (data ? JSON.stringify(data) : null) || resp.statusText;
        throw new Error(`Resend error: ${msg}`);
    }
    return data;
}

function buildDisplayName({ profileRow, authUser }) {
    const fromProfile =
        profileRow?.first_name
            ? `${profileRow.first_name}${profileRow?.last_name ? ` ${profileRow.last_name}` : ""}`
            : "";
    const fromMeta = authUser?.user_metadata?.full_name || "";
    const fromEmail = authUser?.email || "";
    return fromProfile || fromMeta || fromEmail || authUser?.id || "";
}

// ============================
// HEALTH
// ============================
app.get("/api/health", (req, res) => {
    res.json({ ok: true, message: "backend alive" });
});

// ============================
// ✅ RESERVATION: CREATE (WITH AUTO-APPROVAL STAGES)
// POST /api/reservations/create
// body: { room_id, reserv_start, reserv_end OR reserv_end_inclusive, reserv_purp }
// ============================
app.post("/api/reservations/create", async (req, res) => {
    try {
        const u = await requireUser(req);
        if (!u.ok) return res.status(u.status).json({ ok: false, message: u.message });

        const user = u.user;
        const body = req.body || {};

        // รองรับ snake_case / camelCase
        const room_id = body.room_id ?? body.roomId ?? null;
        const reserv_start = body.reserv_start ?? body.reservStart ?? null;

        // ✅ รองรับ reserv_end และ reserv_end_inclusive
        const reserv_end =
            body.reserv_end ??
            body.reservEnd ??
            body.reserv_end_inclusive ??
            body.reservEndInclusive ??
            null;

        const reserv_purp = body.reserv_purp ?? body.reservPurp ?? null;

        if (!room_id || !reserv_start || !reserv_end || !reserv_purp) {
            return res.status(400).json({
                ok: false,
                message: "Missing required fields (need room_id, reserv_start, reserv_end, reserv_purp)",
                received_keys: Object.keys(body || {}),
                received_body: body,
            });
        }

        // 1) ตรวจว่าห้องมีจริง (meeting_rooms ใช้ room_id)
        const { data: room, error: roomErr } = await supabaseAdmin
            .from("meeting_rooms")
            .select("room_id, room_name")
            .eq("room_id", room_id)
            .single();

        if (roomErr || !room) {
            return res.status(400).json({ ok: false, message: "Room not found (invalid room_id)" });
        }

        // 2) Insert ใบจอง
        const insertPayload = {
            room_id,
            reserv_start,
            reserv_end,
            reserv_purp: String(reserv_purp).trim(),
            who_reserv_id: user.id,
        };

        const { data: inserted, error: insErr } = await supabaseAdmin
            .from("reservation_info")
            .insert(insertPayload)
            .select("reserv_id, room_id, reserv_start, reserv_end, reserv_purp, who_reserv_id")
            .single();

        if (insErr) return res.status(400).json({ ok: false, message: insErr.message });

        const reservId = inserted.reserv_id;

        // 3) ✅ สร้าง Stage approvals อัตโนมัติจาก approver_chain (ต้องมี 2 ขั้น)
        // รองรับทั้ง is_active และ active (เพราะ schema ของคุณเป็น is_active)
        const chainSelect = await supabaseAdmin
            .from("approver_chain")
            .select("stage_no, approver_id, is_active, active")
            .order("stage_no", { ascending: true });

        if (chainSelect.error) {
            return res.status(400).json({ ok: false, message: `Load approver_chain failed: ${chainSelect.error.message}` });
        }

        const chainRowsAll = chainSelect.data || [];

        // filter active
        const chainRows = chainRowsAll
            .filter((r) => (r.is_active === true) || (r.active === true))
            .filter((r) => r.stage_no === 1 || r.stage_no === 2)
            .sort((a, b) => (a.stage_no ?? 0) - (b.stage_no ?? 0));

        if (chainRows.length < 2) {
            return res.status(400).json({
                ok: false,
                message: "ระบบยังไม่มี Stage ครบ 2 ขั้น (ตรวจว่า approver_chain ตั้ง active ไว้ครบหรือยัง)",
                chain_active_rows: chainRows,
            });
        }

        // ต้องมี stage 1 และ 2 จริง
        const has1 = chainRows.some((r) => r.stage_no === 1 && r.approver_id);
        const has2 = chainRows.some((r) => r.stage_no === 2 && r.approver_id);
        if (!has1 || !has2) {
            return res.status(400).json({
                ok: false,
                message: "approver_chain ต้องมี approver_id ครบทั้ง stage 1 และ stage 2",
                chain_active_rows: chainRows,
            });
        }

        const approvalsPayload = chainRows.map((c) => ({
            reservation_id: reservId,
            stage_no: c.stage_no,
            approver_id: c.approver_id,
            status: "PENDING",
        }));

        const { error: apprErr } = await supabaseAdmin
            .from("reservation_approvals")
            .insert(approvalsPayload);

        if (apprErr) {
            return res.status(400).json({
                ok: false,
                message: `Create approvals failed: ${apprErr.message}`,
                approvalsPayload,
            });
        }

        return res.json({
            ok: true,
            reservation: inserted,
            approvals_created: approvalsPayload.length,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

// ============================
// APPROVAL ACTION
// ============================
app.post("/api/approvals/act", async (req, res) => {
    try {
        const u = await requireUser(req);
        if (!u.ok) return res.status(u.status).json({ ok: false, message: u.message });

        const approverUser = u.user;
        const { approval_id, action, note } = req.body || {};

        if (!approval_id) return res.status(400).json({ ok: false, message: "Missing approval_id" });
        if (!["APPROVED", "REJECTED"].includes(action)) {
            return res.status(400).json({ ok: false, message: "Invalid action (must be APPROVED or REJECTED)" });
        }
        if (action === "REJECTED" && (!note || !String(note).trim())) {
            return res.status(400).json({ ok: false, message: "Reject requires a reason (note)" });
        }

        const { data: approvalRow, error: aErr } = await supabaseAdmin
            .from("reservation_approvals")
            .select("approval_id, reservation_id, stage_no, status, approver_id")
            .eq("approval_id", approval_id)
            .single();

        if (aErr || !approvalRow) return res.status(404).json({ ok: false, message: "Approval not found" });
        if (approvalRow.approver_id !== approverUser.id) {
            return res.status(403).json({ ok: false, message: "Not your approval task" });
        }
        if (approvalRow.status !== "PENDING") {
            return res.status(400).json({ ok: false, message: "This task is already finalized" });
        }

        if (approvalRow.stage_no === 2) {
            const { data: st1, error: st1Err } = await supabaseAdmin
                .from("reservation_approvals")
                .select("status")
                .eq("reservation_id", approvalRow.reservation_id)
                .eq("stage_no", 1)
                .single();

            if (st1Err || !st1) return res.status(400).json({ ok: false, message: "Stage 1 record not found" });
            if (st1.status !== "APPROVED") {
                return res.status(400).json({ ok: false, message: "Stage 1 must be approved before Stage 2" });
            }
        }

        const { data: approverProfile } = await supabaseAdmin
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", approverUser.id)
            .single();

        const approverName = buildDisplayName({ profileRow: approverProfile, authUser: approverUser });

        const payload = {
            status: action,
            acted_at: new Date().toISOString(),
            note: note ? String(note).trim() : null,
            acted_by_id: approverUser.id,
            acted_by_name: approverName,
        };

        const { data: updated, error: uErr } = await supabaseAdmin
            .from("reservation_approvals")
            .update(payload)
            .eq("approval_id", approval_id)
            .select("approval_id, reservation_id, stage_no, status, acted_at, note, acted_by_id, acted_by_name")
            .single();

        if (uErr) return res.status(400).json({ ok: false, message: uErr.message });

        // Email notify (optional)
        let emailed = false;
        try {
            const { data: rRow } = await supabaseAdmin
                .from("reservation_info")
                .select("reserv_id, reserv_start, reserv_end, reserv_purp, who_reserv_id, room_id")
                .eq("reserv_id", approvalRow.reservation_id)
                .single();

            if (rRow) {
                const { data: reqUserData } = await supabaseAdmin.auth.admin.getUserById(rRow.who_reserv_id);
                const requesterEmail = reqUserData?.user?.email || null;

                const { data: roomRow } = await supabaseAdmin
                    .from("meeting_rooms")
                    .select("room_name")
                    .eq("room_id", rRow.room_id)
                    .single();

                if (requesterEmail && process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
                    const subject =
                        action === "APPROVED"
                            ? `ผลการอนุมัติการจองห้องประชุม: อนุมัติ (Stage ${approvalRow.stage_no})`
                            : `ผลการอนุมัติการจองห้องประชุม: ไม่อนุมัติ (Stage ${approvalRow.stage_no})`;

                    const reasonLine =
                        action === "REJECTED"
                            ? `เหตุผล: ${payload.note || "-"}`
                            : (payload.note ? `หมายเหตุ: ${payload.note}` : "");

                    const text = [
                        `ใบจอง: ${rRow.reserv_id}`,
                        `ห้อง: ${roomRow?.room_name || rRow.room_id}`,
                        `ช่วงวัน: ${rRow.reserv_start} ถึง ${rRow.reserv_end}`,
                        `เหตุผลการจอง: ${rRow.reserv_purp || "-"}`,
                        `ผู้อนุมัติ: ${approverName}`,
                        `ผลการพิจารณา: ${action}`,
                        reasonLine,
                    ].filter(Boolean).join("\n");

                    await sendEmailResend({ to: requesterEmail, subject, text });
                    emailed = true;
                }
            }
        } catch {
            // ignore
        }

        return res.json({ ok: true, approval: updated, emailed });
    } catch (err) {
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

// ============================
// SERVE REACT BUILD (โดเมนเดียว)
// ============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRA build folder
const reactBuildDir = path.join(__dirname, "..", "build");

app.use(express.static(reactBuildDir));

// catch-all เฉพาะ non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(reactBuildDir, "index.html"));
});

// ============================
// START
// ============================
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
