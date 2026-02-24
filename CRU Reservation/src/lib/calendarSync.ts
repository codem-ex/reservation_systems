/**
 * Service for syncing reservations to a centralized Google Calendar.
 */

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

interface CalendarEventParams {
    summary: string;
    location: string;
    description: string;
    startISO: string;
    endISO: string;
}

/**
 * Creates a new event in the centralized Google Calendar via Google Apps Script Bridge.
 * This approach bypasses API Key restrictions for writing events.
 */
export async function createGoogleCalendarEvent(params: CalendarEventParams) {
    console.log("[Debug Bridge] Sync Params:", params);

    if (!SCRIPT_URL || !CALENDAR_ID) {
        console.error("[Debug Bridge] Missing credentials!", {
            hasScriptUrl: !!SCRIPT_URL,
            hasCalendarId: !!CALENDAR_ID
        });
        return null;
    }

    const payload = {
        calendarId: CALENDAR_ID,
        summary: params.summary,
        location: params.location,
        description: params.description,
        start: params.startISO,
        end: params.endISO
    };

    try {
        console.log("[Debug Bridge] Sending request to Apps Script...");
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            mode: 'no-cors', // Standard for Apps Script Web Apps in simple fetch
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        // NOTE: With 'no-cors', we can't see the response body or ok status.
        // But the request will be sent to the script.
        // For debugging, we use a slightly different approach if we want to see errors.
        console.log("[Debug Bridge] Request sent (status invisible due to no-cors mode)");

        return { status: "sent" };
    } catch (error) {
        console.error("[Debug Bridge] Fetch Error:", error);
        throw error;
    }
}
