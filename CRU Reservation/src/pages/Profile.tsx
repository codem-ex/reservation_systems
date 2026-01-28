import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import { User as UserIcon, Save, Loader2 } from "lucide-react";

type ProfileRow = {
    id: string;
    display_name: string | null;
    email: string | null;
    department: string | null;
    mobile_phone: string | null;
    avatar_url: string | null;
};

const ALLOWED_DOMAIN = "chandra.ac.th";

function isAllowed(email?: string | null) {
    if (!email) return false;
    return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

function bestName(user: any, profile?: ProfileRow | null) {
    return (
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        profile?.display_name ||
        user?.email?.split("@")[0] ||
        "User"
    );
}

export default function Profile() {
    const { user, loading } = useAuth();

    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [mobile, setMobile] = useState("");
    const [department, setDepartment] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const email = useMemo(() => user?.email ?? "", [user?.email]);
    const name = useMemo(() => bestName(user, profile), [user, profile]);

    useEffect(() => {
        const load = async () => {
            if (!user) return;

            setError("");
            setMessage("");

            const { data, error } = await supabase
                .from("profiles")
                .select("id, display_name, email, department, mobile_phone, avatar_url")
                .eq("id", user.id)
                .single();

            if (error) {
                setError(error.message);
                return;
            }

            const row = data as ProfileRow;
            setProfile(row);
            setMobile(row.mobile_phone ?? "");
            setDepartment(row.department ?? "");
            setAvatarUrl(row.avatar_url ?? "");
        };

        if (!loading) load();
    }, [loading, user]);

    const saveProfile = async () => {
        if (!user) return;

        setError("");
        setMessage("");

        if (!mobile.trim() || !department.trim()) {
            setError("กรุณากรอกข้อมูลให้ครบ: เบอร์มือถือ และ หน่วยงาน");
            return;
        }

        setBusy(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({
                    mobile_phone: mobile.trim(),
                    department: department.trim(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

            if (error) throw error;

            window.location.href = "/";
        } catch (e: any) {
            setError(e?.message ?? "Save failed");
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading session...
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center text-gray-700">
                ยังไม่ได้เข้าสู่ระบบ
            </div>
        );
    }

    if (!isAllowed(user.email)) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center text-red-600">
                อนุญาตเฉพาะบัญชี @{ALLOWED_DOMAIN} เท่านั้น
            </div>
        );
    }

    return (
        <div className="min-h-[70vh] flex items-start justify-center py-10 px-4">
            <div className="w-full max-w-4xl">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
                    <p className="text-gray-500 mt-2">แก้ไขข้อมูลผู้ใช้งาน</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Left profile summary (centered) */}
                        <div className="w-full md:w-80 md:self-center">
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-20 h-20 rounded-full bg-primary-100 overflow-hidden flex items-center justify-center">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt="avatar"
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <UserIcon className="w-10 h-10 text-primary-600" />
                                    )}
                                </div>

                                <div>
                                    <div className="font-semibold text-gray-900 text-lg">{name}</div>
                                    <div className="text-sm text-gray-500 break-all">{email}</div>
                                </div>
                            </div>
                        </div>

                        {/* Right form */}
                        <div className="flex-1">
                            {(error || message) && (
                                <div
                                    className={[
                                        "rounded-lg border p-3 text-sm mb-4",
                                        error
                                            ? "bg-red-50 border-red-100 text-red-700"
                                            : "bg-emerald-50 border-emerald-100 text-emerald-700",
                                    ].join(" ")}
                                >
                                    {error || message}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email (Read-only)
                                    </label>
                                    <input
                                        value={email}
                                        readOnly
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ชื่อ (Read-only)
                                    </label>
                                    <input
                                        value={name}
                                        readOnly
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        เบอร์มือถือ
                                    </label>
                                    <input
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value)}
                                        placeholder="เช่น 08x-xxx-xxxx"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        หน่วยงาน
                                    </label>
                                    <input
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        placeholder="เช่น คณะ/สำนัก/ภาควิชา"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={saveProfile}
                                    disabled={busy}
                                    className="bg-primary-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {busy ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    บันทึก
                                </button>

                                <span className="text-sm text-gray-500">บันทึกแล้วจะเข้า Home ทันที</span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* /Card */}
            </div>
        </div>
    );
}
