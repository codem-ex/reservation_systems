import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Public OAuth callback page.
 *
 * After Google auth Supabase redirects here with either:
 *   - implicit flow:  #access_token=…
 *   - PKCE flow:      ?code=…
 *
 * The Supabase client (detectSessionInUrl: true) automatically
 * parses those params and fires SIGNED_IN. We just listen and
 * forward to "/" or back to "/login" on failure.
 */
const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState("กำลังเข้าสู่ระบบ...");

    useEffect(() => {
        let handled = false;

        const go = (path: string) => {
            if (handled) return;
            handled = true;
            navigate(path, { replace: true });
        };

        // 🔍 Debug: log the URL we actually landed on
        console.log("AuthCallback: Full URL ->", window.location.href);
        console.log("AuthCallback: Hash ->", window.location.hash);
        console.log("AuthCallback: Search ->", window.location.search);

        // 1️⃣ Listen for auth events
        const { data: listener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log("AuthCallback: event ->", event, session?.user?.email);

                if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
                    go("/");
                    return;
                }
            }
        );

        // 2️⃣ Try to manually exchange PKCE code if present
        const handleCodeExchange = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");

            if (code) {
                console.log("AuthCallback: Found code param, exchanging...");
                const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                console.log("AuthCallback: Exchange result ->", data?.user?.email, error?.message);

                if (data?.session) {
                    go("/");
                    return;
                }

                if (error) {
                    console.error("AuthCallback: Code exchange failed:", error.message);
                    setStatus(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
                    setTimeout(() => go("/login"), 2000);
                    return;
                }
            }

            // 3️⃣ Also check hash fragment (implicit flow fallback)
            if (window.location.hash && window.location.hash.includes("access_token")) {
                console.log("AuthCallback: Hash fragment detected, waiting for Supabase...");
                // Supabase should handle this automatically via detectSessionInUrl
                // Wait a bit longer
                return;
            }

            // 4️⃣ Final fallback: no code, no hash — wait then check session
            setTimeout(async () => {
                const { data } = await supabase.auth.getSession();
                console.log("AuthCallback: fallback getSession ->", data.session?.user?.email);

                if (data.session) {
                    go("/");
                } else {
                    setStatus("ไม่สามารถเข้าสู่ระบบได้ กำลังกลับหน้า Login...");
                    setTimeout(() => go("/login"), 1500);
                }
            }, 3000);
        };

        handleCodeExchange();

        return () => {
            listener.subscription.unsubscribe();
        };
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-none p-8 w-full max-w-sm border border-transparent dark:border-slate-800 text-center">
                {/* Spinner */}
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                <p className="text-gray-700 dark:text-slate-300 font-medium">{status}</p>
            </div>
        </div>
    );
};

export default AuthCallback;
