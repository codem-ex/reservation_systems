import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Search, CalendarDays, LogOut, Moon, Sun, Settings, HelpCircle, Menu, X } from "lucide-react";
import NotificationBell from "../components/NotificationBell";
import NotificationListener from "../components/NotificationListener";

import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";

type ProfileLite = {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    is_admin: boolean | null;
    stage_no: number | null;
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
                .select("id, display_name, email, avatar_url, is_admin, stage_no")
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
        // ✅ Keep original overflow-hidden and h-screen
        <div className="h-screen supports-[height:100dvh]:h-[100dvh] relative text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300 flex flex-col">
            <NotificationListener />

            {/* Mobile Navbar - Visible only on mobile */}
            <div className="md:hidden flex items-center justify-between px-4 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    {/* Branding removed as per user request */}
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell userId={supabaseUser?.id || ""} direction="down" />
                </div>
            </div>

            <div className="flex flex-1 min-h-0 relative">
                {/* Mobile Drawer Backdrop */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Sidebar - Desktop (Original) & Mobile Drawer */}
                <aside className={`
                    fixed inset-y-0 left-0 z-[70] w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 
                    transform transition-transform duration-300 ease-in-out
                    md:relative md:translate-x-0 md:flex md:bg-white/70 md:dark:bg-slate-900/70 md:backdrop-blur-md
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}>
                    <div className="flex flex-col h-full w-full">
                        {/* Brand (Mobile Header with Safe Area) */}
                        <div className="p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex items-start justify-between">
                            <Link
                                to="/"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex flex-col hover:opacity-80 transition-opacity active:scale-[0.98] group"
                            >
                                <h1 className="text-xl font-extrabold text-primary-700 dark:text-primary-400 leading-tight group-hover:text-primary-600 transition-colors">
                                    ระบบจองห้องประชุม
                                </h1>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium tracking-wide uppercase">
                                    Faculty of Education CRU
                                </p>
                            </Link>

                            {/* Close button for mobile drawer */}
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="md:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Nav */}
                        <nav className="px-4 space-y-2 flex-1 overflow-y-auto">
                            <NavLink to="/" end className={navItemClass} onClick={() => setIsMobileMenuOpen(false)}>
                                <LayoutDashboard className="w-5 h-5 mr-3" />
                                หน้าแรก
                            </NavLink>

                            <NavLink to="/search" className={navItemClass} onClick={() => setIsMobileMenuOpen(false)}>
                                <Search className="w-5 h-5 mr-3" />
                                ค้นหาห้องประชุม
                            </NavLink>

                            <NavLink to="/schedule" className={navItemClass} onClick={() => setIsMobileMenuOpen(false)}>
                                <CalendarDays className="w-5 h-5 mr-3" />
                                ตารางเวลาห้อง
                            </NavLink>

                            <NavLink to="/bookings" className={navItemClass} onClick={() => setIsMobileMenuOpen(false)}>
                                <CalendarDays className="w-5 h-5 mr-3" />
                                การจองของฉัน
                            </NavLink>

                            {(profile?.is_admin || (profile?.stage_no !== null && profile?.stage_no > 0)) && (
                                <NavLink to="/admin" className={navItemClass} onClick={() => setIsMobileMenuOpen(false)}>
                                    <Settings className="w-5 h-5 mr-3" />
                                    จัดการระบบ
                                </NavLink>
                            )}

                            <NavLink to="/help" className={navItemClass} onClick={() => setIsMobileMenuOpen(false)}>
                                <HelpCircle className="w-5 h-5 mr-3" />
                                คู่มือการใช้งาน
                            </NavLink>
                        </nav>

                        {/* Night Mode & Notifications (Visible on desktop sidebar footer) */}
                        <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setDarkMode(!darkMode)}
                                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title={darkMode ? "เปิดโหมดกลางวัน" : "เปิดโหมดกลางคืน"}
                            >
                                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>

                            {/* Show bell here only on desktop; mobile has it in Top Navbar */}
                            <div className="hidden md:block">
                                <NotificationBell userId={supabaseUser?.id || ""} direction="up" />
                            </div>
                        </div>

                        {/* Profile + Logout (Footer with Safe Area) */}
                        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-200 dark:border-slate-800 bg-transparent transition-colors">
                            <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}>
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
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
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
                <main className="flex-1 overflow-y-auto overscroll-none">
                    <div className="p-4 md:p-8 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
