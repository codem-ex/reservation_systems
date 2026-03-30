import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, CalendarDays, Clock } from "lucide-react";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

import { getCurrentUser } from "../services/storage";
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
       Supabase Data Fetching
    =============================== */
    const [dbRooms, setDbRooms] = useState<any[]>([]);
    const [dbBookings, setDbBookings] = useState<any[]>([]);
    const [myDbBookings, setMyDbBookings] = useState<any[]>([]);
    const [todayOccupiedRoomIds, setTodayOccupiedRoomIds] = useState<Set<string>>(new Set());
    const [fetchLoading, setFetchLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!supabaseUser?.id) return;
            setFetchLoading(true);

            try {
                // 1. Fetch Rooms
                const { data: roomsData } = await supabase
                    .from("rooms")
                    .select("*");
                if (roomsData) setDbRooms(roomsData);

                // 2. Fetch Recent Activities (All bookings)
                const { data: allData } = await supabase
                    .from("reservations")
                    .select("*, rooms(name)")
                    .order("created_at", { ascending: false })
                    .limit(10);
                if (allData) setDbBookings(allData);

                // 3. Fetch My Bookings for stats
                const { data: myData } = await supabase
                    .from("reservations")
                    .select("id, status")
                    .eq("requester_id", supabaseUser.id)
                    .in("status", ["PENDING", "APPROVED"]);
                if (myData) setMyDbBookings(myData);

                // 4. Fetch Today's Occupied Rooms (Approved or Pending)
                const startOfDay = dayjs().tz("Asia/Bangkok").startOf("day").toISOString();
                const endOfDay = dayjs().tz("Asia/Bangkok").endOf("day").toISOString();

                const { data: todayData } = await supabase
                    .from("reservations")
                    .select("room_id")
                    .in("status", ["APPROVED", "PENDING"])
                    .or(`start_at.lte.${endOfDay},start_at.gte.${startOfDay}`) // over-simplified overlap check
                    .filter("start_at", "lte", endOfDay)
                    .filter("end_at", "gte", startOfDay);

                if (todayData) {
                    const ids = new Set(todayData.map((b) => b.room_id));
                    setTodayOccupiedRoomIds(ids as Set<string>);
                }

            } catch (err) {
                console.error("Dashboard Fetch Error:", err);
            } finally {
                setFetchLoading(false);
            }
        };

        if (!loading) fetchData();
    }, [loading, supabaseUser?.id]);

    /* ===============================
       Loading State (Auth + Data)
    =============================== */
    if (loading || fetchLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-gray-500 animate-pulse font-medium">กำลังโหลดข้อมูลล่าสุด...</p>
            </div>
        );
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
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{myDbBookings.length}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">การจองของคุณ</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">รายการที่กำลังดำเนินการ</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <Clock className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {dbRooms.length - todayOccupiedRoomIds.size}
                        </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ห้องว่างวันนี้</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">อิงตามรายการจองวันนี้</p>
                </div>
            </div>

            {/* Recent Activity */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        กิจกรรมล่าสุด (ห้องทั้งหมด)
                    </h2>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-md font-bold uppercase tracking-widest">
                        Real-time Update
                    </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all shadow-sm">
                    {dbBookings.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center">
                                <CalendarDays className="w-6 h-6 text-slate-300" />
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 font-medium">
                                ยังไม่มีข้อมูลการจอง เริ่มต้นโดยการค้นหาห้องได้เลย!
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {dbBookings.map((booking) => {
                                return (
                                    <div
                                        key={booking.id}
                                        className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/30 flex items-center justify-between transition-all group"
                                    >
                                        <div className="flex flex-col gap-1.5">
                                            <h4 className="font-bold text-slate-900 dark:text-white leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {booking.rooms?.name || "ไม่ทราบชื่อห้อง"}
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-x-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                                                <span className="font-medium text-slate-700 dark:text-slate-300">หัวข้อ: {booking.title}</span>
                                                <span className="opacity-30">|</span>
                                                <span>{new Date(booking.start_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'short' })}</span>
                                                <span>{new Date(booking.start_at).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })} น.</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5">
                                            <span
                                                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all
                                                    ${booking.status === "APPROVED"
                                                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50 shadow-sm shadow-emerald-500/10"
                                                        : booking.status === "PENDING"
                                                            ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50 shadow-sm shadow-amber-500/10"
                                                            : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/50 shadow-sm shadow-red-500/10"
                                                    }`}
                                            >
                                                {booking.status === "APPROVED"
                                                    ? "อนุมัติแล้ว"
                                                    : booking.status === "PENDING"
                                                        ? "รออนุมัติ"
                                                        : "ยกเลิก/ปฏิเสธ"}
                                            </span>
                                        </div>
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
