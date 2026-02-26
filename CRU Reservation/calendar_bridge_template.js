/**
 * 📅 Calendar Sync Bridge for Google Apps Script
 * วางโค้ดนี้ในโปรเจกต์ GAS แยกต่างหาก (หรือถ้าใช้ร่วมกันให้ระวังชื่อฟังก์ชัน)
 * 
 * วิธีใช้งาน:
 * 1. วางโค้ดนี้ลงใน Apps Script
 * 2. กด Deploy > New Deployment
 * 3. เลือก Web App
 * 4. ตั้งค่า Who has access: "Anyone" (เพื่อให้แอปส่งข้อมูลมาได้)
 * 5. นำ Web App URL ที่ได้ไปใส่ในไฟล์ .env ตัวแปร VITE_GOOGLE_SCRIPT_URL
 */

const DEFAULT_CALENDAR_ID = "primary";

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        console.log("Received data:", data);

        const calendarId = data.calendarId || DEFAULT_CALENDAR_ID;
        const calendar = CalendarApp.getCalendarById(calendarId);

        if (!calendar) {
            return ContentService.createTextOutput(JSON.stringify({ error: "Calendar not found" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        const event = calendar.createEvent(
            data.summary,
            new Date(data.start),
            new Date(data.end),
            {
                location: data.location || "",
                description: data.description || ""
            }
        );

        return ContentService.createTextOutput(JSON.stringify({ success: true, eventId: event.getId() }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error("Error in doPost:", error);
        return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// ฟังก์ชันสำหรับทดสอบการทำงานเบื้องต้น
function doGet(e) {
    return ContentService.createTextOutput("Calendar Bridge is Active!");
}
