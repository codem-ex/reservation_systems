/**
 * 📅 LINE Daily Notification & Google Calendar Bridge (Fixed)
 * วางโค้ดนี้ลงใน Google Apps Script (script.google.com)
 */

// 🛠️ ตั้งค่าข้อมูลการเชื่อมต่อ
const CONFIG = {
    SUPABASE_URL: "https://jjhiqevrbmqynjbswsil.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaGlxZXZyYm1xeW5qYnN3c2lsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcwNTAxMiwiZXhwIjoyMDg2MjgxMDEyfQ.hsUEiAvrF_95ZNa9aS9LYdIeokQcEZkS2VLLkNr7TbQ",
    LINE_ACCESS_TOKEN: "g24DwgZ7X6zn0oo5NjSMcc6ahHqIR96tvZTwEhtq5Ay3/sVvuuv6Mg8mkvtgyj8EAEr606OUPmXQuZY/1nMFrG8bgVl81GTcotI0eXCZdK+WfsN/EWFvYCizrUADeKWfs/IuvtuR9OpJV7KPYeAFEgdB04t89/1O/w1cDnyilFU=",
    LINE_GROUP_ID: "C231acbd16f04639d0d1cb9565b5782a9",
    CALENDAR_ID: "YOUR_GOOGLE_CALENDAR_ID" // อย่าลืมใส่ ID ปฏิทินที่นี่ด้วยครับ
};

/**
 * 🌐 ส่วนที่ 1: Google Calendar Bridge (สำหรับ Sync จากหน้าเว็บ)
 */
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const calendarId = data.calendarId || CONFIG.CALENDAR_ID;
        const calendar = CalendarApp.getCalendarById(calendarId);

        if (!calendar) throw new Error("ไม่พบปฏิทิน: " + calendarId);

        const event = calendar.createEvent(
            data.summary,
            new Date(data.start),
            new Date(data.end),
            {
                location: data.location || "",
                description: data.description || ""
            }
        );

        return ContentService.createTextOutput(JSON.stringify({ status: "success", eventId: event.getId() }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * 📤 ส่วนที่ 2: LINE Notification Routine (รายงานเช้า/เย็น)
 */

// [Trigger] สำหรับส่งรายงานของวันนี้ (รันช่วงเช้า 08:00)
function reportToday() {
    sendRoomReport(0);
}

// [Trigger] สำหรับส่งรายงานของวันพรุ่งนี้ (รันช่วงเย็น 18:00)
function reportTomorrow() {
    sendRoomReport(1);
}

function sendRoomReport(daysOffset) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const dateStr = Utilities.formatDate(targetDate, "GMT+7", "yyyy-MM-dd");

    // วันถัดไปสำหรับทำช่วงข้อมูล (LT)
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);
    const nextDateStr = Utilities.formatDate(nextDate, "GMT+7", "yyyy-MM-dd");

    const typeText = daysOffset === 0 ? "วันนี้" : "วันพรุ่งนี้";

    // ✅ แก้ไขตัวกรองจาก .fts เป็นการเช็คช่วงเวลา (Prevents Error 42883)
    // ดึงงานที่ (เริ่มก่อนวันถัดไป) และ (จบตั้งแต่วันนี้เป็นต้นไป) = งานที่มีผลในวันนั้นๆ
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/reservations?select=*,rooms(name),profiles(display_name)&status=eq.APPROVED&start_at.lt.${nextDateStr}&end_at.gte.${dateStr}`;

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

        let header = `📅 รายงานใช้ห้องประชุม${typeText}\nประจำวันที่: ${Utilities.formatDate(targetDate, "GMT+7", "dd/MM/yyyy")}\n------------------------------`;

        if (reservations.length === 0) {
            sendLineMessage(`${header}\n❌ ไม่มีรายการจอง`);
            return;
        }

        let message = header;
        reservations.forEach((res, index) => {
            const roomName = res.rooms ? res.rooms.name : "ไม่ระบุห้อง";
            const requester = res.profiles ? res.profiles.display_name : "บุคคลทั่วไป";
            const setupStart = formatTime(res.setup_start_at);
            const setupEnd = formatTime(res.setup_end_at);
            const eventStart = formatTime(res.start_at);
            const eventEnd = formatTime(res.end_at);
            const dateRange = formatDateRange(res.start_at, res.end_at);

            message += `\n\n🏢 ${index + 1}. ${roomName}`;
            message += `\n👤 ผู้จอง: ${requester}`;
            message += `\n📝 หัวข้อ: ${res.title}`;
            message += `\n�️ ช่วงวันที่: ${dateRange}`;
            message += `\n🛠️ เตรียม: ${setupStart} - ${setupEnd} น.`;
            message += `\n🎬 จัดงาน: ${eventStart} - ${eventEnd} น.`;
            message += `\n------------------------------`;
        });

        sendLineMessage(message);
    } catch (err) {
        console.error("Error:", err);
    }
}

/**
 * ⚙️ ส่วนที่ 3: Helper Functions
 */

function formatDateRange(isoStart, isoEnd) {
    if (!isoStart || !isoEnd) return "---";
    const start = new Date(isoStart);
    const end = new Date(isoEnd);
    const dStart = start.getDate();
    const dEnd = end.getDate();
    const mStart = start.getMonth();
    const mEnd = end.getMonth();

    if (dStart === dEnd && mStart === mEnd) return `${dStart}`;
    if (mStart !== mEnd) return `${dStart}/${mStart + 1} - ${dEnd}/${mEnd + 1}`;
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

function doGet(e) {
    return ContentService.createTextOutput("GAS Bridge & Routine Active!");
}
