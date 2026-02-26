import { useEffect, useState, useMemo } from "react";
import { format, addDays, startOfDay, addHours, differenceInMinutes } from "date-fns";
import { th } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type Reservation = {
    id: string;
    room_id: string;
    title: string;
    start_at: string;
    end_at: string;
    setup_start_at?: string;
    setup_end_at?: string;
    status: string;
};

type Room = {
    id: string;
    name: string;
};

const RoomSchedule = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [rooms, setRooms] = useState<Room[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);

    const START_HOUR = 7;
    const TOTAL_HOURS = 15; // 7:00 - 22:00

    const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [roomsRes, resvRes] = await Promise.all([
                    supabase.from("rooms").select("id, name").eq("is_active", true).order("name"),
                    supabase.from("reservations")
                        .select("id, room_id, title, start_at, end_at, setup_start_at, setup_end_at, status")
                        .in("status", ["APPROVED", "PENDING"])
                ]);

                if (roomsRes.error) throw roomsRes.error;
                if (resvRes.error) throw resvRes.error;

                setRooms(roomsRes.data || []);
                setReservations(resvRes.data || []);
            } catch (error) {
                console.error("Error fetching schedule:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const filteredReservations = useMemo(() => {
        return reservations.filter(r => {
            // Use the full range of occupation (setup to end)
            const trueStart = r.setup_start_at || r.start_at;
            const trueEnd = r.end_at;

            const resStart = startOfDay(new Date(trueStart));
            const resEnd = startOfDay(new Date(trueEnd));
            const current = startOfDay(selectedDate);
            return current >= resStart && current <= resEnd;
        });
    }, [reservations, selectedDate]);

    const getResStyle = (r: Reservation) => {
        // Occupation range
        const start = new Date(r.setup_start_at || r.start_at);
        const end = new Date(r.end_at);
        const gridStart = addHours(startOfDay(selectedDate), START_HOUR);

        // Calculate minutes since start of grid (07:00)
        const startMin = Math.max(0, differenceInMinutes(start, gridStart));
        const endMin = Math.min(TOTAL_HOURS * 60, differenceInMinutes(end, gridStart));

        if (startMin >= TOTAL_HOURS * 60 || endMin <= 0) return null;

        const left = (startMin / (TOTAL_HOURS * 60)) * 100;
        const width = ((endMin - startMin) / (TOTAL_HOURS * 60)) * 100;

        return {
            left: `${left}%`,
            width: `${width}%`
        };
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <CalendarIcon className="w-6 h-6 text-primary-600" />
                    ตารางเวลาการใช้ห้องประชุม
                </h1>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <button
                        onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <label
                        className="px-4 font-semibold text-gray-900 dark:text-white min-w-[150px] text-center cursor-pointer hover:text-primary-600 transition-colors block relative"
                        onClick={(e) => {
                            const input = e.currentTarget.querySelector('input');
                            if (input && 'showPicker' in input) {
                                try { input.showPicker(); } catch (err) { console.error(err); }
                            }
                        }}
                    >
                        {format(selectedDate, "eee d MMM yyyy", { locale: th })}
                        <input
                            type="date"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            value={format(selectedDate, 'yyyy-MM-dd')}
                            onChange={(e) => e.target.value && setSelectedDate(new Date(e.target.value))}
                        />
                    </label>
                    <button
                        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Perfect Alignment Metadata Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="grid grid-cols-[20px_1fr] items-center gap-4 text-[11px]">
                        <CalendarIcon className="w-4 h-4 text-primary-500" />
                        <div className="flex gap-2">
                            <span className="font-black text-slate-400 uppercase tracking-widest min-w-[60px]">วันที่:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{format(selectedDate, "d MMMM yyyy", { locale: th })}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-[20px_1fr] items-center gap-4 text-[11px]">
                        <Clock className="w-4 h-4 text-primary-500" />
                        <div className="flex gap-2">
                            <span className="font-black text-slate-400 uppercase tracking-widest min-w-[60px]">เวลา:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">07:00 - 22:00 น.</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-[20px_1fr] items-center gap-4 text-[11px]">
                        <MapPin className="w-4 h-4 text-primary-500" />
                        <div className="flex gap-2">
                            <span className="font-black text-slate-400 uppercase tracking-widest min-w-[60px]">สถานที่:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate">ห้องประชุมทั้งหมด</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="grid grid-cols-[20px_1fr] items-center gap-4 text-[11px]">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200 ring-2 ring-emerald-100 dark:ring-emerald-900/20"></div>
                        <div className="flex gap-2">
                            <span className="font-black text-slate-400 uppercase tracking-widest min-w-[60px]">สถานะ:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">อนุมัติเรียบร้อยแล้ว</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-[20px_1fr] items-center gap-4 text-[11px]">
                        <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-sm shadow-amber-200 ring-2 ring-amber-100 dark:ring-amber-900/20"></div>
                        <div className="flex gap-2">
                            <span className="font-black text-slate-400 uppercase tracking-widest min-w-[60px]">สถานะ:</span>
                            <span className="font-bold text-amber-500">รอดำเนินการ / พิจารณา</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-[20px_1fr] items-center gap-4 text-[11px] opacity-60">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>
                        <div className="flex gap-2">
                            <span className="font-black text-slate-400 uppercase tracking-widest min-w-[60px]">สถานะ:</span>
                            <span className="font-bold text-slate-600 dark:text-slate-400">ห้องว่าง / ยังไม่มีการจอง</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Horizontal Scroll Hint for Mobile */}
            <div className="lg:hidden flex items-center justify-center gap-2 text-[10px] font-black text-primary-600 uppercase tracking-widest bg-primary-50 dark:bg-primary-900/20 py-2 rounded-xl border border-primary-100 dark:border-primary-900/30">
                <ChevronRight className="w-3 h-3 animate-pulse" />
                เลื่อนขวาเพื่อดูเวลาทั้งหมด
                <ChevronLeft className="w-3 h-3 animate-pulse" />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-x-auto custom-scrollbar no-scrollbar-mobile">
                <div className="min-w-[1000px] lg:min-w-full">
                    <table className="w-full border-collapse table-fixed">
                        <thead>
                            <tr className="h-14">
                                <th className="p-4 border-b border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 sticky left-0 z-20 w-48 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    ห้องประชุม
                                </th>
                                {hours.map((h, i) => (
                                    <th key={h} className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 relative">
                                        <div className="absolute left-0 -translate-x-1/2 bottom-1.5 flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                                                {h.toString().padStart(2, '0')}:00
                                            </span>
                                        </div>
                                        {i === hours.length - 1 && (
                                            <div className="absolute right-0 translate-x-1/2 bottom-1.5 flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                                                    {(h + 1).toString().padStart(2, '0')}:00
                                                </span>
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rooms.map(room => {
                                const roomResvs = filteredReservations.filter(r => r.room_id === room.id);
                                return (
                                    <tr key={room.id} className="group">
                                        <td className="p-4 border-b border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky left-0 z-10 font-medium text-gray-900 dark:text-white group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors truncate">
                                            {room.name}
                                        </td>
                                        <td colSpan={TOTAL_HOURS} className="p-0 border-b border-slate-100 dark:border-slate-800 relative h-24 group-hover:bg-slate-50/30 dark:group-hover:bg-slate-800/20">
                                            {/* Background Grid Lines */}
                                            <div className="absolute inset-0 flex pointer-events-none">
                                                {hours.map((_, i) => (
                                                    <div key={i} className="flex-1 border-r border-slate-100 dark:border-slate-800/40 last:border-r-0" />
                                                ))}
                                            </div>

                                            {/* Reservations Overlay */}
                                            <div className="absolute inset-0">
                                                {roomResvs.map(res => {
                                                    const style = getResStyle(res);
                                                    if (!style) return null;
                                                    return (
                                                        <div
                                                            key={res.id}
                                                            style={style}
                                                            className={`absolute top-2 bottom-2 rounded-lg py-2 px-3 text-[11px] leading-snug overflow-hidden shadow-md border transition-all hover:z-30 hover:shadow-lg group/res flex flex-col justify-center
                                                                ${res.status === 'APPROVED'
                                                                    ? 'bg-emerald-500 dark:bg-emerald-600 text-white border-emerald-400 shadow-emerald-200/50'
                                                                    : 'bg-amber-400 dark:bg-amber-500 text-amber-950 border-amber-300 shadow-amber-200/50'
                                                                }`}
                                                            title={`${res.title} (${res.status})\nจัดเตรียม: ${res.setup_start_at ? format(new Date(res.setup_start_at), "HH:mm") : "--"}\nใช้งาน: ${format(new Date(res.start_at), "HH:mm")} - ${format(new Date(res.end_at), "HH:mm")}`}
                                                        >
                                                            <div className="font-bold truncate text-xs mb-0.5">{res.title}</div>
                                                            <div className="opacity-90 font-semibold whitespace-nowrap">
                                                                {format(new Date(res.setup_start_at || res.start_at), "HH:mm")} - {format(new Date(res.end_at), "HH:mm")}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RoomSchedule;
