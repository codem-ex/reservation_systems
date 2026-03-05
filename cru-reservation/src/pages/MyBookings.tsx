import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Loader2, AlertCircle, Check, X } from 'lucide-react';
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

    // Timeline State
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [activeTimeline, setActiveTimeline] = useState<Reservation | null>(null);

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
            // Simplified: Stage info
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

            // Create notification for admin
            const { data: admins } = await supabase.from("profiles").select("id").eq("is_admin", true);
            if (admins && admins.length > 0) {
                // Find the booking to get its title and room name for the notification
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">การจองของฉัน</h1>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                {bookings.length === 0 ? (
                    <div className="p-20 text-center text-gray-500 dark:text-slate-400 flex flex-col items-center">
                        <Calendar className="w-16 h-16 mb-4 text-gray-300 dark:text-slate-700" />
                        <p className="text-lg">คุณยังไม่มีรายการจองห้องประชุม</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {bookings.map(booking => {
                            const room = (booking as any).room || (booking as any).rooms;
                            const roomName = room?.name || `ไม่ทราบชื่อห้อง (${booking.room_id.slice(0, 8)})`;
                            const roomLocation = room?.location || 'ไม่ระบุสถานที่';
                            const startDate = new Date(booking.start_at);
                            const endDate = new Date(booking.end_at);
                            const rejection = booking.reservation_approvals?.find((a: any) => a.decision === 'REJECTED');

                            const handleCancel = async () => {
                                showCustomAlert("ยืนยันการยกเลิก", "คุณต้องการยกเลิกรายการจองนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้", "confirm", { id: booking.id });
                            };

                            return (
                                <div key={booking.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                                    {roomName}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${getStatusColor(booking.status)}`}>
                                                    {getStatusThai(booking)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <p className="text-slate-600 dark:text-slate-300 font-medium">{booking.title}</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-1">{booking.purpose}</p>
                                            </div>

                                            {booking.status === 'PENDING' && (
                                                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                                    <div className="flex items-center justify-between mb-3 text-xs">
                                                        <span className="font-bold text-slate-500 uppercase tracking-wider">Approval Progress</span>
                                                        <span className="text-primary-600 dark:text-primary-400 font-medium italic">รอสเตจที่ {booking.current_stage}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {(() => {
                                                            const chainSteps = steps.filter(s => s.chain_id === booking.chain_id);
                                                            const totalS = chainSteps.length > 0 ? Math.max(...chainSteps.map(s => s.stage_no)) : 2;

                                                            return Array.from({ length: totalS }, (_, i) => i + 1).map(sNum => (
                                                                <React.Fragment key={sNum}>
                                                                    <div className="flex-1">
                                                                        <div className={`h-2 rounded-full mb-1 transition-all duration-500 ${booking.current_stage > sNum ? 'bg-green-500' : booking.current_stage === sNum ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'}`}></div>
                                                                        <div className={`text-[10px] text-center ${booking.current_stage >= sNum ? 'font-bold text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                                                                            {sNum}. {sNum === 1 ? 'พิจารณาขั้นต้น' : 'พิจารณาอนุมัติ'}
                                                                        </div>
                                                                    </div>
                                                                    {sNum < totalS && <div className="w-4 h-[1px] bg-slate-200 mb-4"></div>}
                                                                </React.Fragment>
                                                            ));
                                                        })()}
                                                    </div>
                                                </div>
                                            )}

                                            {rejection && (
                                                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg">
                                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                    <div className="text-sm">
                                                        <span className="font-bold text-red-700 dark:text-red-400">เหตุผลที่ปฏิเสธ: </span>
                                                        <span className="text-red-600 dark:text-red-300/80">{rejection.decision_note || 'ไม่ระบุเหตุผล'}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-4 flex items-center gap-4">
                                                {booking.status.toUpperCase() === 'PENDING' && (
                                                    <button
                                                        onClick={handleCancel}
                                                        className="text-xs font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
                                                    >
                                                        ยกเลิกการจอง
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setActiveTimeline(booking);
                                                        setTimelineOpen(true);
                                                    }}
                                                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 transition-colors"
                                                >
                                                    ประวัติการอนุมัติ (Timeline)
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-2 text-[11px] font-black text-slate-500 min-w-fit">
                                            <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 p-2.5 rounded-xl lg:bg-transparent lg:p-0">
                                                <Calendar className="w-4 h-4 mr-2 text-primary-500" />
                                                <span className="uppercase tracking-tight">{format(startDate, 'd MMMM yyyy', { locale: th })}</span>
                                            </div>
                                            <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 p-2.5 rounded-xl lg:bg-transparent lg:p-0">
                                                <Clock className="w-4 h-4 mr-2 text-primary-500" />
                                                <span className="uppercase tracking-tight">{format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')} น.</span>
                                            </div>
                                            <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 p-2.5 rounded-xl lg:bg-transparent lg:p-0">
                                                <MapPin className="w-4 h-4 mr-2 text-primary-500" />
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
            {/* Custom Alert & Confirm Modal */}
            {/* Timeline Modal */}
            {timelineOpen && activeTimeline && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl transform animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 border border-white/20 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Timeline การอนุมัติ</h3>
                            <button onClick={() => setTimelineOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
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
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed italic italic">"{approval.decision_note}"</p>
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
                                className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-[2rem] font-black text-xl transition-all active:scale-95"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Custom Alert & Confirm Modal */}
            {alertOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
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
                                            className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-3xl font-black text-xl shadow-xl shadow-red-200 dark:shadow-none transition-all active:scale-95"
                                        >
                                            ยืนยันยกเลิก
                                        </button>
                                        <button
                                            onClick={() => setAlertOpen(false)}
                                            className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-3xl font-black text-xl transition-all active:scale-95"
                                        >
                                            ย้อนกลับ
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setAlertOpen(false)}
                                        className={`w-full py-5 rounded-3xl font-black text-xl text-white transition-all active:scale-95 shadow-xl ${alertType === 'success' ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700' :
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
