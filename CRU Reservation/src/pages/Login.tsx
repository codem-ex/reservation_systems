import React, { useEffect, useMemo, useState } from "react";
import { User as UserIcon, Lock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/*
  Production Login (Supabase + Google OAuth)

  - Allow only @chandra.ac.th
  - Enforce after OAuth
  - Auto sign-out if domain invalid
  - Redirect on success
*/

const ALLOWED_DOMAIN = "chandra.ac.th";

function isAllowedEmail(email?: string | null): boolean {
    if (!email) return false;
    return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

const Login: React.FC = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Redirect URL (from env or current origin)
    const redirectTo = useMemo(() => {
        const envUrl = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined;
        return envUrl && envUrl.trim() !== ""
            ? envUrl
            : window.location.origin;
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

        if (email && !isAllowedEmail(email)) {
            await forceLogout(`อนุญาตเฉพาะบัญชี @${ALLOWED_DOMAIN} เท่านั้น`);
        }
    };

    // Listen auth state
    useEffect(() => {
        enforceDomain();

        const { data: listener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                    const email = session?.user?.email;

                    if (email && !isAllowedEmail(email)) {
                        await forceLogout(`อนุญาตเฉพาะบัญชี @${ALLOWED_DOMAIN} เท่านั้น`);
                        return;
                    }

                    // Valid user → go home
                    if (email && isAllowedEmail(email)) {
                        window.location.href = "/";
                    }
                }
            }
        );

        return () => {
            listener.subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Google OAuth
    const handleGoogleLogin = async () => {
        setError("");
        setLoading(true);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo,

                // UX hint for Google account chooser
                queryParams: {
                    hd: ALLOWED_DOMAIN,
                    // prompt: "select_account",
                },
            },
        });

        if (error) {
            setLoading(false);
            setError(error.message || "Google sign-in failed");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-200 to-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserIcon className="w-8 h-8 text-primary-600" />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900">
                        Sign In
                    </h1>

                    <p className="text-gray-500 mt-2">
                        ระบบจองห้องประชุม มหาวิทยาลัยราชภัฏจันทรเกษม
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-start mb-6">
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
            w-full py-3 rounded-lg font-semibold border
            bg-white text-gray-800 border-gray-200
            hover:bg-gray-50
            transition-colors
            flex items-center justify-center
            shadow-sm
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

                    {loading ? "Redirecting…" : "Login with Google"}
                </button>

                {/* Footer */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <p className="text-xs text-center text-gray-500">
                        กรุณาเข้าสู่ระบบด้วยบัญชี Google <br />
                        <b>@{ALLOWED_DOMAIN}</b> เท่านั้น
                    </p>
                </div>

            </div>
        </div>
    );
};

export default Login;
