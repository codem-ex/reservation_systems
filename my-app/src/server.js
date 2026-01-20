import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors({ origin: true }));

// ✅ ต้องอยู่ก่อน routes ทุกตัว
app.use(express.json({ limit: "10mb" }));

/**
 * REQUIRED ENV
 * --------------------------------
 * PORT=4000
 * SUPABASE_URL=...
 * SUPABASE_SERVICE_ROLE_KEY=...  (backend only)
 *
 * (recommended for user-context queries on views that use auth.uid()):
 * SUPABASE_ANON_KEY=...
 *
 * (optional)
 * RESEND_API_KEY=...
 * MAIL_FROM="Meeting Rooms <no-reply@yourdomain.com>"
 *
 * (optional for gcal later)
 * GOOGLE_SERVICE_ACCOUNT_JSON=...
 * GOOGLE_CALENDAR_ID=...
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// ✅ เพิ่ม: ใช้สำหรับ query แบบ user-context (แก้ปัญหา view ที่ใช้ auth.uid())
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

// ============================
// Request log (ช่วยไล่ 401/404/500)
// ============================
app.use((req, res, next) => {
    const id = Math.random().toString(36).slice(2, 8);
    req._reqId = id;

    const auth = req.headers.authorization || "";
    const hasBearer = auth.toLowerCase().startsWith("bearer ");
    const tokenLen = hasBearer ? auth.slice(7).trim().length : 0;

    console.log(
        `[REQ ${id}] ${req.method} ${req.originalUrl} host=${req.headers.host} auth=${hasBearer ? `Bearer(${tokenLen})` : "no"
        }`
    );

    res.on("finish", () => console.log(`[RES ${id}] -> ${res.statusCode}`));
    next();
});

function getBearerToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader) return null;
    if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
    if (authHeader.toLowerCase().startsWith("bearer ")) return authHeader.slice(7).trim();
    return null;
}

async function requireUser(req) {
    const token = getBearerToken(req);
    if (!token) return { ok: false, status: 401, message: "Unauthorized (no token)" };

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { ok: false, status: 401, message: "Unauthorized (invalid token)" };

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

// ✅ เพิ่ม: สร้าง client แบบ user-context เพื่อให้ auth.uid() ใน VIEW ทำงาน
function createSupabaseUserClient(accessToken) {
    if (!SUPABASE_ANON_KEY) {
        throw new Error("Missing SUPABASE_ANON_KEY in env (required for user-context queries on views)");
    }
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
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
    const fromProfile = profileRow?.first_name
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
// ✅ APPROVER TASKS (เพิ่มให้ครบตามที่ frontend เรียก)
// GET /api/approver/tasks
// - ใช้ view v_approver_tasks ที่มี WHERE ra.approver_id = auth.uid()
// - ดังนั้นต้อง query ด้วย "user-context" (anon key + Authorization Bearer token)
// ============================
app.get("/api/approver/tasks", async (req, res) => {
    try {
        const token = getBearerToken(req);
        const u = await requireUser(req);
        if (!u.ok) return res.status(u.status).json({ ok: false, message: u.message });

        // ✅ สำคัญ: query view ด้วย user-context เพื่อให้ auth.uid() ใน view ทำงาน
        const supabaseUser = createSupabaseUserClient(token);

        const { data, error } = await supabaseUser
            .from("v_approver_tasks")
            .select(
                [
                    "approval_id",
                    "reservation_id",
                    "stage_no",
                    "status",
                    "acted_at",
                    "note",
                    "room_name",
                    "reserv_start",
                    "reserv_end",
                    "reserv_purp",
                    "reserv_by_name",
                    "acted_by_name",
                    "approver_name",
                    "approver_pos",
                ].join(",")
            )
            .order("reserv_start", { ascending: true });

        if (error) return res.status(400).json({ ok: false, message: error.message });
        return res.json({ ok: true, tasks: data || [] });
    } catch (err) {
        console.error(`[ERR ${req._reqId}] /api/approver/tasks`, err);
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

// ============================
// ✅ RESERVATION: CREATE
// POST /api/reservations/create
// body: { room_id, reserv_start, reserv_end OR reserv_end_inclusive, reserv_purp }
// รองรับสำรอง: roomId/reservStart/reservEnd/reservPurp (camelCase) และ reserv_end_inclusive
// ============================
app.post("/api/reservations/create", async (req, res) => {
    try {
        const u = await requireUser(req);
        if (!u.ok) return res.status(u.status).json({ ok: false, message: u.message });

        const user = u.user;
        const body = req.body || {};

        const room_id = body.room_id ?? body.roomId ?? null;
        const reserv_start = body.reserv_start ?? body.reservStart ?? null;

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

        const { data: room, error: roomErr } = await supabaseAdmin
            .from("meeting_rooms")
            .select("room_id, room_name")
            .eq("room_id", room_id)
            .single();

        if (roomErr || !room) {
            return res.status(400).json({ ok: false, message: "Room not found (invalid room_id)" });
        }

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

        return res.json({ ok: true, reservation: inserted });
    } catch (err) {
        console.error(`[ERR ${req._reqId}] /api/reservations/create`, err);
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

// ============================
// ADMIN: USERS
// ============================
app.get("/api/admin/users", async (req, res) => {
    try {
        const auth = await requireAdmin(req);
        if (!auth.ok) return res.status(auth.status).json({ ok: false, message: auth.message });

        const perPage = 200;
        let page = 1;
        let all = [];

        while (true) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
            if (error) return res.status(500).json({ ok: false, message: error.message });

            const batch = data?.users || [];
            all = all.concat(batch);

            if (batch.length < perPage) break;
            page += 1;
            if (page > 50) break;
        }

        const ids = all.map((u) => u.id);

        const { data: profRows, error: pErr } = await supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", ids);

        if (pErr) return res.status(500).json({ ok: false, message: pErr.message });

        const profMap = new Map();
        (profRows || []).forEach((p) => profMap.set(p.id, p));

        const users = all.map((u) => {
            const p = profMap.get(u.id);
            const first_name = p?.first_name || "";
            const last_name = p?.last_name || "";
            const full_from_profile = `${first_name}${last_name ? ` ${last_name}` : ""}`.trim();
            const full_from_meta = u.user_metadata?.full_name || "";
            const display_name = full_from_profile || full_from_meta || u.email || u.id;

            return {
                id: u.id,
                email: u.email || null,
                first_name: first_name || null,
                last_name: last_name || null,
                display_name,
                created_at: u.created_at || null,
            };
        });

        return res.json({ ok: true, users });
    } catch (err) {
        console.error(`[ERR ${req._reqId}] /api/admin/users`, err);
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

// ============================
// ADMIN: APPROVERS
// ============================
app.get("/api/admin/approvers", async (req, res) => {
    try {
        const auth = await requireAdmin(req);
        if (!auth.ok) return res.status(auth.status).json({ ok: false, message: auth.message });

        const { data, error } = await supabaseAdmin
            .from("approver_info")
            .select("user_id, approv_name, approv_pos")
            .order("approv_name", { ascending: true });

        if (error) return res.status(400).json({ ok: false, message: error.message });
        return res.json({ ok: true, approvers: data || [] });
    } catch (err) {
        console.error(`[ERR ${req._reqId}] /api/admin/approvers`, err);
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

app.post("/api/admin/approvers/upsert", async (req, res) => {
    try {
        const auth = await requireAdmin(req);
        if (!auth.ok) return res.status(auth.status).json({ ok: false, message: auth.message });

        const { user_id, approv_name, approv_pos } = req.body || {};
        if (!user_id) return res.status(400).json({ ok: false, message: "Missing user_id" });
        if (!approv_pos || !String(approv_pos).trim()) {
            return res.status(400).json({ ok: false, message: "Missing approv_pos" });
        }

        const { data: prof, error: profErr } = await supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name")
            .eq("id", user_id)
            .single();

        if (profErr || !prof) {
            return res.status(400).json({
                ok: false,
                message: "User has no profile row in public.profiles (FK requires profiles.id).",
            });
        }

        const fallbackName = `${prof.first_name || ""}${prof.last_name ? ` ${prof.last_name}` : ""}`.trim();
        const nameToSave = String(approv_name || "").trim() || fallbackName || "(ไม่พบชื่อ)";

        const { error } = await supabaseAdmin
            .from("approver_info")
            .upsert(
                { user_id, approv_name: nameToSave, approv_pos: String(approv_pos).trim() },
                { onConflict: "user_id" }
            );

        if (error) return res.status(400).json({ ok: false, message: error.message });
        return res.json({ ok: true });
    } catch (err) {
        console.error(`[ERR ${req._reqId}] /api/admin/approvers/upsert`, err);
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

app.delete("/api/admin/approvers/:userId", async (req, res) => {
    try {
        const auth = await requireAdmin(req);
        if (!auth.ok) return res.status(auth.status).json({ ok: false, message: auth.message });

        const userId = req.params.userId;
        const { error } = await supabaseAdmin.from("approver_info").delete().eq("user_id", userId);
        if (error) return res.status(400).json({ ok: false, message: error.message });

        return res.json({ ok: true });
    } catch (err) {
        console.error(`[ERR ${req._reqId}] /api/admin/approvers/:userId`, err);
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

// ============================
// APPROVAL ACTION
// (คงเส้นเดิมไว้ ไม่ลบทิ้ง)
// ============================
app.post("/api/approvals/act", async (req, res) => {
    try {
        const u = await requireUser(req);
        if (!u.ok) return res.status(u.status).json({ ok: false, message: u.message });

        const approverUser = u.user;
        const { approval_id, action, note } = req.body || {};

        if (!approval_id) return res.status(400).json({ ok: false, message: "Missing approval_id" });
        if (!["APPROVED", "REJECTED"].includes(String(action || "").toUpperCase())) {
            return res.status(400).json({ ok: false, message: "Invalid action (must be APPROVED or REJECTED)" });
        }
        const act = String(action || "").toUpperCase();
        if (act === "REJECTED" && (!note || !String(note).trim())) {
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

        if (Number(approvalRow.stage_no) === 2) {
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
            status: act,
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

        // (คง logic email เดิมไว้)
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
                        act === "APPROVED"
                            ? `ผลการอนุมัติการจองห้องประชุม: อนุมัติ (Stage ${approvalRow.stage_no})`
                            : `ผลการอนุมัติการจองห้องประชุม: ไม่อนุมัติ (Stage ${approvalRow.stage_no})`;

                    const reasonLine =
                        act === "REJECTED"
                            ? `เหตุผล: ${payload.note || "-"}`
                            : payload.note
                                ? `หมายเหตุ: ${payload.note}`
                                : "";

                    const text = [
                        `ใบจอง: ${rRow.reserv_id}`,
                        `ห้อง: ${roomRow?.room_name || rRow.room_id}`,
                        `ช่วงวัน: ${rRow.reserv_start} ถึง ${rRow.reserv_end}`,
                        `เหตุผลการจอง: ${rRow.reserv_purp || "-"}`,
                        `ผู้อนุมัติ: ${approverName}`,
                        `ผลการพิจารณา: ${act}`,
                        reasonLine,
                    ]
                        .filter(Boolean)
                        .join("\n");

                    await sendEmailResend({ to: requesterEmail, subject, text });
                    emailed = true;
                }
            }
        } catch {
            // ignore
        }

        return res.json({ ok: true, approval: updated, emailed });
    } catch (err) {
        console.error(`[ERR ${req._reqId}] /api/approvals/act`, err);
        return res.status(500).json({ ok: false, message: err?.message || String(err) });
    }
});

// ============================
// SERVE REACT BUILD (โดเมนเดียว)
// ============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRA: build / Vite: dist (ปรับตามของคุณ)
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
