import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, Clock as ClockIcon, Calendar, MessageSquare, Plus, Edit2, LayoutGrid } from "lucide-react";
import { format } from "date-fns";

import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";

/* ===============================
   Types (ตาม schema ที่ส่งมา)
=============================== */

type ProfileRow = {
    id: string;
    display_name: string | null;
    email: string | null;
    is_admin: boolean | null;
};

type RoomRow = {
    id: string;
    name: string;
};

type ReservationRow = {
    id: string;
    room_id: string;
    requester_id: string;

    title: string;
    purpose: string;

    start_at: string;
    end_at: string;

    status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
    current_stage: number;
    chain_id: string | null;

    // extra
    setup_date: string | null;
    setup_start: string | null;
    setup_end: string | null;
    setup_start_at: string | null;
    setup_end_at?: string;
    reservation_approvals?: {
        id: string;
        stage_no: number;
        approver_user_id: string;
        decision: string;
        decision_note: string | null;
    }[];
};

type ChainStep = {
    id: string;
    chain_id: string;
    stage_no: number;
    approver_user_id: string;
    is_active: boolean;
};

type ApprovalLog = {
    id: string;
    reservation_id: string;
    chain_id: string | null;
    stage_no: number;
    approver_user_id: string;
    decision: "APPROVED" | "REJECTED" | string;
    decision_note: string | null;
    decided_at: string | null;
    created_at: string;
};

type RowUI = {
    r: ReservationRow;
    room?: RoomRow;
    requester?: ProfileRow;
    myStep?: ChainStep | null; // step ของ user ที่ล็อกอิน (ถ้าเป็น approver ของ stage นี้)
};

const AdminDashboard = () => {
    const { user: supabaseUser, loading: authLoading } = useAuth();

    const [checkingAdmin, setCheckingAdmin] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const [loadingData, setLoadingData] = useState(true);
    const [reservations, setReservations] = useState<ReservationRow[]>([]);
    const [rooms, setRooms] = useState<RoomRow[]>([]);
    const [profiles, setProfiles] = useState<ProfileRow[]>([]);
    const [steps, setSteps] = useState<ChainStep[]>([]);
    const [errorMsg, setErrorMsg] = useState("");
    const [activeTab, setActiveTab] = useState<"reservations" | "rooms" | "reports" | "users">("reservations");
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());


    // reject modal
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectTarget, setRejectTarget] = useState<RowUI | null>(null);

    // timeline modal
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineTitle, setTimelineTitle] = useState("");
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineLogs, setTimelineLogs] = useState<ApprovalLog[]>([]);

    /* ===============================
       Admin check
    =============================== */
    useEffect(() => {
        const run = async () => {
            setErrorMsg("");

            if (!supabaseUser?.id) {
                setIsAdmin(false);
                setCheckingAdmin(false);
                return;
            }

            setCheckingAdmin(true);

            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("id, display_name, email, is_admin")
                    .eq("id", supabaseUser.id)
                    .maybeSingle();

                if (error) throw error;

                const me = data as ProfileRow | null;
                setIsAdmin(me?.is_admin === true);
            } catch (e: any) {
                setErrorMsg(e.message);
                setIsAdmin(false);
            } finally {
                setCheckingAdmin(false);
            }
        };

        if (!authLoading) run();
    }, [authLoading, supabaseUser?.id]);

    /* ===============================
       Load data
       - ไม่ใช้ relationship join
       - ดึง steps มาด้วย เพื่อ gating งานของ approver
    =============================== */
    const loadAll = async () => {
        setLoadingData(true);
        setErrorMsg("");

        try {
            const [rRes, roomsRes, profilesRes, stepsRes] = await Promise.all([
                supabase
                    .from("reservations")
                    .select(
                        "*, reservation_approvals(id, stage_no, approver_user_id, decision, decision_note)"
                    )
                    .order("created_at", { ascending: false }),

                supabase.from("rooms").select("id,name").order("name", { ascending: true }),

                supabase
                    .from("profiles")
                    .select("id,display_name,email,is_admin")
                    .order("updated_at", { ascending: false }),

                supabase
                    .from("approver_chain_steps")
                    .select("id,chain_id,stage_no,approver_user_id,is_active")
                    .eq("is_active", true),
            ]);

            if (rRes.error) throw rRes.error;
            if (roomsRes.error) throw roomsRes.error;
            if (profilesRes.error) throw profilesRes.error;
            if (stepsRes.error) throw stepsRes.error;

            setReservations((rRes.data || []) as ReservationRow[]);
            setRooms((roomsRes.data || []) as RoomRow[]);
            setProfiles((profilesRes.data || []) as ProfileRow[]);
            setSteps((stepsRes.data || []) as ChainStep[]);
        } catch (e: any) {
            setErrorMsg(e.message);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (!supabaseUser?.id) return;

        loadAll();

        // Listen for changes in reservations and approvals to update dashboard in real-time
        const channel = supabase
            .channel('admin_dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => loadAll())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_approvals' }, () => loadAll())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabaseUser?.id]);

    /* ===============================
       Helpers
    =============================== */
    const roomById = useMemo(() => {
        const m = new Map<string, RoomRow>();
        for (const r of rooms) m.set(r.id, r);
        return m;
    }, [rooms]);

    const profileById = useMemo(() => {
        const m = new Map<string, ProfileRow>();
        for (const p of profiles) m.set(p.id, p);
        return m;
    }, [profiles]);

    const stepKey = (chainId: string, stageNo: number) => `${chainId}__${stageNo}`;

    const stepByChainAndStage = useMemo(() => {
        const m = new Map<string, ChainStep>();
        for (const s of steps) {
            if (!s.chain_id) continue;
            m.set(stepKey(s.chain_id, s.stage_no), s);
        }
        return m;
    }, [steps]);

    // UI rows + หา step ของ stage ปัจจุบันเพื่อรู้ว่า "ใครต้องกด"
    const uiRows = useMemo<RowUI[]>(() => {
        return reservations.map((r) => {
            const room = roomById.get(r.room_id);
            const requester = profileById.get(r.requester_id);

            let myStep: ChainStep | null = null;
            if (r.chain_id) {
                const s = stepByChainAndStage.get(stepKey(r.chain_id, r.current_stage));
                if (s && s.approver_user_id === supabaseUser?.id) {
                    myStep = s;
                }
            }

            return { r, room, requester, myStep };
        });
    }, [reservations, roomById, profileById, stepByChainAndStage, supabaseUser?.id]);

    // โหมด: admin เห็นทั้งหมด / approver เห็นเฉพาะงานที่เป็น stage ของตัวเอง
    const visiblePendingRows = useMemo(() => {
        // กรองรายการที่ PENDING และไม่อยู่ในระหว่างประมวลผล (Optimistic Hide)
        const pending = uiRows.filter((x) => x.r.status === "PENDING" && !processingIds.has(x.r.id));

        // กรองออก: รายการที่ "ตัวเรา" (ผู้นำหรือแอดมิน) เคยร่วมตัดสินใจใน Stage ปัจจุบันไปแล้ว
        // เพื่อแก้ปัญหา "กดแล้วไม่หาย" แม้ DB trigger จะยังไม่เปลี่ยน Status/Stage
        const userId = supabaseUser?.id;
        const needsAction = pending.filter((x) => {
            if (!userId) return false;
            const approvals = (x.r as any).reservation_approvals || [];
            const alreadyActed = approvals.some(
                (a: any) => a.stage_no === x.r.current_stage && a.approver_user_id === userId
            );
            return !alreadyActed;
        });

        if (isAdmin) return needsAction;

        // approver: เห็นเฉพาะงานที่ chain_id มีและ stage ปัจจุบันเป็นของ user
        return needsAction.filter((x) => {
            if (!userId || !x.r.chain_id) return false;
            const s = stepByChainAndStage.get(stepKey(x.r.chain_id, x.r.current_stage));
            return !!s && s.approver_user_id === userId;
        });
    }, [uiRows, isAdmin, supabaseUser?.id, stepByChainAndStage, processingIds]);

    const pastRows = useMemo(() => {
        // admin เห็น history ทั้งหมด / approver เห็น history เฉพาะที่เกี่ยวกับตัวเองก็ได้
        // แต่เพื่อไม่ซับซ้อน: ให้ history แสดงเฉพาะ admin เท่านั้น
        if (!isAdmin) return [];
        return uiRows.filter((x) => x.r.status !== "PENDING");
    }, [uiRows, isAdmin]);

    /* ===============================
       Actions
       ✅ ตามแนว trigger: ฝั่ง UI ทำแค่ insert reservation_approvals
       DB จะ update reservations + ส่ง outbox เอง
    =============================== */

    const insertApprovalLog = async (args: {
        reservation_id: string;
        chain_id: string | null;
        stage_no: number;
        approver_user_id: string;
        decision: "APPROVED" | "REJECTED";
        decision_note?: string | null;
    }) => {
        const { error } = await supabase.from("reservation_approvals").insert({
            reservation_id: args.reservation_id,
            chain_id: args.chain_id,
            stage_no: args.stage_no,
            approver_user_id: args.approver_user_id,
            decision: args.decision,
            decision_note: args.decision_note ?? null,
            decided_at: new Date().toISOString(),
        });

        if (error) throw error;
    };

    const approve = async (row: RowUI) => {
        if (!supabaseUser?.id) return;
        const r = row.r;
        if (processingIds.has(r.id)) return;

        try {
            // gating (non-admin)
            if (!isAdmin) {
                if (!r.chain_id) {
                    alert("ใบจองนี้ยังไม่มี chain_id (ควรถูกเติมโดย trigger ตอนสร้างคำขอ)");
                    return;
                }
                const s = stepByChainAndStage.get(stepKey(r.chain_id, r.current_stage));
                if (!s || s.approver_user_id !== supabaseUser.id) {
                    alert("คุณไม่มีสิทธิ์อนุมัติขั้นนี้");
                    return;
                }
            }

            // Optimistic update: hide the row and disable buttons
            setProcessingIds(prev => new Set(prev).add(r.id));

            await insertApprovalLog({
                reservation_id: r.id,
                chain_id: r.chain_id,
                stage_no: r.current_stage,
                approver_user_id: supabaseUser.id,
                decision: "APPROVED",
            });

            // ✅ Notify the requester about the approval
            const requesterId = r.requester_id;
            const roomName = row.room?.name || "ห้องประชุม";

            // Check if this was the final stage or if it's still pending
            const { data: updatedRes } = await supabase
                .from("reservations")
                .select("status, current_stage")
                .eq("id", r.id)
                .single();

            const isFullyApproved = updatedRes?.status === "APPROVED";

            await supabase.from("notifications").insert({
                user_id: requesterId,
                title: isFullyApproved ? "คำขอจองห้องได้รับการอนุมัติแล้ว" : `คำขอจองห้องผ่านการอนุมัติขั้นที่ ${r.current_stage}`,
                message: isFullyApproved
                    ? `คำขอใช้ห้อง "${roomName}" หัวข้อ "${r.title}" ได้รับการอนุมัติครบทุกขั้นตอนแล้ว`
                    : `คำขอใช้ห้อง "${roomName}" หัวข้อ "${r.title}" ผ่านการอนุมัติในขั้นที่ ${r.current_stage} แล้ว ขณะนี้รอการอนุมัติในขั้นถัดไป`,
                type: isFullyApproved ? 'reservation_approved' : 'approval_update',
                is_read: false
            });

            // Small delay to allow DB triggers to finish updating reservation status
            setTimeout(async () => {
                await loadAll();
                setProcessingIds(prev => {
                    const next = new Set(prev);
                    next.delete(r.id);
                    return next;
                });
            }, 2000);
        } catch (e: any) {
            if (e.message?.includes("uq_ra_resv_stage_approver")) {
                alert("รายการนี้ได้รับการดำเนินการไปก่อนหน้านี้แล้ว ระบบจะอัปเดตข้อมูลให้ใหม่");
                loadAll();
            } else {
                alert("เกิดข้อผิดพลาด: " + e.message);
            }
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(r.id);
                return next;
            });
        }
    };

    const openReject = (row: RowUI) => {
        setRejectTarget(row);
        setRejectReason("");
        setRejectOpen(true);
    };

    const confirmReject = async () => {
        if (!supabaseUser?.id || !rejectTarget) return;
        const r = rejectTarget.r;
        if (processingIds.has(r.id)) return;

        const reason = rejectReason.trim();
        if (!reason) {
            alert("กรุณาระบุเหตุผลการปฏิเสธ");
            return;
        }

        try {
            // gating (non-admin)
            if (!isAdmin) {
                if (!r.chain_id) {
                    alert("ใบจองนี้ยังไม่มี chain_id (ควรถูกเติมโดย trigger ตอนสร้างคำขอ)");
                    return;
                }
                const s = stepByChainAndStage.get(stepKey(r.chain_id, r.current_stage));
                if (!s || s.approver_user_id !== supabaseUser.id) {
                    alert("คุณไม่มีสิทธิ์ปฏิเสธขั้นนี้");
                    return;
                }
            }

            // Optimistic update: hide the row and disable buttons
            setProcessingIds(prev => new Set(prev).add(r.id));

            await insertApprovalLog({
                reservation_id: r.id,
                chain_id: r.chain_id,
                stage_no: r.current_stage,
                approver_user_id: supabaseUser.id,
                decision: "REJECTED",
                decision_note: reason,
            });

            // ✅ Explicitly set reservation status to REJECTED to free up the time slot 
            // even if the trigger hasn't run or isn't designed for multi-stage rejection-to-global-status
            await supabase
                .from("reservations")
                .update({ status: "REJECTED" })
                .eq("id", r.id);

            // ✅ Notify the requester about the rejection
            const requesterId = r.requester_id;
            const roomName = rejectTarget.room?.name || "ห้องประชุม";

            await supabase.from("notifications").insert({
                user_id: requesterId,
                title: "คำขอจองห้องของคุณถูกปฏิเสธ",
                message: `คำขอใช้ห้อง "${roomName}" หัวข้อ "${r.title}" ไม่ผ่านการอนุมัติ\nเหตุผล: ${reason}`,
                type: 'reservation_rejected',
                is_read: false
            });

            setRejectOpen(false);
            setRejectTarget(null);
            setRejectReason("");

            setTimeout(async () => {
                await loadAll();
                setProcessingIds(prev => {
                    const next = new Set(prev);
                    next.delete(r.id);
                    return next;
                });
            }, 2000);
        } catch (e: any) {
            if (e.message?.includes("uq_ra_resv_stage_approver")) {
                alert("รายการนี้ได้รับการดำเนินการไปก่อนหน้านี้แล้ว ระบบจะอัปเดตข้อมูลให้ใหม่");
                setRejectOpen(false);
                loadAll();
            } else {
                alert("เกิดข้อผิดพลาด: " + e.message);
            }
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(r.id);
                return next;
            });
        }
    };

    /* ===============================
       Timeline
    =============================== */
    const openTimeline = async (row: RowUI) => {
        setTimelineOpen(true);
        setTimelineTitle(`${row.room?.name ?? "-"} • ${row.requester?.display_name ?? row.requester?.email ?? "-"}`);
        setTimelineLoading(true);
        setTimelineLogs([]);

        try {
            const { data, error } = await supabase
                .from("reservation_approvals")
                .select("id,reservation_id,chain_id,stage_no,approver_user_id,decision,decision_note,decided_at,created_at")
                .eq("reservation_id", row.r.id)
                .order("created_at", { ascending: true });

            if (error) throw error;

            setTimelineLogs((data || []) as ApprovalLog[]);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setTimelineLoading(false);
        }
    };

    const toggleAdmin = async (profileId: string, currentStatus: boolean) => {
        if (!isAdmin) return;
        if (profileId === supabaseUser?.id) return alert("You cannot change your own admin status");

        try {
            const { error } = await supabase
                .from("profiles")
                .update({ is_admin: !currentStatus })
                .eq("id", profileId);

            if (error) throw error;
            loadAll();
        } catch (e: any) {
            alert(e.message);
        }
    };

    /* ===============================
       Report Calculations
    =============================== */
    const stats = useMemo(() => {
        const total = reservations.length;
        const approved = reservations.filter(r => r.status === 'APPROVED').length;
        const rejected = reservations.filter(r => r.status === 'REJECTED').length;
        const cancelled = reservations.filter(r => r.status === 'CANCELLED').length;
        const pending = reservations.filter(r => r.status === 'PENDING').length;

        // Room popularity
        const roomPop: Record<string, number> = {};
        reservations.forEach(r => {
            roomPop[r.room_id] = (roomPop[r.room_id] || 0) + 1;
        });
        const topRooms = Object.entries(roomPop)
            .map(([id, count]) => ({ id, count, name: roomById.get(id)?.name || 'Unknown' }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return { total, approved, rejected, cancelled, pending, topRooms };
    }, [reservations, roomById]);

    /* ===============================
       UI states
    =============================== */

    if (authLoading || checkingAdmin) {
        return <div className="p-8 text-center text-gray-500">Loading...</div>;
    }

    if (!supabaseUser) {
        return (
            <div className="p-8 text-center bg-red-50 text-red-700 rounded-xl border border-red-100">
                <div className="font-semibold">Access Denied. Please sign in.</div>
            </div>
        );
    }

    if (loadingData) {
        return <div className="p-8 text-center text-gray-500">Loading reservations...</div>;
    }

    /* ===============================
       Render
    =============================== */

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {isAdmin ? "แดชบอร์ดผู้ดูเแลระบบ" : "แดชบอร์ดผู้อนุมัติ"}
                    </h1>
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Signed in: <b className="text-slate-900 dark:text-white">{supabaseUser.email ?? supabaseUser.id}</b>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={loadAll}
                        className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
                    >
                        รีเฟรช
                    </button>
                    {isAdmin && (
                        <Link
                            to="/admin/rooms/new"
                            className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-primary-200 dark:shadow-none"
                        >
                            <Plus className="w-4 h-4" /> เพิ่มห้องประชุม
                        </Link>
                    )}
                </div>
            </div>

            {/* Admin Tabs */}
            {isAdmin && (
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setActiveTab("reservations")}
                        className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'reservations' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        การจอง
                    </button>
                    <button
                        onClick={() => setActiveTab("rooms")}
                        className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'rooms' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        รายชื่อห้องประชุม
                    </button>
                    <button
                        onClick={() => setActiveTab("reports")}
                        className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'reports' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        รายงานและสถิติ
                    </button>
                    <button
                        onClick={() => setActiveTab("users")}
                        className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'users' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        จัดการผู้ใช้งาน
                    </button>
                </div>
            )}

            {activeTab === "reservations" && (
                <>
                    {/* Pending */}
                    <section>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                            <ClockIcon className="w-5 h-5 mr-2 text-yellow-500" />
                            รายการรออนุมัติ ({visiblePendingRows.length})
                        </h2>


                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                            {visiblePendingRows.length === 0 ? (
                                <div className="p-6 text-center text-gray-500 dark:text-slate-400">
                                    {isAdmin ? "No pending requests." : "ยังไม่มีรายการรออนุมัติของคุณ"}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {visiblePendingRows.map((row) => {
                                        const r = row.r;
                                        const room = row.room;
                                        const user = row.requester;

                                        const currentStep =
                                            r.chain_id ? stepByChainAndStage.get(stepKey(r.chain_id, r.current_stage)) : null;

                                        const approverProfile =
                                            currentStep ? profileById.get(currentStep.approver_user_id) : null;

                                        const canAct =
                                            isAdmin ||
                                            (!!currentStep && currentStep.approver_user_id === supabaseUser.id);

                                        return (
                                            <div
                                                key={r.id}
                                                className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <span className="font-bold text-gray-900 dark:text-white">{room?.name ?? "-"}</span>
                                                        <span className="text-gray-400 dark:text-slate-500">•</span>
                                                        <span className="text-primary-600 font-medium">
                                                            {user?.display_name ?? user?.email ?? r.requester_id}
                                                        </span>
                                                        <span className="text-gray-400 dark:text-slate-500">•</span>
                                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded">
                                                            Stage {r.current_stage}
                                                        </span>

                                                        {approverProfile && (
                                                            <span className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50">
                                                                ผู้อนุมัติขั้นนี้: {approverProfile.display_name ?? approverProfile.email}
                                                            </span>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => openTimeline(row)}
                                                            className="ml-0 lg:ml-2 text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center gap-1"
                                                        >
                                                            <MessageSquare className="w-4 h-4" />
                                                            Timeline
                                                        </button>
                                                    </div>

                                                    <p className="text-gray-600 dark:text-slate-400 text-sm mb-2">
                                                        <b className="text-gray-800 dark:text-slate-200">{r.title}</b> — {r.purpose}
                                                    </p>

                                                    <div className="flex flex-wrap items-center text-sm text-gray-500 dark:text-slate-400 gap-4">
                                                        <span className="flex items-center">
                                                            <Calendar className="w-4 h-4 mr-1.5" />
                                                            {format(new Date(r.start_at), "dd/MM/yyyy")}
                                                        </span>

                                                        <span className="flex items-center">
                                                            <ClockIcon className="w-4 h-4 mr-1.5" />
                                                            {format(new Date(r.start_at), "HH:mm")} - {format(new Date(r.end_at), "HH:mm")}
                                                        </span>

                                                        {r.setup_start_at && r.setup_end_at && (
                                                            <span className="text-xs bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded border border-yellow-200 dark:border-yellow-800/50">
                                                                Setup: {format(new Date(r.setup_start_at), "dd/MM HH:mm")} -{" "}
                                                                {format(new Date(r.setup_end_at), "dd/MM HH:mm")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        disabled={!canAct || processingIds.has(r.id)}
                                                        onClick={() => approve(row)}
                                                        className={`flex items-center px-4 py-2 rounded-lg transition ${canAct && !processingIds.has(r.id) ? "bg-green-600 text-white hover:bg-green-700" : "bg-slate-200 text-slate-500 cursor-not-allowed"
                                                            }`}
                                                    >
                                                        <Check className="w-4 h-4 mr-2" />
                                                        {processingIds.has(r.id) ? "กำลังบันทึก..." : "อนุมัติ"}
                                                    </button>

                                                    <button
                                                        disabled={!canAct || processingIds.has(r.id)}
                                                        onClick={() => openReject(row)}
                                                        className={`flex items-center px-4 py-2 rounded-lg transition ${canAct && !processingIds.has(r.id) ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-slate-200 text-slate-500 cursor-not-allowed"
                                                            }`}
                                                    >
                                                        <X className="w-4 h-4 mr-2" />
                                                        ปฏิเสธ
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {activeTab === "rooms" && isAdmin && (
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                        <LayoutGrid className="w-5 h-5 mr-2 text-indigo-500" />
                        จัดการห้องประชุม ({rooms.length})
                    </h2>
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50">
                                    <th className="p-4 text-sm font-semibold">ชื่อห้อง</th>
                                    <th className="p-4 text-sm font-semibold">สถานที่</th>
                                    <th className="p-4 text-sm font-semibold text-center">ความจุ</th>
                                    <th className="p-4 text-sm font-semibold">สถานะ</th>
                                    <th className="p-4 text-sm font-semibold text-right">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rooms.map(room => (
                                    <tr key={room.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-sm font-medium">{room.name}</td>
                                        <td className="p-4 text-sm text-gray-500">{(room as any).location || "-"}</td>
                                        <td className="p-4 text-sm text-center">{(room as any).capacity || "-"}</td>
                                        <td className="p-4 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase
                                                ${(room as any).status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {(room as any).status || 'unknown'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link
                                                to={`/admin/rooms/edit/${room.id}`}
                                                className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium text-sm"
                                            >
                                                <Edit2 className="w-3 h-3" /> แก้ไข
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === "reports" && isAdmin && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">การจองทั้งหมด</div>
                            <div className="text-3xl font-bold">{reservations.length} รายการ</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="text-sm text-emerald-500 mb-1">อนุมัติแล้ว</div>
                            <div className="text-3xl font-bold">{reservations.filter(r => r.status === 'APPROVED').length} รายการ</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="text-sm text-amber-500 mb-1">รอการอนุมัติ</div>
                            <div className="text-3xl font-bold">{reservations.filter(r => r.status === 'PENDING').length} รายการ</div>
                        </div>
                    </div>

                    <div className="bg-indigo-600 dark:bg-indigo-700 p-8 rounded-3xl text-white shadow-lg overflow-hidden relative">
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold mb-2">ออกรายงานสรุปผล</h3>
                            <p className="text-indigo-100 text-sm mb-6 max-w-md">ดาวน์โหลดข้อมูลการจองห้องประชุมทั้งหมดในรูปแบบ PDF หรือ Excel เพื่อนำไปใช้งานด้านธุรการ</p>
                            <div className="flex gap-4">
                                <button
                                    className="px-6 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
                                    onClick={() => alert('ฟีเจอร์นี้ต้องใช้ไลบรารี jsPDF / ExcelJS')}
                                >
                                    ดาวน์โหลด PDF
                                </button>
                                <button
                                    className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-400 transition-colors border border-indigo-400"
                                    onClick={() => alert('ฟีเจอร์นี้ต้องใช้ไลบรารี jsPDF / ExcelJS')}
                                >
                                    ดาวน์โหลด Excel
                                </button>
                            </div>
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl"></div>
                    </div>
                </div>
            )}


            {/* History (เฉพาะ admin) */}
            {isAdmin && (
                <section className="opacity-75">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">ประวัติการจอง</h2>


                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {pastRows.slice(0, 10).map((row) => {
                                const r = row.r;
                                const room = row.room;
                                const user = row.requester;

                                return (
                                    <div key={r.id} className="p-4 flex justify-between items-center text-sm">
                                        <div className="min-w-0">
                                            <span className="font-medium dark:text-white">{room?.name ?? "-"}</span>
                                            <span className="mx-2 text-gray-300 dark:text-slate-600">|</span>
                                            <span className="text-gray-600 dark:text-slate-400">{user?.display_name ?? user?.email ?? "-"}</span>
                                            <span className="mx-2 text-gray-300 dark:text-slate-600">|</span>
                                            <span className="text-gray-500 dark:text-slate-500">{format(new Date(r.start_at), "dd/MM/yyyy HH:mm")}</span>
                                        </div>

                                        <div className="flex flex-col items-end">
                                            <span
                                                className={
                                                    r.status === "APPROVED"
                                                        ? "text-green-600 dark:text-emerald-400"
                                                        : r.status === "REJECTED"
                                                            ? "text-red-600 dark:text-red-400"
                                                            : "text-gray-600 dark:text-slate-400"
                                                }
                                            >
                                                {r.status}
                                            </span>
                                            {r.status === "REJECTED" && (
                                                <div className="text-[10px] text-red-500 mt-0.5 max-w-[150px] truncate" title={r.reservation_approvals?.find((a: any) => a.decision === "REJECTED")?.decision_note || undefined}>
                                                    {r.reservation_approvals?.find((a: any) => a.decision === "REJECTED")?.decision_note || "ไม่ระบุเหตุผล"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "reports" && isAdmin && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">ทั้งหมด</div>
                            <div className="text-3xl font-bold dark:text-white">{stats.total}</div>
                            <div className="text-xs text-slate-400 mt-1">รายการสะสม</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="text-sm font-medium text-emerald-500 mb-1">อนุมัติแล้ว</div>
                            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.approved}</div>
                            <div className="text-xs text-slate-400 mt-1">{((stats.approved / (stats.total || 1)) * 100).toFixed(1)}% ของทั้งหมด</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="text-sm font-medium text-red-500 mb-1">ปฏิเสธแล้ว</div>
                            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</div>
                            <div className="text-xs text-slate-400 mt-1">{((stats.rejected / (stats.total || 1)) * 100).toFixed(1)}% ของทั้งหมด</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="text-sm font-medium text-amber-500 mb-1">รออนุมัติ</div>
                            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
                            <div className="text-xs text-slate-400 mt-1">รายการคงค้าง</div>
                        </div>
                    </div>

                    {/* Popular Rooms */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">5 อันดับห้องประชุมที่ถูกใช้งานมากที่สุด</h3>
                        <div className="space-y-4">
                            {stats.topRooms.map((room, idx) => (
                                <div key={room.id} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 text-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1.5">
                                            <span className="font-medium dark:text-slate-200">{room.name}</span>
                                            <span className="text-slate-500 dark:text-slate-400 text-sm">{room.count} ครั้ง</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${(room.count / (stats.topRooms[0]?.count || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "users" && isAdmin && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">ชื่อผู้ใช้งาน</th>
                                    <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">อีเมล</th>
                                    <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">สิทธิ์ Admin</th>
                                    <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {profiles.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-white">{p.display_name || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{p.email}</td>
                                        <td className="px-6 py-4">
                                            {p.is_admin ? (
                                                <span className="px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold">YES</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">NO</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {p.id !== supabaseUser.id ? (
                                                <button
                                                    onClick={() => toggleAdmin(p.id, p.is_admin || false)}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${p.is_admin ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900 dark:hover:bg-indigo-900/20'}`}
                                                >
                                                    {p.is_admin ? 'ถอดสิทธิ์ Admin' : 'แต่งตั้งเป็น Admin'}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">บัญชีของคุณ</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {errorMsg && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl p-4">
                    {errorMsg}
                </div>
            )}

            {/* Reject modal */}
            {rejectOpen && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border dark:border-slate-800">
                        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-800">
                            <div className="font-semibold text-gray-900 dark:text-white">ระบุเหตุผลการปฏิเสธ (บังคับ)</div>
                            <button
                                onClick={() => setRejectOpen(false)}
                                className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center dark:text-slate-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3">
                            <textarea
                                rows={4}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full border dark:border-slate-700 rounded-xl p-3 text-sm dark:bg-slate-800 dark:text-white"
                                placeholder="โปรดระบุเหตุผล เช่น เวลาชน / วัตถุประสงค์ไม่ชัดเจน / เอกสารไม่ครบ"
                            />

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    disabled={processingIds.has(rejectTarget?.r?.id ?? "")}
                                    onClick={() => setRejectOpen(false)}
                                    className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    disabled={processingIds.has(rejectTarget?.r?.id ?? "")}
                                    onClick={confirmReject}
                                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300"
                                >
                                    {processingIds.has(rejectTarget?.r?.id ?? "") ? "กำลังบันทึก..." : "ยืนยัน Reject"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline modal */}
            {timelineOpen && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border dark:border-slate-800">
                        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-800">
                            <div>
                                <div className="text-xs text-gray-500 dark:text-slate-400">Timeline</div>
                                <div className="font-semibold text-gray-900 dark:text-white">{timelineTitle}</div>
                            </div>
                            <button
                                onClick={() => setTimelineOpen(false)}
                                className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center dark:text-slate-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            {timelineLoading ? (
                                <div className="text-center text-gray-500 dark:text-slate-400 py-10">Loading timeline...</div>
                            ) : timelineLogs.length === 0 ? (
                                <div className="text-center text-gray-500 dark:text-slate-400 py-10">ยังไม่มีการตัดสินใจในระบบ</div>
                            ) : (
                                <div className="space-y-3">
                                    {timelineLogs.map((l) => {
                                        const who = profileById.get(l.approver_user_id);
                                        return (
                                            <div key={l.id} className="border dark:border-slate-700 rounded-xl p-4">
                                                <div className="flex justify-between flex-wrap gap-2">
                                                    <div className="font-medium dark:text-white">
                                                        Stage {l.stage_no} • {l.decision}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-slate-400">
                                                        {l.decided_at ? format(new Date(l.decided_at), "dd/MM/yyyy HH:mm") : ""}
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                                                    โดย: {who?.display_name ?? who?.email ?? l.approver_user_id}
                                                </div>
                                                {l.decision === "REJECTED" && l.decision_note && (
                                                    <div className="text-sm mt-2 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-lg p-3">
                                                        เหตุผล: {l.decision_note}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
