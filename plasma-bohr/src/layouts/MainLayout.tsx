import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Search, CalendarDays, LogOut } from "lucide-react";

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

    const displayEmail = useMemo(() => supabaseUser?.email || "", [supabaseUser?.email]);

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
            "flex items-center px-4 py-3 rounded-lg transition-colors",
            isActive ? "bg-slate-100 text-primary-700" : "text-slate-700 hover:bg-slate-50",
        ].join(" ");

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="flex">
                {/* Sidebar */}
                <aside className="w-72 bg-white border-r border-slate-200 min-h-screen flex flex-col">
                    {/* Brand */}
                    <div className="p-6">
                        <div className="text-2xl font-extrabold text-primary-700 leading-tight">
                            ระบบจองห้อง<br />ประชุม
                        </div>
                        <div className="text-sm text-slate-500 mt-2">
                            มหาวิทยาลัยราชภัฏจันทรเกษม
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="px-4 space-y-2">
                        <NavLink to="/" end className={navItemClass}>
                            <LayoutDashboard className="w-5 h-5 mr-3" />
                            Dashboard
                        </NavLink>

                        <NavLink to="/search" className={navItemClass}>
                            <Search className="w-5 h-5 mr-3" />
                            Search Rooms
                        </NavLink>

                        <NavLink to="/bookings" className={navItemClass}>
                            <CalendarDays className="w-5 h-5 mr-3" />
                            My Bookings
                        </NavLink>
                    </nav>

                    {/* ====== REQUIRED ELEMENT (under bookings) ====== */}
                    <div className="p-4 border-t border-gray-200">
                        <Link to="/profile">
                            <div className="flex items-center p-3 bg-slate-50 rounded-lg mb-3 hover:bg-slate-100 transition cursor-pointer">
                                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold mr-3 overflow-hidden">
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

                                <div>
                                    <p className="text-sm font-medium text-gray-900">{displayName}</p>
                                    <p className="text-xs text-gray-500 capitalize">{displayEmail || "-"}</p>
                                </div>
                            </div>
                        </Link>

                        <button
                            className="flex items-center justify-center w-full px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            onClick={async () => {
                                await supabase.auth.signOut();
                                window.location.href = "/login";
                            }}
                        >
                            <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                            Logout
                        </button>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />
                </aside>

                {/* Content */}
                <main className="flex-1 p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
