import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

/**
 * ENV:
 * PORT=4000
 * SUPABASE_URL=
 * SUPABASE_SERVICE_ROLE_KEY=
 * GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=
 * GCAL_CALENDAR_ID=
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

function getGoogleAuth() {
    const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
    if (!b64) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 in env");

    const jsonStr = Buffer.from(b64, "base64").toString("utf8");
    const creds = JSON.parse(jsonStr);

    const scopes = ["https://www.googleapis.com/auth/calendar"];

    return new google.auth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes,
    });
}

function isISODate(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDaysISO(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00`);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

function getGoogleErrorDetails(err) {
    // googleapis มักมี err.response.data
    const status = err?.response?.status || err?.code || 500;
    const data = err?.response?.data || null;
    const message =
        data?.error?.message ||
        data?.error_description ||
        err?.message ||
        String(err);

    return { status, message, data };
}

app.get("/health", (req, res) => {
    res.json({ ok: true, message: "backend alive" });
});

app.post("/api/reservations/create", async (req, res) => {
    let insertedReservationId = null;

    try {
        const calendarId = process.env.GCAL_CALENDAR_ID;
        if (!calendarId) throw new Error("Missing GCAL_CALENDAR_ID in env");

        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ ok: false, message: "Missing access token" });

        // 1) verify user from token
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
            return res.status(401).json({ ok: false, message: "Invalid token" });
        }
        const user = userData.user;

        const { room_id, reserv_start, reserv_end_inclusive, reserv_purp } = req.body || {};

        if (!room_id) return res.status(400).json({ ok: false, message: "Missing room_id" });
        if (!isISODate(reserv_start) || !isISODate(reserv_end_inclusive)) {
            return res.status(400).json({ ok: false, message: "Invalid reserv_start/reserv_end_inclusive (YYYY-MM-DD)" });
        }
        if (!reserv_purp || !String(reserv_purp).trim()) {
            return res.status(400).json({ ok: false, message: "Missing reserv_purp" });
        }

        const reserv_end_exclusive = addDaysISO(reserv_end_inclusive, 1);

        // 2) room exists?
        const { data: roomRow, error: roomErr } = await supabaseAdmin
            .from("meeting_rooms")
            .select("room_name")
            .eq("room_id", room_id)
            .single();

        if (roomErr || !roomRow) {
            return res.status(400).json({ ok: false, message: "Invalid room_id (room not found)" });
        }

        // 3) display name
        const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();

        const profileName =
            prof?.first_name ? `${prof.first_name}${prof?.last_name ? ` ${prof.last_name}` : ""}` : "";
        const metaName = user.user_metadata?.full_name || "";
        const bookedByName = profileName || metaName || user.email || user.id;

        // 4) insert DB
        const reserv_id = (globalThis.crypto?.randomUUID?.() || null);

        const insertPayload = {
            room_id,
            reserv_start,
            reserv_end: reserv_end_exclusive,
            reserv_purp: String(reserv_purp).trim(),
            who_reserv_id: user.id,
            reserv_id, // ถ้าตารางคุณไม่มีคอลัมน์นี้ ให้ลบบรรทัดนี้ออก
        };

        const { data: inserted, error: insErr } = await supabaseAdmin
            .from("reservation_info")
            .insert(insertPayload)
            .select("*")
            .single();

        if (insErr) {
            return res.status(400).json({ ok: false, message: `DB insert failed: ${insErr.message}` });
        }

        insertedReservationId = inserted?.reserv_id || null;

        // 5) create Google Calendar event
        const gAuth = getGoogleAuth();
        const calendar = google.calendar({ version: "v3", auth: gAuth });

        const summary = `จองห้องประชุม: ${roomRow.room_name}`;
        const description = [`ผู้จอง: ${bookedByName}`, `เหตุผล: ${String(reserv_purp).trim()}`].join("\n");

        const event = {
            summary,
            description,
            start: { date: reserv_start },
            end: { date: reserv_end_exclusive },
        };

        try {
            const gResp = await calendar.events.insert({ calendarId, requestBody: event });

            return res.json({
                ok: true,
                reservation: inserted,
                googleEventId: gResp.data.id,
                htmlLink: gResp.data.htmlLink,
            });
        } catch (gErr) {
            const g = getGoogleErrorDetails(gErr);

            // rollback DB
            if (insertedReservationId) {
                await supabaseAdmin.from("reservation_info").delete().eq("reserv_id", insertedReservationId);
            }

            return res.status(g.status || 500).json({
                ok: false,
                message: `Google Calendar error: ${g.message}`,
                google: g.data,
                hint:
                    "ถ้าเป็น Not Found ให้เช็ก GCAL_CALENDAR_ID ว่าถูกต้อง และ calendar ถูก share ให้ service account แล้วหรือยัง",
            });
        }
    } catch (err) {
        // rollback (กรณีอื่น ๆ)
        try {
            if (insertedReservationId) {
                await supabaseAdmin.from("reservation_info").delete().eq("reserv_id", insertedReservationId);
            }
        } catch { }

        return res.status(500).json({
            ok: false,
            message: err?.message || String(err),
        });
    }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
