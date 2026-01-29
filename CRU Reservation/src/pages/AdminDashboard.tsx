import { useEffect, useMemo, useState } from "react";
import { Check, X, Clock as ClockIcon, Calendar, MessageSquare } from "lucide-react";
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
    setup_end_at: string | null;
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
                        "id,room_id,requester_id,title,purpose,start_at,end_at,status,current_stage,chain_id,setup_date,setup_start,setup_end,setup_start_at,setup_end_at"
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
        if (supabaseUser?.id) loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const pending = uiRows.filter((x) => x.r.status === "PENDING");

        if (isAdmin) return pending;

        // approver: เห็นเฉพาะงานที่ chain_id มีและ stage ปัจจุบันเป็นของ user
        return pending.filter((x) => {
            if (!supabaseUser?.id) return false;
            if (!x.r.chain_id) return false;
            const s = stepByChainAndStage.get(stepKey(x.r.chain_id, x.r.current_stage));
            return !!s && s.approver_user_id === supabaseUser.id;
        });
    }, [uiRows, isAdmin, supabaseUser?.id, stepByChainAndStage]);

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

        try {
            const r = row.r;

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

            await insertApprovalLog({
                reservation_id: r.id,
                chain_id: r.chain_id,
                stage_no: r.current_stage,
                approver_user_id: supabaseUser.id,
                decision: "APPROVED",
            });

            await loadAll();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const openReject = (row: RowUI) => {
        setRejectTarget(row);
        setRejectReason("");
        setRejectOpen(true);
    };

    const confirmReject = async () => {
        if (!supabaseUser?.id || !rejectTarget) return;

        const reason = rejectReason.trim();
        if (!reason) {
            alert("กรุณาระบุเหตุผลการปฏิเสธ");
            return;
        }

        try {
            const r = rejectTarget.r;

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

            await insertApprovalLog({
                reservation_id: r.id,
                chain_id: r.chain_id,
                stage_no: r.current_stage,
                approver_user_id: supabaseUser.id,
                decision: "REJECTED",
                decision_note: reason, // ✅ บังคับเหตุผล (DB ก็ check อีกชั้น)
            });

            setRejectOpen(false);
            setRejectTarget(null);
            setRejectReason("");

            await loadAll();
        } catch (e: any) {
            alert(e.message);
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isAdmin ? "Admin Dashboard" : "Approver Dashboard"}
                    </h1>
                    <div className="text-xs text-gray-500 mt-1">
                        Signed in: <b>{supabaseUser.email ?? supabaseUser.id}</b>
                    </div>
                </div>

                <button
                    onClick={loadAll}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium"
                >
                    Refresh
                </button>
            </div>

            {/* Pending */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <ClockIcon className="w-5 h-5 mr-2 text-yellow-500" />
                    Pending Approvals ({visiblePendingRows.length})
                </h2>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {visiblePendingRows.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                            {isAdmin ? "No pending requests." : "ยังไม่มีรายการรออนุมัติของคุณ"}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
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
                                                <span className="font-bold text-gray-900">{room?.name ?? "-"}</span>
                                                <span className="text-gray-400">•</span>
                                                <span className="text-primary-600 font-medium">
                                                    {user?.display_name ?? user?.email ?? r.requester_id}
                                                </span>
                                                <span className="text-gray-400">•</span>
                                                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                                                    Stage {r.current_stage}
                                                </span>

                                                {approverProfile && (
                                                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                                                        ผู้อนุมัติขั้นนี้: {approverProfile.display_name ?? approverProfile.email}
                                                    </span>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => openTimeline(row)}
                                                    className="ml-0 lg:ml-2 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 flex items-center gap-1"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                    Timeline
                                                </button>
                                            </div>

                                            <p className="text-gray-600 text-sm mb-2">
                                                <b className="text-gray-800">{r.title}</b> — {r.purpose}
                                            </p>

                                            <div className="flex flex-wrap items-center text-sm text-gray-500 gap-4">
                                                <span className="flex items-center">
                                                    <Calendar className="w-4 h-4 mr-1.5" />
                                                    {format(new Date(r.start_at), "dd/MM/yyyy")}
                                                </span>

                                                <span className="flex items-center">
                                                    <ClockIcon className="w-4 h-4 mr-1.5" />
                                                    {format(new Date(r.start_at), "HH:mm")} - {format(new Date(r.end_at), "HH:mm")}
                                                </span>

                                                {r.setup_start_at && r.setup_end_at && (
                                                    <span className="text-xs bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">
                                                        Setup: {format(new Date(r.setup_start_at), "dd/MM HH:mm")} -{" "}
                                                        {format(new Date(r.setup_end_at), "dd/MM HH:mm")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                disabled={!canAct}
                                                onClick={() => approve(row)}
                                                className={`flex items-center px-4 py-2 rounded-lg transition ${canAct ? "bg-green-600 text-white hover:bg-green-700" : "bg-slate-200 text-slate-500 cursor-not-allowed"
                                                    }`}
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                Approve
                                            </button>

                                            <button
                                                disabled={!canAct}
                                                onClick={() => openReject(row)}
                                                className={`flex items-center px-4 py-2 rounded-lg transition ${canAct ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-slate-200 text-slate-500 cursor-not-allowed"
                                                    }`}
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

            {/* History (เฉพาะ admin) */}
            {isAdmin && (
                <section className="opacity-75">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">History</h2>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {pastRows.slice(0, 10).map((row) => {
                                const r = row.r;
                                const room = row.room;
                                const user = row.requester;

                                return (
                                    <div key={r.id} className="p-4 flex justify-between items-center text-sm">
                                        <div className="min-w-0">
                                            <span className="font-medium">{room?.name ?? "-"}</span>
                                            <span className="mx-2 text-gray-300">|</span>
                                            <span className="text-gray-600">{user?.display_name ?? user?.email ?? "-"}</span>
                                            <span className="mx-2 text-gray-300">|</span>
                                            <span className="text-gray-500">{format(new Date(r.start_at), "dd/MM/yyyy HH:mm")}</span>
                                        </div>

                                        <span
                                            className={
                                                r.status === "APPROVED"
                                                    ? "text-green-600"
                                                    : r.status === "REJECTED"
                                                        ? "text-red-600"
                                                        : "text-gray-600"
                                            }
                                        >
                                            {r.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {errorMsg && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
                    {errorMsg}
                </div>
            )}

            {/* Reject modal */}
            {rejectOpen && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <div className="font-semibold text-gray-900">ระบุเหตุผลการปฏิเสธ (บังคับ)</div>
                            <button
                                onClick={() => setRejectOpen(false)}
                                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3">
                            <textarea
                                rows={4}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full border rounded-xl p-3 text-sm"
                                placeholder="โปรดระบุเหตุผล เช่น เวลาชน / วัตถุประสงค์ไม่ชัดเจน / เอกสารไม่ครบ"
                            />

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRejectOpen(false)}
                                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmReject}
                                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                                >
                                    ยืนยัน Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline modal */}
            {timelineOpen && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <div>
                                <div className="text-xs text-gray-500">Timeline</div>
                                <div className="font-semibold text-gray-900">{timelineTitle}</div>
                            </div>
                            <button
                                onClick={() => setTimelineOpen(false)}
                                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            {timelineLoading ? (
                                <div className="text-center text-gray-500 py-10">Loading timeline...</div>
                            ) : timelineLogs.length === 0 ? (
                                <div className="text-center text-gray-500 py-10">ยังไม่มีการตัดสินใจในระบบ</div>
                            ) : (
                                <div className="space-y-3">
                                    {timelineLogs.map((l) => {
                                        const who = profileById.get(l.approver_user_id);
                                        return (
                                            <div key={l.id} className="border rounded-xl p-4">
                                                <div className="flex justify-between flex-wrap gap-2">
                                                    <div className="font-medium">
                                                        Stage {l.stage_no} • {l.decision}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {l.decided_at ? format(new Date(l.decided_at), "dd/MM/yyyy HH:mm") : ""}
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    โดย: {who?.display_name ?? who?.email ?? l.approver_user_id}
                                                </div>
                                                {l.decision === "REJECTED" && l.decision_note && (
                                                    <div className="text-sm mt-2 text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
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
