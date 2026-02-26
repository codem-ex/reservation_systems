/**
 * 📅 LINE Daily Notification Routine for Room Reservations (Enhanced)
 * วางโค้ดนี้ลงใน Google Apps Script (script.google.com)
 * 
 * วิธีตั้งค่า Trigger:
 * 1. ฟังก์ชัน reportToday() -> ตั้งรันทุกวันช่วง 07:00 - 08:00 น.
 * 2. ฟังก์ชัน reportTomorrow() -> ตั้งรันทุกวันช่วง 18:00 - 19:00 น.
 */

// 🛠️ ตั้งค่าข้อมูลการเชื่อมต่อ
const CONFIG = {
    SUPABASE_URL: "YOUR_SUPABASE_URL",
    SUPABASE_KEY: "YOUR_SUPABASE_SERVICE_ROLE_KEY",
    LINE_ACCESS_TOKEN: "YOUR_LINE_CHANNEL_ACCESS_TOKEN",
    LINE_GROUP_ID: "YOUR_LINE_GROUP_ID"
};

/**
 * [Entry Point 1] สำหรับส่งรายงานของวันนี้ (รันช่วงเช้า)
 */
function reportToday() {
    sendRoomReport(0);
}

/**
 * [Entry Point 2] สำหรับส่งรายงานของวันพรุ่งนี้ (รันช่วงเย็น)
 */
function reportTomorrow() {
    sendRoomReport(1);
}

/**
 * ฟังก์ชันหลักในการดึงข้อมูลและส่งรายงาน
 * @param {number} daysOffset - 0 สำหรับวันนี้, 1 สำหรับวันพรุ่งนี้
 */
function sendRoomReport(daysOffset) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const dateStr = Utilities.formatDate(targetDate, "GMT+7", "yyyy-MM-dd");

    const typeText = daysOffset === 0 ? "วันนี้" : "วันพรุ่งนี้";

    // 1. ดึงข้อมูลการจองจาก Supabase
    // ดึงรายการที่ได้รับอนุมัติแล้ว และมีการจองคาบเกี่ยวภายในวันที่กำหนด
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/reservations?select=*,rooms(name),profiles(display_name)&status=eq.APPROVED&or=(start_at.fts.${dateStr},setup_start_at.fts.${dateStr})`;

    const options = {
        method: "GET",
        headers: {
            "apikey": CONFIG.SUPABASE_KEY,
            "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`
        }
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        const reservations = JSON.parse(response.getContentText());

        let header = `📅 รายงานการใช้ห้องประชุม${typeText}\nประจำวันที่: ${Utilities.formatDate(targetDate, "GMT+7", "dd/MM/yyyy")}\n------------------------------`;

        if (reservations.length === 0) {
            sendLineMessage(`${header}\n❌ ไม่มีรายการจองห้องประชุม`);
            return;
        }

        // 2. สร้าง Template ข้อความ
        let message = header;

        reservations.forEach((res, index) => {
            const roomName = res.rooms ? res.rooms.name : "ไม่ระบุห้อง";
            const requester = res.profiles ? res.profiles.display_name : "บุคคลทั่วไป";

            const setupStart = formatTime(res.setup_start_at);
            const setupEnd = formatTime(res.setup_end_at);
            const eventStart = formatTime(res.start_at);
            const eventEnd = formatTime(res.end_at);

            // ส่วนของวันที่ (เช่น 9-13)
            const dateRange = formatDateRange(res.start_at, res.end_at);

            message += `\n\n🏢 ${index + 1}. ${roomName}`;
            message += `\n👤 ผู้จอง: ${requester}`;
            message += `\n📝 หัวข้อ: ${res.title}`;
            message += `\n🗓️ ช่วงวันที่: ${dateRange}`;
            message += `\n🛠️ เตรียม: ${setupStart} - ${setupEnd} น.`;
            message += `\n🎬 จัดงาน: ${eventStart} - ${eventEnd} น.`;
            message += `\n------------------------------`;
        });

        // 3. ส่งเข้า LINE
        sendLineMessage(message);

    } catch (err) {
        console.error("Error:", err);
    }
}

/**
 * รูปแบบวันที่แบบช่วง เช่น "9" หรือ "9-13"
 */
function formatDateRange(isoStart, isoEnd) {
    if (!isoStart || !isoEnd) return "---";
    const start = new Date(isoStart);
    const end = new Date(isoEnd);

    const dStart = start.getDate();
    const dEnd = end.getDate();
    const mStart = start.getMonth();
    const mEnd = end.getMonth();

    // ถ้าเป็นวันเดียวกัน
    if (dStart === dEnd && mStart === mEnd) {
        return `${dStart}`;
    }

    // ถ้าคนละเดือน
    if (mStart !== mEnd) {
        return `${dStart}/${mStart + 1} - ${dEnd}/${mEnd + 1}`;
    }

    // ถ้าเดือนเดียวกันแต่คนละวัน
    return `${dStart}-${dEnd}`;
}

function formatTime(isoString) {
    if (!isoString) return "--:--";
    const date = new Date(isoString);
    return Utilities.formatDate(date, "GMT+7", "HH:mm");
}

function sendLineMessage(message) {
    const url = "https://api.line.me/v2/bot/message/push";
    const payload = {
        to: CONFIG.LINE_GROUP_ID,
        messages: [{ type: "text", text: message }]
    };

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.LINE_ACCESS_TOKEN}`
        },
        payload: JSON.stringify(payload)
    };

    UrlFetchApp.fetch(url, options);
}
