import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Loader2, AlertCircle } from 'lucide-react';
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
    status: string;
    reservation_approvals?: {
        decision: string;
        decision_note: string | null;
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
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('reservations')
                .select(`
                    *, 
                    room:rooms(id, name, location),
                    reservation_approvals(decision, decision_note)
                `)
                .eq('requester_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setBookings(data as any[]);
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

    const getStatusThai = (status: string) => {
        const s = status.toUpperCase();
        if (s === 'APPROVED') return 'อนุมัติแล้ว';
        if (s === 'REJECTED') return 'ปฏิเสธ';
        if (s === 'CANCELLED') return 'ยกเลิกแล้ว';
        if (s === 'PENDING') return 'รออนุมัติ';
        return status;
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
                            const rejection = booking.reservation_approvals?.find(a => a.decision === 'REJECTED');

                            const handleCancel = async () => {
                                if (!window.confirm("คุณต้องการยกเลิกรายการจองนี้ใช่หรือไม่?")) return;
                                try {
                                    const { error } = await supabase
                                        .from('reservations')
                                        .update({ status: 'CANCELLED' })
                                        .eq('id', booking.id);
                                    if (error) throw error;

                                    // Create notification for admin
                                    const { data: admins } = await supabase.from("profiles").select("id").eq("is_admin", true);
                                    if (admins && admins.length > 0) {
                                        const adminNotifs = admins.map(admin => ({
                                            user_id: admin.id,
                                            title: "รายการจองถูกยกเลิก",
                                            message: `คุณ ${user?.user_metadata?.full_name || 'ผู้ใช้งาน'} ได้ยกเลิกรายการจองห้อง "${room?.name}" (หัวข้อ: ${booking.title})`,
                                            type: 'status_change',
                                            is_read: false
                                        }));
                                        await supabase.from("notifications").insert(adminNotifs);
                                    }

                                } catch (e: any) {
                                    alert(e.message);
                                }
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
                                                    {getStatusThai(booking.status)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <p className="text-slate-600 dark:text-slate-300 font-medium">{booking.title}</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-1">{booking.purpose}</p>
                                            </div>

                                            {rejection && (
                                                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg">
                                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                    <div className="text-sm">
                                                        <span className="font-bold text-red-700 dark:text-red-400">เหตุผลที่ปฏิเสธ: </span>
                                                        <span className="text-red-600 dark:text-red-300/80">{rejection.decision_note || 'ไม่ระบุเหตุผล'}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {booking.status.toUpperCase() === 'PENDING' && (
                                                <div className="mt-4">
                                                    <button
                                                        onClick={handleCancel}
                                                        className="text-xs font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
                                                    >
                                                        ยกเลิกการจอง
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-col gap-3 text-sm text-slate-600 dark:text-slate-400 min-w-fit">
                                            <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg md:bg-transparent md:p-0">
                                                <Calendar className="w-4 h-4 mr-2 text-primary-500 dark:text-primary-400" />
                                                {format(startDate, 'd MMMM yyyy', { locale: th })}
                                            </div>
                                            <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg md:bg-transparent md:p-0">
                                                <Clock className="w-4 h-4 mr-2 text-primary-500 dark:text-primary-400" />
                                                {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')} น.
                                            </div>
                                            <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg md:bg-transparent md:p-0">
                                                <MapPin className="w-4 h-4 mr-2 text-primary-500 dark:text-primary-400" />
                                                {roomLocation}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyBookings;
