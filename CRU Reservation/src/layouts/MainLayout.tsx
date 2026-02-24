import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Search, CalendarDays, LogOut, Moon, Sun, Settings, HelpCircle } from "lucide-react";
import NotificationBell from "../components/NotificationBell";
import AppParticles from "../components/AppParticles";

import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";

type ProfileLite = {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
};

export default function MainLayout() {
    const { user: supabaseUser } = useAuth();
    const [profile, setProfile] = useState<ProfileLite | null>(null);
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("theme");
            // Default to light (false) unless "dark" is explicitly saved
            return saved === "dark";
        }
        return false;
    });

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
    }, [darkMode]);

    // Force sync if class is missing but state is true (fix for some hydration/rendering issues)
    useEffect(() => {
        const isDark = document.documentElement.classList.contains("dark");
        if (darkMode && !isDark) document.documentElement.classList.add("dark");
        if (!darkMode && isDark) document.documentElement.classList.remove("dark");
    }, []);

    const displayName = useMemo(() => {
        const metaName =
            (supabaseUser?.user_metadata?.full_name as string | undefined) ||
            (supabaseUser?.user_metadata?.name as string | undefined);

        return (
            metaName ||
            profile?.display_name ||
            supabaseUser?.email?.split("@")[0] ||
            "User"
        );
    }, [supabaseUser, profile?.display_name]);

    const displayEmail = useMemo(
        () => supabaseUser?.email || "",
        [supabaseUser?.email]
    );

    useEffect(() => {
        const run = async () => {
            if (!supabaseUser?.id) return;

            const { data } = await supabase
                .from("profiles")
                .select("id, display_name, email, avatar_url")
                .eq("id", supabaseUser.id)
                .maybeSingle();

            setProfile((data as ProfileLite) ?? null);
        };

        run();
    }, [supabaseUser?.id]);

    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        [
            "flex items-center px-4 py-3 rounded-lg transition-all",
            isActive
                ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-bold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
        ].join(" ");

    return (
        // ✅ ทำให้โครงนี้เป็น “หน้าจอเดียว” และกัน body scroll
        <div className="h-screen relative text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
            {/* 3D Background Particles that adapt to Dark/Light mode */}
            <AppParticles />

            <div className="flex h-full relative z-10">
                {/* Sidebar */}
                <aside className="w-72 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col transition-colors">
                    {/* ✅ sticky ทำให้มัน “อยู่ในจอ” เวลา content ขวาเลื่อน */}
                    <div className="sticky top-0 flex flex-col h-screen">
                        {/* Brand */}
                        <Link to="/" className="p-6 block hover:opacity-80 transition-opacity group">
                            <div className="text-2xl font-extrabold text-primary-700 leading-tight group-hover:text-primary-600 transition-colors">
                                ระบบจองห้อง
                                <br />
                                ประชุม
                            </div>
                            <div className="text-sm text-slate-500 mt-2">
                                มหาวิทยาลัยราชภัฏจันทรเกษม
                            </div>
                        </Link>

                        {/* Nav */}
                        <nav className="px-4 space-y-2">
                            <NavLink to="/" end className={navItemClass}>
                                <LayoutDashboard className="w-5 h-5 mr-3" />
                                หน้าแรก
                            </NavLink>

                            <NavLink to="/search" className={navItemClass}>
                                <Search className="w-5 h-5 mr-3" />
                                ค้นหาห้องประชุม
                            </NavLink>

                            <NavLink to="/schedule" className={navItemClass}>
                                <CalendarDays className="w-5 h-5 mr-3" />
                                ตารางเวลาห้อง
                            </NavLink>

                            <NavLink to="/bookings" className={navItemClass}>
                                <CalendarDays className="w-5 h-5 mr-3" />
                                การจองของฉัน
                            </NavLink>

                            <NavLink to="/admin" className={navItemClass}>
                                <Settings className="w-5 h-5 mr-3" />
                                จัดการระบบ
                            </NavLink>

                            <NavLink to="/help" className={navItemClass}>
                                <HelpCircle className="w-5 h-5 mr-3" />
                                คู่มือการใช้งาน
                            </NavLink>
                        </nav>

                        {/* Spacer ให้ส่วนล่าง “ติดก้น sidebar” ตลอด */}
                        <div className="flex-1" />

                        {/* Night Mode & Notifications */}
                        <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setDarkMode(!darkMode)}
                                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title={darkMode ? "เปิดโหมดกลางวัน" : "เปิดโหมดกลางคืน"}
                            >
                                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>

                            <NotificationBell userId={supabaseUser?.id || ""} />
                        </div>

                        {/* Profile + Logout (อยู่ล่างเสมอ) */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-transparent transition-colors">
                            <Link to="/profile">
                                <div className="flex items-center p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl mb-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer border border-transparent dark:border-slate-700/50 shadow-sm">
                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold mr-3 overflow-hidden shadow-inner font-sans">
                                        {profile?.avatar_url ? (
                                            <img
                                                src={profile.avatar_url}
                                                alt="avatar"
                                                className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            (displayName?.charAt(0) || "U").toUpperCase()
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {displayName}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {displayEmail || "-"}
                                        </p>
                                    </div>
                                </div>
                            </Link>

                            <button
                                className="flex items-center justify-center w-full px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                onClick={async () => {
                                    await supabase.auth.signOut();
                                    window.location.href = "/login";
                                }}
                                type="button"
                            >
                                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                                ออกจากระบบ
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Content */}
                {/* ✅ ให้ฝั่งขวาเป็นตัว scroll หลัก */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 md:p-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
