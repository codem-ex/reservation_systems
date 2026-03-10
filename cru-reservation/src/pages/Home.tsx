import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, CalendarDays, Clock } from "lucide-react";

import { getRooms, getBookings, getCurrentUser } from "../services/storage";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";

type ProfileLite = {
    id: string;
    display_name: string | null;
    email: string | null;
    department: string | null;
    mobile_phone: string | null;
    avatar_url: string | null;
};

const Home = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const hasSeenGuide = localStorage.getItem("has_seen_user_guide");
        if (!hasSeenGuide) {
            // Set flag immediately so they can navigate back to home if they want
            localStorage.setItem("has_seen_user_guide", "true");
            navigate("/help");
        }
    }, [navigate]);
    /* ===============================
       Supabase Session
    =============================== */
    const { user: supabaseUser, loading } = useAuth();

    /* ===============================
       Old Local Storage User (Fallback)
    =============================== */
    const localUser = getCurrentUser();

    /* ===============================
       Merge User Source
       Priority: Supabase > Local
    =============================== */
    const user = supabaseUser
        ? {
            id: supabaseUser.id,
            email: supabaseUser.email ?? "",
            name:
                (supabaseUser.user_metadata?.full_name as string | undefined) ||
                (supabaseUser.user_metadata?.name as string | undefined) ||
                supabaseUser.email?.split("@")[0] ||
                "User",
        }
        : localUser;

    /* ===============================
       Profile from DB (optional for name/email consistency)
    =============================== */
    const [profile, setProfile] = useState<ProfileLite | null>(null);

    const displayName = useMemo(() => {
        const metaName =
            (supabaseUser?.user_metadata?.full_name as string | undefined) ||
            (supabaseUser?.user_metadata?.name as string | undefined);

        return (
            metaName ||
            profile?.display_name ||
            (user?.name as string | undefined) ||
            (user?.email ? user.email.split("@")[0] : "User")
        );
    }, [supabaseUser, profile?.display_name, user]);

    const displayEmail = useMemo(() => {
        return supabaseUser?.email || (user?.email as string | undefined) || "";
    }, [supabaseUser?.email, user]);

    useEffect(() => {
        const run = async () => {
            if (!supabaseUser?.id) return;

            const { data } = await supabase
                .from("profiles")
                .select("id, display_name, email, department, mobile_phone, avatar_url")
                .eq("id", supabaseUser.id)
                .maybeSingle();

            setProfile((data as ProfileLite) ?? null);
        };

        if (!loading) run();
    }, [loading, supabaseUser?.id]);

    /* ===============================
       Existing Data
    =============================== */
    const rooms = getRooms();
    const allBookings = getBookings();
    const myBookings = allBookings.filter((b) => b.userId === user?.id);

    // Quick stats
    const activeBookings = myBookings.filter(
        (b) => b.status === "approved" || b.status === "pending"
    ).length;

    /* ===============================
       Loading State (Auth)
    =============================== */
    if (loading) {
        return <div className="p-6 text-gray-500">กำลังโหลดข้อมูลผู้ใช้งาน...</div>;
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    ยินดีต้อนรับกลับมา, {displayName.split(" ")[0]}!
                </h1>

                <p className="text-gray-500 dark:text-slate-400 mt-2">
                    นี่คือข้อมูลการจองห้องประชุมของคุณ
                </p>

                {displayEmail && <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">{displayEmail}</p>}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary-600 rounded-xl p-6 text-white shadow-lg shadow-primary-200 transition-transform hover:scale-[1.02] cursor-pointer">
                    <Link to="/search">
                        <div className="flex items-center justify-between mb-4">
                            <Search className="w-8 h-8 opacity-80" />
                            <span className="bg-primary-500 px-3 py-1 rounded-full text-xs font-semibold">
                                ใหม่
                            </span>
                        </div>
                        <h3 className="text-xl font-bold mb-1">ค้นหาห้อง</h3>
                        <p className="text-primary-100 text-sm">
                            ค้นหาห้องว่างตามเวลาและความจุที่ต้องการ
                        </p>
                    </Link>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <CalendarDays className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{activeBookings}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">การจองของคุณ</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">รายการที่กำลังดำเนินการ</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <Clock className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {rooms.filter((r) => r.status === "available").length}
                        </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ห้องว่าง</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">พร้อมสำหรับการจองทันที</p>
                </div>
            </div>

            {/* Recent Activity */}
            <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    กิจกรรมล่าสุด (ห้องทั้งหมด)
                </h2>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors shadow-sm">
                    {allBookings.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                            ยังไม่มีข้อมูลการจอง เริ่มต้นโดยการค้นหาห้องได้เลย!
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {allBookings.slice(0, 10).map((booking) => {
                                const room = rooms.find((r) => r.id === booking.roomId);

                                return (
                                    <div
                                        key={booking.id}
                                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                                    >
                                        <div>
                                            <h4 className="font-medium text-gray-900 dark:text-white">
                                                {room?.name || "ไม่ทราบชื่อห้อง"}
                                            </h4>
                                            <p className="text-sm text-gray-500 dark:text-slate-400">
                                                {new Date(booking.start_at).toLocaleDateString()} •{" "}
                                                {new Date(booking.start_at).toLocaleTimeString()}
                                            </p>
                                        </div>

                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium capitalize border
                      ${booking.status === "approved"
                                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50"
                                                    : booking.status === "pending"
                                                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50"
                                                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50"
                                                }`}
                                        >
                                            {booking.status === "approved"
                                                ? "อนุมัติแล้ว"
                                                : booking.status === "pending"
                                                    ? "รออนุมัติ"
                                                    : "ปฏิเสธ/ยกเลิก"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Home;
