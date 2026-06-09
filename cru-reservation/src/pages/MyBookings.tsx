import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Loader2, AlertCircle, Check, X, Info } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';

type Reservation = {
    id: string;
    room_id: string;
    requester_id: string;
    title: string;
    purpose: string;
    start_at: string;
    end_at: string;
    setup_start_at?: string;
    setup_end_at?: string;
    status: string;
    current_stage: number;
    chain_id?: string;
    created_at: string;
    reservation_approvals?: {
        id: string;
        stage_no: number;
        approver_user_id: string;
        decision: string;
        decision_note: string | null;
        decided_at: string;
        approver?: {
            display_name: string;
            avatar_url: string | null;
        } | null;
    }[];
    rooms?: {
        id: string;
        name: string;
        location: string | null;
    } | null;
};

const MyBookings = () => {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<Reservation[]>([]);
    const [steps, setSteps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Custom Alert/Confirm Modal
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertType, setAlertType] = useState<"info" | "success" | "warning" | "error" | "confirm">("info");
    const [pendingAction, setPendingAction] = useState<{ id: string } | null>(null);

    // Timeline & Detail State
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [activeTimeline, setActiveTimeline] = useState<Reservation | null>(null);

    const [detailOpen, setDetailOpen] = useState(false);
    const [activeDetail, setActiveDetail] = useState<Reservation | null>(null);

    const showCustomAlert = (title: string, message: string, type: "info" | "success" | "warning" | "error" | "confirm" = "info", target?: { id: string }) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertType(type);
        setPendingAction(target || null);
        setAlertOpen(true);
    };

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [bRes, sRes] = await Promise.all([
                supabase
                    .from('reservations')
                    .select(`
                        *, 
                        room:rooms(id, name, location),
                        reservation_approvals(
                            id, 
                            decision, 
                            decision_note, 
                            stage_no, 
                            decided_at,
                            approver:profiles(display_name, avatar_url)
                        )
                    `)
                    .eq('requester_id', user.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('approver_chain_steps')
                    .select('*')
                    .eq('is_active', true)
            ]);

            if (bRes.error) throw bRes.error;
            if (sRes.error) throw sRes.error;

            setBookings(bRes.data || []);
            setSteps(sRes.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Real-time updates
        const channel = supabase
            .channel('my_bookings_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `requester_id=eq.${user?.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_approvals' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const getStatusColor = (status: string) => {
        const s = status.toUpperCase();
        if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
        if (s === 'REJECTED' || s === 'CANCELLED') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50';
        if (s === 'PENDING') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    };

    const getStatusThai = (booking: any) => {
        const s = (booking.status || "").toUpperCase();
        if (s === 'APPROVED') return 'อนุมัติแล้ว';
        if (s === 'REJECTED') return 'ปฏิเสธ';
        if (s === 'CANCELLED') return 'ยกเลิกแล้ว';
        if (s === 'PENDING') {
            return `รออนุมัติ (ขั้นที่ ${booking.current_stage || 1})`;
        }
        return booking.status;
    };

    const executeCancel = async (id: string) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: 'CANCELLED' })
                .eq('id', id);
            if (error) throw error;

            const { data: admins } = await supabase.from("profiles").select("id").eq("is_admin", true);
            if (admins && admins.length > 0) {
                const booking = bookings.find(b => b.id === id);
                const roomName = booking?.rooms?.name || "ประชุม";

                const adminNotifs = admins.map(admin => ({
                    user_id: admin.id,
                    title: "รายการจองถูกยกเลิก",
                    message: `คุณ ${user?.user_metadata?.full_name || 'ผู้ใช้งาน'} ได้ยกเลิกรายการจองห้อง "${roomName}" (หัวข้อ: ${booking?.title || 'ไม่มีหัวข้อ'})`,
                    type: 'status_change',
                    is_read: false
                }));
                await supabase.from("notifications").insert(adminNotifs);
            }
            showCustomAlert("ยกเลิกสำเร็จ", "รายการจองของคุณถูกยกเลิกเรียบร้อยแล้ว", "success");
            fetchData();
        } catch (e: any) {
            showCustomAlert("เกิดข้อผิดพลาด", e.message, "error");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>กำลังโหลดรายการจอง...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">การจองของฉัน</h1>
            </div>

            <div>
                {bookings.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-20 text-center text-gray-500 dark:text-slate-400 flex flex-col items-center shadow-sm">
                        <Calendar className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-700" />
                        <p className="text-lg font-bold">คุณยังไม่มีรายการจองห้องประชุม</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.map(booking => {
                            const room = (booking as any).room || (booking as any).rooms;
                            const roomName = room?.name || `ไม่ทราบชื่อห้อง (${booking.room_id.slice(0, 8)})`;
                            const roomLocation = room?.location || 'ไม่ระบุสถานที่';
                            const startDate = new Date(booking.start_at);
                            const endDate = new Date(booking.end_at);
                            const rejection = booking.reservation_approvals?.find((a: any) => a.decision === 'REJECTED');

                            const handleCancel = () => {
                                showCustomAlert("ยืนยันการยกเลิก", "คุณต้องการยกเลิกรายการจองนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้", "confirm", { id: booking.id });
                            };

                            return (
                                <div 
                                    key={booking.id} 
                                    className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group cursor-pointer"
                                    onClick={() => {
                                        setActiveDetail(booking);
                                        setDetailOpen(true);
                                    }}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                                        <div className="space-y-3 flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {roomName}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${getStatusColor(booking.status)}`}>
                                                    {getStatusThai(booking)}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{booking.title}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{booking.purpose}</p>
                                            </div>

                                            {booking.status === 'PENDING' && (
                                                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 mt-2">
                                                    <div className="flex items-center justify-between mb-2 text-[10px]">
                                                        <span className="font-bold text-slate-400 uppercase tracking-wider">ขั้นตอนการอนุมัติ (Approval Progress)</span>
                                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">รอขั้นตอนที่ {booking.current_stage}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {(() => {
                                                            const chainSteps = steps.filter(s => s.chain_id === booking.chain_id);
                                                            const totalS = chainSteps.length > 0 ? Math.max(...chainSteps.map(s => s.stage_no)) : 2;

                                                            return Array.from({ length: totalS }, (_, i) => i + 1).map(sNum => (
                                                                <React.Fragment key={sNum}>
                                                                    <div className="flex-1">
                                                                        <div className={`h-1.5 rounded-full mb-1 transition-all duration-500 ${booking.current_stage > sNum ? 'bg-green-500' : booking.current_stage === sNum ? 'bg-amber-400 animate-pulse' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                                                                        <div className={`text-[9px] text-center ${booking.current_stage >= sNum ? 'font-bold text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                            {sNum === 1 ? 'พิจารณาขั้นต้น' : 'ผู้อนุมัติสุดท้าย'}
                                                                        </div>
                                                                    </div>
                                                                    {sNum < totalS && <div className="w-4 h-[1px] bg-slate-200 dark:bg-slate-800 mb-3"></div>}
                                                                </React.Fragment>
                                                            ));
                                                        })()}
                                                    </div>
                                                </div>
                                            )}

                                            {rejection && (
                                                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-955/20 border border-red-100 dark:border-red-900/30 rounded-xl mt-2">
                                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                    <div className="text-xs">
                                                        <span className="font-bold text-red-700 dark:text-red-400">ปฏิเสธเนื่องจาก: </span>
                                                        <span className="text-red-600 dark:text-red-300/80">{rejection.decision_note || 'ไม่ระบุเหตุผล'}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-2 flex flex-wrap items-center gap-3">
                                                {booking.status.toUpperCase() === 'PENDING' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                                                        className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-xl transition-colors active:scale-95 duration-150 cursor-pointer"
                                                    >
                                                        ยกเลิกการจอง
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveTimeline(booking);
                                                        setTimelineOpen(true);
                                                    }}
                                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-xl transition-colors active:scale-95 duration-150 cursor-pointer"
                                                >
                                                    Timeline อนุมัติ
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDetail(booking);
                                                        setDetailOpen(true);
                                                    }}
                                                    className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-colors active:scale-95 duration-150 flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Info className="w-3.5 h-3.5" /> ดูรายละเอียด
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-row lg:flex-col flex-wrap lg:flex-nowrap gap-3 text-[11px] font-black text-slate-500 dark:text-slate-400 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-4 lg:pt-0 lg:pl-6 min-w-fit">
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                                                <span className="uppercase tracking-tight">{format(startDate, 'd MMMM yyyy', { locale: th })}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <Clock className="w-4 h-4 mr-2 text-indigo-500" />
                                                <span className="uppercase tracking-tight">{format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')} น.</span>
                                            </div>
                                            <div className="flex items-center">
                                                <MapPin className="w-4 h-4 mr-2 text-indigo-500" />
                                                <span className="uppercase tracking-tight truncate max-w-[150px]">{roomLocation}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Booking Detail Modal */}
            {detailOpen && activeDetail && (
                <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
                     onClick={(e) => {
                          if (e.target === e.currentTarget) setDetailOpen(false);
                      }}>
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 sm:p-8 max-w-xl w-full shadow-2xl transform animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar gap-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">รายละเอียดการจอง</h3>
                                <div className="mt-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${getStatusColor(activeDetail.status)}`}>
                                        {getStatusThai(activeDetail)}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setDetailOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
                                <X className="w-6 h-6 text-slate-500" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ห้องที่จอง</div>
                                <div className="text-lg font-bold text-gray-900 dark:text-white">{(activeDetail as any).room?.name || 'ไม่ระบุห้อง'}</div>
                                <div className="text-sm text-slate-500">{(activeDetail as any).room?.location || 'ไม่ระบุสถานที่'}</div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">หัวข้อและวัตถุประสงค์</div>
                                <div className="text-base font-bold text-gray-900 dark:text-white mb-2">{activeDetail.title}</div>
                                <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{activeDetail.purpose}</div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                    <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">วันและเวลาใช้งานจริง</div>
                                    <div className="text-sm font-bold text-indigo-900 dark:text-white mb-1">
                                        {format(new Date(activeDetail.start_at), 'd MMM yyyy', { locale: th })} 
                                        {format(new Date(activeDetail.start_at), 'd MMM yyyy') !== format(new Date(activeDetail.end_at), 'd MMM yyyy') && 
                                            ` - ${format(new Date(activeDetail.end_at), 'd MMM yyyy', { locale: th })}`
                                        }
                                    </div>
                                    <div className="text-xs text-indigo-700 dark:text-indigo-300">
                                        {format(new Date(activeDetail.start_at), 'HH:mm')} - {format(new Date(activeDetail.end_at), 'HH:mm')} น.
                                    </div>
                                </div>

                                {activeDetail.setup_start_at ? (
                                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
                                        <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase tracking-widest mb-1">จัดเตรียมห้องล่วงหน้า</div>
                                        <div className="text-sm font-bold text-yellow-900 dark:text-white mb-1">
                                            {format(new Date(activeDetail.setup_start_at), 'd MMM yyyy', { locale: th })}
                                            {activeDetail.setup_end_at && format(new Date(activeDetail.setup_start_at), 'd MMM yyyy') !== format(new Date(activeDetail.setup_end_at), 'd MMM yyyy') && 
                                                ` - ${format(new Date(activeDetail.setup_end_at), 'd MMM yyyy', { locale: th })}`
                                            }
                                        </div>
                                        <div className="text-xs text-yellow-700 dark:text-yellow-300">
                                            {format(new Date(activeDetail.setup_start_at), 'HH:mm')} - {activeDetail.setup_end_at ? format(new Date(activeDetail.setup_end_at), 'HH:mm') : 'เสร็จสิ้นก่อนเริ่มงาน'} น.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 opacity-60">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">การจัดเตรียมห้องล่วงหน้า</div>
                                        <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2">ไม่ต้องการเวลาจัดเตรียม</div>
                                    </div>
                                )}
                            </div>

                            {/* Integrated Approval Timeline */}
                            <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">ลำดับขั้นตอนการอนุมัติ</div>
                                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 pl-6 space-y-6 pb-2">
                                    {/* Step 1: Requested */}
                                    <div className="relative">
                                        <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-950"></div>
                                        <div className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-0.5">ส่งคำขอจอง</div>
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">ผู้ขอใช้: {user?.user_metadata?.full_name || 'คุณ (ผู้จอง)'}</div>
                                        <div className="text-[10px] text-slate-500">{format(new Date(activeDetail.created_at), 'd MMM yyyy HH:mm', { locale: th })} น.</div>
                                    </div>

                                    {/* Approval Steps */}
                                    {activeDetail.reservation_approvals && activeDetail.reservation_approvals.length > 0 ? (
                                        [...activeDetail.reservation_approvals].sort((a, b) => a.stage_no - b.stage_no).map((approval) => {
                                            const isApproved = approval.decision === 'APPROVED';
                                            return (
                                                <div key={approval.id} className="relative">
                                                    <div className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full ring-4 dark:ring-slate-950 ${isApproved ? 'bg-emerald-500 ring-emerald-100' : 'bg-red-500 ring-red-100'}`}></div>
                                                    <div className={`text-[9px] font-black uppercase tracking-wider mb-0.5 ${isApproved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {isApproved ? `อนุมัติขั้นตอนที่ ${approval.stage_no}` : `ปฏิเสธขั้นตอนที่ ${approval.stage_no}`}
                                                    </div>
                                                    <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        {approval.approver?.avatar_url && (
                                                            <img src={approval.approver.avatar_url} className="w-4 h-4 rounded-full object-cover" alt="" />
                                                        )}
                                                        โดย: {approval.approver?.display_name || 'เจ้าหน้าที่'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">{format(new Date(approval.decided_at), 'd MMM yyyy HH:mm', { locale: th })} น.</div>
                                                    {approval.decision_note && (
                                                        <div className="mt-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 italic">
                                                            "{approval.decision_note}"
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : null}

                                    {/* Next Pending step */}
                                    {activeDetail.status === 'PENDING' && (
                                        <div className="relative opacity-60">
                                            <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">ขั้นตอนถัดไป</div>
                                            <div className="text-sm font-bold text-slate-500 italic">รอพิจารณาอนุมัติ (ขั้นที่ {activeDetail.current_stage})...</div>
                                        </div>
                                    )}

                                    {/* Final Status */}
                                    {activeDetail.status === 'APPROVED' && (
                                        <div className="relative">
                                            <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-emerald-100 dark:ring-emerald-950"></div>
                                            <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">เสร็จสมบูรณ์</div>
                                            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">การจองเสร็จสมบูรณ์ (อนุมัติแล้ว)</div>
                                        </div>
                                    )}

                                    {activeDetail.status === 'CANCELLED' && (
                                        <div className="relative">
                                            <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-red-600 ring-4 ring-red-100 dark:ring-red-950"></div>
                                            <div className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider mb-0.5">ยกเลิกแล้ว</div>
                                            <div className="text-sm font-bold text-red-700 dark:text-red-400">รายการนี้ถูกยกเลิกแล้ว</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-5 flex justify-end">
                            <button
                                onClick={() => setDetailOpen(false)}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl font-bold transition-all active:scale-95 cursor-pointer text-sm shadow-sm"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline Modal */}
            {timelineOpen && activeTimeline && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                     onClick={(e) => {
                          if (e.target === e.currentTarget) setTimelineOpen(false);
                      }}>
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl transform animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 border border-white/20 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Timeline การอนุมัติ</h3>
                            <button onClick={() => setTimelineOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
                                <X className="w-6 h-6 text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 py-4 custom-scrollbar">
                            <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-4 pl-8 space-y-10 pb-4">
                                {/* Requester (Initial Step) */}
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-primary-500 ring-4 ring-primary-100 dark:ring-primary-900/30"></div>
                                    <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">ส่งคำขอจอง</p>
                                    <h4 className="font-bold text-gray-900 dark:text-white mb-1">โดย {user?.user_metadata?.full_name || 'คุณ (ผู้จอง)'}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{format(new Date(activeTimeline.created_at), 'd MMM yyyy HH:mm', { locale: th })} น.</p>
                                </div>

                                {/* Approval Steps */}
                                {activeTimeline.reservation_approvals && activeTimeline.reservation_approvals.length > 0 ? (
                                    [...activeTimeline.reservation_approvals].sort((a, b) => a.stage_no - b.stage_no).map((approval) => {
                                        const isApproved = approval.decision === 'APPROVED';
                                        return (
                                            <div key={approval.id} className="relative group">
                                                <div className={`absolute -left-[41px] top-0 w-4 h-4 rounded-full ring-4 transition-all ${isApproved ? 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-900/30' : 'bg-red-500 ring-red-100 dark:ring-red-900/30'}`}></div>
                                                <div className="space-y-1">
                                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isApproved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {isApproved ? `อนุมัติขั้นที่ ${approval.stage_no}` : `ปฏิเสธขั้นที่ ${approval.stage_no}`}
                                                    </p>
                                                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                        {approval.approver?.avatar_url && (
                                                            <img src={approval.approver.avatar_url} className="w-5 h-5 rounded-full object-cover border border-slate-200" alt="" />
                                                        )}
                                                        โดย {approval.approver?.display_name || 'ผู้อนุมัติ'}
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                                        {format(new Date(approval.decided_at), 'd MMM yyyy HH:mm', { locale: th })} น.
                                                    </p>
                                                    {approval.decision_note && (
                                                        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/100 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed italic">"{approval.decision_note}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="relative opacity-50">
                                        <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ขั้นตอนถัดไป</p>
                                        <h4 className="font-bold text-slate-400 italic">อยู่ระหว่างการพิจารณา...</h4>
                                    </div>
                                )}

                                {/* Final Status Reflection */}
                                {activeTimeline.status === 'APPROVED' && (
                                    <div className="relative">
                                        <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-emerald-600 ring-8 ring-emerald-500/10 animate-pulse"></div>
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">เสร็จสมบูรณ์</p>
                                        <h4 className="font-bold text-emerald-700 dark:text-emerald-400">อนุมัติเรียบร้อยทุกขั้นตอน</h4>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={() => setTimelineOpen(false)}
                                className="w-full py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-[2rem] font-black text-lg transition-all active:scale-95 cursor-pointer"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Custom Alert & Confirm Modal */}
            {alertOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl transform animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 border border-white/20 dark:border-slate-800">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 ${alertType === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                alertType === 'error' ? 'bg-red-100 text-red-600' :
                                    alertType === 'warning' || alertType === 'confirm' ? 'bg-amber-100 text-amber-600' :
                                        'bg-indigo-100 text-indigo-600'
                                }`}>
                                {alertType === 'success' && <Check className="w-12 h-12" />}
                                {alertType === 'error' && <X className="w-12 h-12" />}
                                {alertType === 'warning' && <AlertCircle className="w-12 h-12" />}
                                {alertType === 'confirm' && <AlertCircle className="w-12 h-12" />}
                                {alertType === 'info' && <Calendar className="w-12 h-12" />}
                            </div>

                            <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter">
                                {alertTitle}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-10 text-lg">
                                {alertMessage}
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                {alertType === 'confirm' ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                if (pendingAction) executeCancel(pendingAction.id);
                                                setAlertOpen(false);
                                            }}
                                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-3xl font-black text-lg shadow-xl shadow-red-200 dark:shadow-none transition-all active:scale-95 cursor-pointer"
                                        >
                                            ยืนยันยกเลิก
                                        </button>
                                        <button
                                            onClick={() => setAlertOpen(false)}
                                            className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-3xl font-black text-lg transition-all active:scale-95 cursor-pointer"
                                        >
                                            ย้อนกลับ
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setAlertOpen(false)}
                                        className={`w-full py-4 rounded-3xl font-black text-lg text-white transition-all active:scale-95 shadow-xl cursor-pointer ${alertType === 'success' ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700' :
                                            alertType === 'error' ? 'bg-red-600 shadow-red-200 hover:bg-red-700' :
                                                alertType === 'warning' ? 'bg-amber-500 shadow-amber-200 hover:bg-amber-600' :
                                                    'bg-primary-600 shadow-primary-200 hover:bg-primary-700'
                                            }`}
                                    >
                                        เข้าใจแล้ว
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyBookings;
