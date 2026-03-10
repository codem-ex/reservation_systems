import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/*
  Production Login (Supabase + Google OAuth)

  - Allow only @chandra.ac.th
  - Enforce after OAuth
  - Auto sign-out if domain invalid
  - Redirect on success
*/

import { useNavigate } from "react-router-dom";
import ParticleBackground from "../components/ParticleBackground";

const ALLOWED_DOMAIN = "chandra.ac.th";

function isAllowedEmail(email?: string | null): boolean {
    if (!email) return false;
    const lower = email.toLowerCase();
    // อนุญาตทั้ง @chandra.ac.th และ @*.chandra.ac.th
    return lower.endsWith(`@${ALLOWED_DOMAIN}`) || lower.endsWith(`.${ALLOWED_DOMAIN}`);
}

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Redirect URL — lands on the public /auth/callback page
    // so the hash fragment (#access_token=…) is parsed there,
    // safely outside of PrivateRoute.
    const redirectTo = useMemo(() => {
        const envUrl = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined;
        if (envUrl && envUrl.trim() !== "") return envUrl;
        return `${window.location.origin}/auth/callback`;
    }, []);

    // Force logout with message
    const forceLogout = async (message: string) => {
        try {
            await supabase.auth.signOut();
        } finally {
            setLoading(false);
            setError(message);
        }
    };

    // Check current user domain
    const enforceDomain = async () => {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email;

        if (email) {
            console.log("Login: Checking existing session for", email);
            if (!isAllowedEmail(email)) {
                await forceLogout(`อนุญาตเฉพาะบัญชี @${ALLOWED_DOMAIN} เท่านั้น (พบ: ${email})`);
                return;
            }

            // Valid user already exists -> redirect to home (Internal only)
            if (window.location.pathname === "/login") {
                navigate("/", { replace: true });
            }
        }
    };

    // Listen auth state
    useEffect(() => {
        // Run once on mount
        enforceDomain();

        const { data: listener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log("Login: Global Auth Event ->", event);

                if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
                    const email = session?.user?.email;

                    if (email && !isAllowedEmail(email)) {
                        await forceLogout(`อนุญาตเฉพาะบัญชี @${ALLOWED_DOMAIN} เท่านั้น`);
                        return;
                    }

                    if (email && isAllowedEmail(email) && window.location.pathname === "/login") {
                        navigate("/", { replace: true });
                    }
                }
            }
        );

        return () => {
            listener.subscription.unsubscribe();
        };
    }, [navigate]);

    // Google OAuth
    const handleGoogleLogin = async () => {
        setError("");
        setLoading(true);

        // ✅ Clear old session before starting new login
        await supabase.auth.signOut();

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo,

                // UX hint for Google account chooser
                queryParams: {
                    hd: ALLOWED_DOMAIN,
                    prompt: "select_account",
                },
            },
        });

        if (error) {
            setLoading(false);
            setError(error.message || "Google sign-in failed");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* 3D Particle Background */}
            <ParticleBackground />

            <div className="
                backdrop-blur-xl bg-white/10 dark:bg-slate-900/40 
                rounded-3xl shadow-2xl p-8 w-full max-w-md 
                border border-white/20 dark:border-slate-700/50
                animate-in fade-in zoom-in duration-500
                relative z-10
            ">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="bg-white/90 dark:bg-slate-800 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/20 dark:border-slate-700 p-3">
                        <img src="/logo.png" alt="CRU Logo" className="w-full h-full object-contain" />
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">
                        เข้าสู่ระบบ
                    </h1>

                    <p className="text-slate-300">
                        ระบบจองห้องประชุม มหาวิทยาลัยราชภัฏจันทรเกษม
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/20 text-red-100 p-4 rounded-xl text-sm border border-red-500/30 flex items-start mb-6 backdrop-blur-md">
                        <Lock className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Login Button */}
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="
            w-full py-4 rounded-xl font-semibold border
            bg-white/90 hover:bg-white text-slate-900 border-transparent
            transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]
            flex items-center justify-center
            shadow-xl shadow-primary-500/10
            disabled:opacity-60
            disabled:cursor-not-allowed
          "
                >
                    {/* Google Icon */}
                    <svg
                        className="w-5 h-5 mr-3"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                    >
                        <path
                            fill="#FFC107"
                            d="M43.611 20.083H42V20H24v8h11.303C33.651 32.657 29.197 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.045 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                        />
                        <path
                            fill="#FF3D00"
                            d="M6.306 14.691 12.879 19.51C14.656 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.045 6.053 29.268 4 24 4c-7.682 0-14.35 4.328-17.694 10.691z"
                        />
                        <path
                            fill="#4CAF50"
                            d="M24 44c5.097 0 9.784-1.956 13.314-5.143l-6.146-5.202C29.241 35.486 26.751 36 24 36c-5.176 0-9.617-3.317-11.281-7.946l-6.52 5.02C9.505 39.556 16.227 44 24 44z"
                        />
                        <path
                            fill="#1976D2"
                            d="M43.611 20.083H42V20H24v8h11.303c-.794 2.24-2.231 4.129-4.135 5.453l.003-.002 6.146 5.202C36.928 39.01 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                        />
                    </svg>

                    {loading ? "กำลังเปลี่ยนเส้นทาง…" : "เข้าสู่ระบบด้วย Google"}
                </button>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-white/10">
                    <p className="text-xs text-center text-slate-400">
                        กรุณาเข้าสู่ระบบด้วยบัญชี Google <br />
                        <b className="text-primary-400">@{ALLOWED_DOMAIN}</b> เท่านั้น
                    </p>
                </div>

            </div>
        </div>
    );
};


export default Login;
