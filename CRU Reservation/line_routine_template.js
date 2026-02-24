/**
 * 📅 LINE Daily Notification Routine for Room Reservations
 * วางโค้ดนี้ลงใน Google Apps Script (script.google.com)
 * และตั้งค่า Trigger แบบ "Time-driven" ให้รันทุกวันเวลา 08:00 - 09:00 น.
 */

// 🛠️ ตั้งค่าข้อมูลการเชื่อมต่อ
const CONFIG = {
    SUPABASE_URL: "YOUR_SUPABASE_URL",
    SUPABASE_KEY: "YOUR_SUPABASE_SERVICE_ROLE_KEY", // ต้องใช้ Service Role เพื่อดึงข้อมูลข้ามตารางได้
    LINE_ACCESS_TOKEN: "YOUR_LINE_CHANNEL_ACCESS_TOKEN",
    LINE_GROUP_ID: "YOUR_LINE_GROUP_ID" // หรือ User ID
};

function sendDailyRoomReport() {
    const today = new Date();
    const dateStr = Utilities.formatDate(today, "GMT+7", "yyyy-MM-dd");

    // 1. ดึงข้อมูลการจองจาก Supabase
    // ดึงรายการที่ได้รับอนุมัติแล้ว และมีการจองคาบเกี่ยวภายในวันนี้
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

        if (reservations.length === 0) {
            // สามารถเลือกที่จะไม่ส่งข้อความถ้าไม่มีการจอง
            // return; 
            sendLineMessage("📅 รายงานการใช้ห้องประชุมวันนี้\n------------------------------\n❌ วันนี้ไม่มีการจองห้องประชุม");
            return;
        }

        // 2. สร้าง Template ข้อความ
        let message = `📅 รายงานการใช้ห้องประชุมวันนี้\nวันที่: ${Utilities.formatDate(today, "GMT+7", "dd/MM/yyyy")}\n------------------------------`;

        reservations.forEach((res, index) => {
            const roomName = res.rooms ? res.rooms.name : "ไม่ระบุห้อง";
            const requester = res.profiles ? res.profiles.display_name : "บุคคลทั่วไป";

            const setupStart = formatTime(res.setup_start_at);
            const setupEnd = formatTime(res.setup_end_at);
            const eventStart = formatTime(res.start_at);
            const eventEnd = formatTime(res.end_at);

            message += `\n\n🏢 ${index + 1}. ${roomName}`;
            message += `\n👤 ผู้จอง: ${requester}`;
            message += `\n📝 หัวข้อ: ${res.title}`;
            message += `\n🛠️ ช่วงเตรียม: ${setupStart} - ${setupEnd} น.`;
            message += `\n🎬 ช่วงจัดงาน: ${eventStart} - ${eventEnd} น.`;
            message += `\n------------------------------`;
        });

        // 3. ส่งเข้า LINE
        sendLineMessage(message);

    } catch (err) {
        console.error("Error:", err);
    }
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
