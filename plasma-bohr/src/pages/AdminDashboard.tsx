import React, { useEffect, useMemo, useState } from "react";
import { Check, X, Clock as ClockIcon, Calendar, FileText, FileSpreadsheet } from "lucide-react";
import {
    getBookings,
    getRooms,
    getUsers,
    updateBookingStatus,
} from "../services/storage";
import { exportToPDF, exportToExcel } from "../services/reportService";
import type { Booking } from "../types";
import { format } from "date-fns";

import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";

type ProfileAdmin = {
    id: string;
    email: string | null;
    is_admin: boolean | null;
};

const AdminDashboard = () => {
    /* ===============================
       Auth (Supabase)
    =============================== */
    const { user: supabaseUser, loading: authLoading } = useAuth();

    /* ===============================
       Admin Check (profiles.is_admin)
    =============================== */
    const [checkingAdmin, setCheckingAdmin] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminError, setAdminError] = useState("");

    useEffect(() => {
        const run = async () => {
            setAdminError("");

            if (!supabaseUser?.id) {
                console.warn("[admin] no supabase user -> deny");
                setIsAdmin(false);
                setCheckingAdmin(false);
                return;
            }

            setCheckingAdmin(true);

            try {
                console.log("[admin] uid:", supabaseUser.id, "email:", supabaseUser.email);

                const { data, error } = await supabase
                    .from("profiles")
                    .select("id, email, is_admin")
                    .eq("id", supabaseUser.id)
                    .maybeSingle();

                if (error) {
                    console.error("[admin] profile error:", error);
                    setAdminError(error.message);
                    setIsAdmin(false);
                    return;
                }

                const row = (data as ProfileAdmin) ?? null;
                const ok = row?.is_admin === true;

                console.log("[admin] is_admin:", row?.is_admin, "=> allow?", ok);

                setIsAdmin(ok);
            } finally {
                setCheckingAdmin(false);
            }
        };

        if (!authLoading) run();
    }, [authLoading, supabaseUser?.id, supabaseUser?.email]);

    /* ===============================
       Data (Legacy Local Storage)
       (คงไว้ก่อนเพื่อไม่ทำลาย flow เดิม)
    =============================== */
    const [bookings, setBookings] = useState(getBookings()); // Local state to trigger re-renders
    const rooms = getRooms();
    const users = getUsers();

    const pendingBookings = useMemo(() => bookings.filter((b) => b.status === "pending"), [bookings]);
    const pastBookings = useMemo(() => bookings.filter((b) => b.status !== "pending"), [bookings]);

    const handleAction = (bookingId: string, status: Booking["status"]) => {
        // เดิมใช้ currentUser?.id (local) แต่ตอนนี้เอา supabaseUser.id แทนให้ consistent
        updateBookingStatus(bookingId, status, supabaseUser?.id);
        setBookings(getBookings()); // Refresh data
    };

    const handleExportPDF = () => exportToPDF(bookings, rooms, users);
    const handleExportExcel = () => exportToExcel(bookings, rooms, users);

    /* ===============================
       Loading State
    =============================== */
    if (authLoading || checkingAdmin) {
        return (
            <div className="p-8 text-center text-gray-500">
                Loading admin permissions...
            </div>
        );
    }

    /* ===============================
       Denied
    =============================== */
    if (!supabaseUser || !isAdmin) {
        return (
            <div className="p-8 text-center bg-red-50 text-red-700 rounded-xl border border-red-100">
                <div className="font-semibold">
                    Access Denied. You must be admin to view this page.
                </div>

                <div className="text-sm text-red-600 mt-2">
                    {supabaseUser?.email ? (
                        <>Signed in as: <b>{supabaseUser.email}</b></>
                    ) : (
                        <>Not signed in</>
                    )}
                </div>

                {adminError && (
                    <div className="text-xs text-red-700 mt-2">
                        Debug: {adminError}
                    </div>
                )}
            </div>
        );
    }

    /* ===============================
       Admin UI
    =============================== */
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

                <div className="flex space-x-2">
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center px-4 py-2 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                    </button>

                    <button
                        onClick={handleExportExcel}
                        className="flex items-center px-4 py-2 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Pending Approvals */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <ClockIcon className="w-5 h-5 mr-2 text-yellow-500" />
                    Pending Approvals ({pendingBookings.length})
                </h2>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {pendingBookings.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">No pending requests.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingBookings.map((booking) => {
                                const room = rooms.find((r) => r.id === booking.roomId);
                                const user = users.find((u) => u.id === booking.userId);

                                return (
                                    <div
                                        key={booking.id}
                                        className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900">{room?.name}</span>
                                                <span className="text-gray-400">•</span>
                                                <span className="text-primary-600 font-medium">{user?.name}</span>
                                            </div>

                                            <p className="text-gray-600 text-sm mb-2">{booking.purpose}</p>

                                            <div className="flex items-center text-sm text-gray-500 gap-4">
                                                <span className="flex items-center">
                                                    <Calendar className="w-4 h-4 mr-1.5" />
                                                    {format(new Date(booking.startTime), "MMM d, yyyy")}
                                                </span>

                                                <span className="flex items-center">
                                                    <ClockIcon className="w-4 h-4 mr-1.5" />
                                                    {format(new Date(booking.startTime), "HH:mm")} -{" "}
                                                    {format(new Date(booking.endTime), "HH:mm")}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAction(booking.id, "approved")}
                                                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                Approve
                                            </button>

                                            <button
                                                onClick={() => handleAction(booking.id, "rejected")}
                                                className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* History */}
            <section className="opacity-75">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">History</h2>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {pastBookings.slice(0, 5).map((booking) => {
                            const room = rooms.find((r) => r.id === booking.roomId);
                            const user = users.find((u) => u.id === booking.userId);

                            return (
                                <div key={booking.id} className="p-4 flex justify-between items-center text-sm">
                                    <div>
                                        <span className="font-medium">{room?.name}</span>
                                        <span className="mx-2 text-gray-300">|</span>
                                        <span className="text-gray-600">{user?.name}</span>
                                    </div>

                                    <span
                                        className={`capitalize ${booking.status === "approved" ? "text-green-600" : "text-red-600"
                                            }`}
                                    >
                                        {booking.status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdminDashboard;
