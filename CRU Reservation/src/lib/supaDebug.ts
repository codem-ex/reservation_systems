import { supabase } from "./supabaseClient";

const MASK = (v?: string | null) => {
    if (!v) return "";
    const head = v.slice(0, 12);
    const tail = v.slice(-6);
    return `${head}…${tail}`;
};

export async function logSession(tag = "session") {
    const { data, error } = await supabase.auth.getSession();
    const s = data.session;

    console.group(`[supabase:${tag}] getSession`);
    if (error) console.error("error:", error);

    if (!s) {
        console.warn("session: null");
        console.groupEnd();
        return null;
    }

    console.log("user.id:", s.user?.id);
    console.log("user.email:", s.user?.email);
    console.log("provider:", (s.user as any)?.app_metadata?.provider);
    console.log("aud:", s.user?.aud);
    console.log("expires_at:", s.expires_at);
    console.log("access_token:", MASK(s.access_token));
    console.log("refresh_token:", MASK(s.refresh_token));
    console.groupEnd();

    return s;
}

export function attachAuthLogger() {
    console.group("[supabase] attachAuthLogger");
    console.log("listening onAuthStateChange…");
    console.groupEnd();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
        console.group(`[supabase] auth event: ${event}`);
        console.log("has session?", !!session);
        console.log("user.id:", session?.user?.id);
        console.log("user.email:", session?.user?.email);
        console.log("expires_at:", session?.expires_at);
        console.log("access_token:", MASK(session?.access_token));
        console.groupEnd();
    });

    return () => data.subscription.unsubscribe();
}

/**
 * Hook fetch to log Storage calls + whether Authorization header exists
 * NOTE: ไม่ log token เต็ม ป้องกันรั่ว
 */
export function attachStorageFetchLogger() {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
            typeof input === "string"
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url;

        const isStorage = url.includes("/storage/v1/");

        if (isStorage) {
            const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
            const auth = headers.get("Authorization") || headers.get("authorization");
            const apikey = headers.get("apikey") || headers.get("x-api-key");

            console.group("[fetch][storage]");
            console.log("url:", url);
            console.log("method:", init?.method || (input instanceof Request ? input.method : "GET"));
            console.log("has Authorization?", !!auth);
            console.log("Authorization(masked):", auth ? MASK(auth) : "");
            console.log("has apikey?", !!apikey);
            console.groupEnd();
        }

        const res = await originalFetch(input as any, init);
        if (isStorage) {
            console.log("[fetch][storage] response:", res.status, res.statusText);
        }
        return res;
    };

    return () => {
        window.fetch = originalFetch;
    };
}
