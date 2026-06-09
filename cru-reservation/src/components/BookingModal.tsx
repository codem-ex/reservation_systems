import { useEffect, useMemo, useState } from "react";
import { X, User as UserIcon, Users, ChevronDown } from "lucide-react";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { DateRange, type Range, type RangeKeyDict } from "react-date-range";
import { th } from "date-fns/locale";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

import type { Room, User } from "../types";
import { supabase } from "../lib/supabaseClient";
import { ensureProfileEmail } from "../lib/ensureProfile";

/* ===== timezone ===== */
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Bangkok");

interface BookingModalProps {
    room: Room;
    currentUser: User;
    initialDate?: string;
    initialStartTime?: string;
    initialEndTime?: string;
    onClose: () => void;
    onSuccess: () => void;
}

const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return NaN;
    const parts = timeStr.split(":");
    if (parts.length !== 2) return NaN;
    const [h, m] = parts.map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return h * 60 + m;
};

const CustomTimePicker = ({
    value,
    onChange,
    label,
    colorClass = "indigo",
    disabled = false
}: {
    value: string;
    onChange: (val: string) => void;
    label: string;
    colorClass?: "indigo" | "yellow" | "slate",
    disabled?: boolean
}) => {
    const [hStr, mStr] = value.split(":");

    let theme = "text-indigo-600 border-indigo-100 focus-within:border-indigo-400 bg-indigo-50/20";
    if (colorClass === "yellow") {
        theme = "text-yellow-600 border-yellow-100 focus-within:border-yellow-400 bg-yellow-50/20";
    } else if (colorClass === "slate" || disabled) {
        theme = "text-slate-400 border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed";
    }

    const updateHour = (val: string) => {
        if (disabled) return;
        let h = parseInt(val);
        if (isNaN(h)) h = 0;
        if (h > 23) h = 23;
        if (h < 0) h = 0;
        onChange(`${h.toString().padStart(2, '0')}:${mStr}`);
    };

    const updateMinute = (val: string) => {
        if (disabled) return;
        let m = parseInt(val);
        if (isNaN(m)) m = 0;
        if (m > 59) m = 59;
        if (m < 0) m = 0;
        onChange(`${hStr}:${m.toString().padStart(2, '0')}`);
    };

    return (
        <div className={`w-full flex flex-col items-center p-1.5 rounded-2xl border-2 transition-all ${theme} dark:bg-slate-800/40 dark:border-slate-800`}>
            <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">{label}</span>
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    value={hStr}
                    onChange={(e) => updateHour(e.target.value)}
                    onFocus={(e) => !disabled && e.target.select()}
                    disabled={disabled}
                    className="w-8 bg-transparent text-sm font-black text-center outline-none dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed"
                    placeholder="00"
                />
                <span className="text-xs font-black opacity-30">:</span>
                <input
                    type="number"
                    value={mStr}
                    onChange={(e) => updateMinute(e.target.value)}
                    onFocus={(e) => !disabled && e.target.select()}
                    disabled={disabled}
                    className="w-8 bg-transparent text-sm font-black text-center outline-none dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed"
                    placeholder="00"
                />
            </div>
        </div>
    );
};

const buildISO = (date: Date, time: string, end = false) => {
    const [h, m] = time.split(":").map(Number);
    return dayjs(date)
        .tz("Asia/Bangkok")
        .hour(Number.isFinite(h) ? h : end ? 23 : 0)
        .minute(Number.isFinite(m) ? m : end ? 59 : 0)
        .second(0)
        .millisecond(0)
        .toISOString();
};

const fmtRange = (s: Date, e: Date) => {
    const fs = dayjs(s).locale("th").format("D MMM");
    const fe = dayjs(e).locale("th").format("D MMM");
    return fs === fe ? fs : `${fs} – ${fe}`;
};

const BookingModal: React.FC<BookingModalProps> = ({
    room,
    currentUser,
    initialDate,
    initialStartTime,
    initialEndTime,
    onClose,
    onSuccess,
}) => {
    /* ===== form state ===== */
    const [eventRange, setEventRange] = useState<Range>({
        key: "event",
        startDate: initialDate ? startOfDay(new Date(initialDate)) : startOfDay(new Date()),
        endDate: initialDate ? startOfDay(new Date(initialDate)) : startOfDay(new Date()),
    });

    const [startTime, setStartTime] = useState(initialStartTime || "09:00");
    const [endTime, setEndTime] = useState(initialEndTime || "10:00");

    const [needsSetup, setNeedsSetup] = useState(false);
    const [setupStart, setSetupStart] = useState("08:00");

    const [title, setTitle] = useState("");
    const [purpose, setPurpose] = useState("");
    const [guestCount, setGuestCount] = useState<number>(1);
    
    const [step, setStep] = useState(1);
    const [isCustomGuest, setIsCustomGuest] = useState(false);

    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [existingReservations, setExistingReservations] = useState<any[]>([]);

    // 📌 Draft Persistence Logic
    const DRAFT_KEY = `mrs_draft_v2_${room.id}`;

    useEffect(() => {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                if (draft.eventRange) setEventRange({ ...draft.eventRange, startDate: new Date(draft.eventRange.startDate), endDate: new Date(draft.eventRange.endDate) });
                if (draft.title) setTitle(draft.title);
                if (draft.purpose) setPurpose(draft.purpose);
                if (draft.guestCount) setGuestCount(draft.guestCount);
                if (draft.startTime) setStartTime(draft.startTime);
                if (draft.endTime) setEndTime(draft.endTime);
                if (draft.needsSetup !== undefined) setNeedsSetup(draft.needsSetup);
                if (draft.setupStart) setSetupStart(draft.setupStart);
                if (draft.isCustomGuest) setIsCustomGuest(draft.isCustomGuest);
                if (draft.step) setStep(draft.step);
            } catch (e) {
                console.error("Failed to load draft", e);
            }
        }
    }, [DRAFT_KEY]);

    useEffect(() => {
        const payload = {
            eventRange,
            title,
            purpose,
            guestCount,
            startTime,
            endTime,
            needsSetup,
            setupStart,
            isCustomGuest,
            step
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }, [DRAFT_KEY, eventRange, title, purpose, guestCount, startTime, endTime, needsSetup, setupStart, isCustomGuest, step]);

    // Custom Alert Modal
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");

    const showCustomAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertOpen(true);
    };

    const reservationMap = useMemo(() => {
        const map = new Map<string, { title: string; type: 'use' | 'setup' }>();
        existingReservations.forEach(r => {
            let curr = dayjs(r.start_at).startOf('day');
            const end = dayjs(r.end_at).startOf('day');
            while (!curr.isAfter(end)) {
                map.set(curr.format('YYYY-MM-DD'), { title: r.title || "ไม่ระบุชื่อช่วง", type: 'use' });
                curr = curr.add(1, 'day');
            }

            if (r.setup_start_at && r.setup_end_at) {
                let sCurr = dayjs(r.setup_start_at).startOf('day');
                const sEnd = dayjs(r.setup_end_at).startOf('day');
                while (!sCurr.isAfter(sEnd)) {
                    const key = sCurr.format('YYYY-MM-DD');
                    if (!map.has(key)) {
                        map.set(key, { title: r.title || "ไม่ระบุชื่อช่วง", type: 'setup' });
                    }
                    sCurr = sCurr.add(1, 'day');
                }
            }
        });
        return map;
    }, [existingReservations]);

    const busyDateStrings = useMemo(() => new Set(reservationMap.keys()), [reservationMap]);

    const eventStartDate = eventRange.startDate ?? new Date();
    const eventEndDate = eventRange.endDate ?? eventStartDate;
    const labelEvent = useMemo(() => fmtRange(eventStartDate, eventEndDate), [eventStartDate, eventEndDate]);

    const handleSelect = (ranges: RangeKeyDict) => {
        const { event } = ranges;
        if (!event?.startDate || !event?.endDate) return;

        const start = dayjs(event.startDate).startOf('day');
        const end = dayjs(event.endDate).startOf('day');
        const currStart = dayjs(eventRange.startDate).startOf('day');
        const currEnd = dayjs(eventRange.endDate).startOf('day');

        // Logic 1: Click same date twice when it's just a single day -> Reset
        if (currStart.isSame(currEnd, 'day') && start.isSame(currStart, 'day') && end.isSame(currStart, 'day')) {
            setEventRange({ key: "event", startDate: startOfDay(new Date()), endDate: startOfDay(new Date()) });
            return;
        }

        // Logic 2: Reset on new click after range formed
        if (!currStart.isSame(currEnd, 'day') && start.isSame(end, 'day')) {
            setEventRange({ key: "event", startDate: event.startDate, endDate: event.startDate });
            return;
        }

        setEventRange({ key: "event", startDate: event.startDate, endDate: event.endDate });
    };

    const fetchExisting = async () => {
        try {
            const { data } = await supabase
                .from("reservations")
                .select("title, start_at, end_at, status, setup_start_at, setup_end_at")
                .eq("room_id", room.id)
                .in("status", ["PENDING", "APPROVED"]);
            if (data) setExistingReservations(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchExisting();
    }, [room.id]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    const hasConflict = useMemo(() => {
        const start = dayjs(buildISO(eventStartDate, needsSetup ? setupStart : startTime));
        const end = dayjs(buildISO(eventEndDate, endTime, true));

        return existingReservations.some(r => {
            const rStart = dayjs(r.setup_start_at || r.start_at);
            const rEnd = dayjs(r.end_at);
            return start.isBefore(rEnd) && end.isAfter(rStart);
        });
    }, [eventStartDate, eventEndDate, startTime, endTime, needsSetup, setupStart, existingReservations]);

    const validateStep = (s: number) => {
        if (s === 1) {
            const useS = timeToMinutes(startTime);
            const useE = timeToMinutes(endTime);
            if (!Number.isFinite(useS) || !Number.isFinite(useE)) return "เวลาใช้งานไม่ถูกต้อง";
            if (useS >= useE) return "เวลาใช้งาน: เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด";

            if (needsSetup) {
                const setS = timeToMinutes(setupStart);
                if (!Number.isFinite(setS)) return "เวลาจัดเตรียมไม่ถูกต้อง";
                if (setS >= useS) return "เวลาเริ่มจัดเตรียมห้อง ต้องมาก่อนเวลาเริ่มใช้งานจริง";
            }

            if (hasConflict) return "ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น";
        }

        if (s === 2) {
            if (!title.trim()) return "กรุณาระบุหัวข้อการขอใช้ห้องประชุม";
            if (!purpose.trim()) return "กรุณาระบุวัตถุประสงค์การใช้งาน";
            if (!guestCount || guestCount < 1) return "กรุณาระบุจำนวนผู้ร่วมอย่างน้อย 1 คน";
            if (guestCount > room.capacity) return `ห้องนี้รองรับได้สูงสุด ${room.capacity} คน`;
        }

        return "";
    };

    const nextStep = () => {
        const msg = validateStep(step);
        if (msg) return showCustomAlert("ข้อมูลไม่ครบถ้วน", msg);
        if (step < 3) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const submit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const msg = validateStep(2);
        if (msg) return showCustomAlert("ข้อมูลไม่ครบถ้วน", msg);

        setLoading(true);
        try {
            await ensureProfileEmail();

            const payload = {
                room_id: room.id,
                requester_id: currentUser.id,
                title: title.trim(),
                purpose: [
                    purpose.trim(),
                    guestCount > 1 ? `\n(จำนวนผู้เข้าร่วม: ${guestCount} คน)` : "",
                ].filter(Boolean).join("\n"),

                start_at: buildISO(eventStartDate, startTime),
                end_at: buildISO(eventEndDate, endTime, true),

                // Setup time logic
                setup_date: needsSetup ? dayjs(eventStartDate).tz("Asia/Bangkok").format("YYYY-MM-DD") : null,
                setup_start: needsSetup ? setupStart : null,
                setup_end: needsSetup ? startTime : null, // Implicitly ends when event starts
                setup_start_at: needsSetup ? buildISO(eventStartDate, setupStart) : null,
                setup_end_at: needsSetup ? buildISO(eventStartDate, startTime) : null,

                status: "PENDING",
                current_stage: 1
            };

            const { error } = await supabase
                .from("reservations")
                .insert(payload)
                .select("id, chain_id, status, current_stage")
                .single();

            if (error) throw error;

            localStorage.removeItem(DRAFT_KEY);

            await supabase.from("notifications").insert({
                user_id: currentUser.id,
                title: "ส่งคำขอจองห้องแล้ว",
                message: `ส่งคำขอจองห้อง "${room.name}" สำหรับหัวข้อ "${title}" เรียบร้อยแล้ว ขณะนี้อยู่ระหว่างรอการอนุมัติ`,
                type: 'new_reservation',
                is_read: false
            });

            const { data: admins } = await supabase.from("profiles").select("id").eq("is_admin", true);
            if (admins && admins.length > 0) {
                const adminNotifs = admins.map(admin => ({
                    user_id: admin.id,
                    title: "มีคำขอจองห้องใหม่",
                    message: `มีรายการขอใช้ห้อง "${room.name}" จากคุณ ${currentUser.name} (หัวข้อ: ${title})`,
                    type: 'new_reservation',
                    is_read: false
                })).filter(n => n.user_id !== currentUser.id);

                if (adminNotifs.length > 0) {
                    await supabase.from("notifications").insert(adminNotifs);
                }
            }

            setShowSuccess(true);
        } catch (err: any) {
            showCustomAlert("บันทึกไม่สำเร็จ", err?.message ?? "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 dark:border-slate-800/50 flex flex-col max-h-[95dvh] sm:max-h-[90vh] animate-in zoom-in-95 duration-300">
                <div className="bg-slate-50 dark:bg-slate-950 px-5 py-5 relative border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-1.5 leading-none">แบบคำขอใช้ห้องประชุม</h2>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate shrink-0">{room.name}</h1>

                                <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-white/5 p-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-white/5 backdrop-blur-md self-start sm:self-auto">
                                    <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <UserIcon className="text-white w-2.5 h-2.5" />
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-900 dark:text-white leading-none">{currentUser.name}</div>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors shrink-0">
                            <X className="w-5 h-5 text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white" />
                        </button>
                    </div>
                </div>

                <div className="px-8 pt-4 pb-0">
                    <div className="flex items-center gap-2">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex-1 flex flex-col gap-1.5">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= s ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-800"}`} />
                                <span className={`text-[10px] font-black uppercase tracking-tighter text-center ${step === s ? "text-indigo-600" : "text-slate-400"}`}>
                                    {s === 1 ? "วันและเวลา" : s === 2 ? "ข้อมูลการจอง" : "ตรวจสอบ"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <style>{`
                    .rdrDayToday .rdrDayNumber span:after {
                        display: none !important;
                    }
                `}</style>

                <div className="flex flex-col gap-6 px-5 sm:px-8 py-6 sm:py-8 overflow-y-auto custom-scrollbar flex-1">
                    {step === 1 && (
                        <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
                            {/* Calendar */}
                            <div className="mx-auto w-full max-w-[520px] bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl p-4 border border-slate-100 dark:border-slate-700/30 overflow-hidden flex flex-col items-center shadow-sm">
                                <div className="w-full flex justify-center transform scale-100 origin-top mb-4 rounded-2xl overflow-hidden shadow-sm">
                                    <DateRange
                                        locale={th}
                                        ranges={[eventRange]}
                                        onChange={handleSelect}
                                        focusedRange={[0, 0]}
                                        disabledDates={[...Array.from(busyDateStrings).map(s => dayjs(s).toDate())]}
                                        minDate={startOfDay(new Date())}
                                        months={1}
                                        direction="vertical"
                                        showDateDisplay={false}
                                        rangeColors={["#4f46e5"]}
                                        // @ts-ignore
                                        moveRangeOnFirstSelection={false}
                                        // @ts-ignore
                                        dragSelectionEnabled={false}
                                        // @ts-ignore
                                        preventSnapRefocus={true}
                                        dayContentRenderer={(day: Date) => {
                                            const dateStr = dayjs(day).format("YYYY-MM-DD");
                                            const res = reservationMap.get(dateStr);
                                            const isBusy = !!res;

                                            return (
                                                <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none">
                                                    <span className={`text-xs font-black transition-all ${isBusy ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-200"}`}>
                                                        {day.getDate()}
                                                    </span>
                                                    {isBusy && (
                                                        <div className="absolute bottom-1.5 w-4 h-[2px] bg-red-500 rounded-full shadow-sm shadow-red-200" />
                                                    )}
                                                </div>
                                            );
                                        }}
                                    />
                                </div>

                                <div className="w-full flex justify-center gap-4 mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-sm" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">วันใช้งานจริง</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">จองแล้ว</span>
                                    </div>
                                </div>

                                <div className="w-full text-center py-2.5 text-sm border-t border-slate-100 dark:border-slate-800 mt-1 bg-white dark:bg-slate-900/50 rounded-xl shadow-sm">
                                    <span className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm">
                                        {labelEvent}
                                    </span>
                                </div>
                            </div>

                            {/* Time Pickers & Setup Toggle */}
                            <div className="space-y-4">
                                <div className="bg-indigo-50/40 dark:bg-indigo-900/5 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl p-4 flex flex-col gap-3">
                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center">เวลาใช้งานจริง</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <CustomTimePicker value={startTime} onChange={setStartTime} label="เข้า" colorClass="indigo" />
                                        <CustomTimePicker value={endTime} onChange={setEndTime} label="ออก" colorClass="indigo" />
                                    </div>
                                </div>

                                <div className={`border rounded-2xl p-4 transition-colors ${needsSetup ? "bg-yellow-50/40 dark:bg-yellow-900/5 border-yellow-200" : "bg-slate-50 border-slate-200"}`}>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                                            checked={needsSetup}
                                            onChange={(e) => setNeedsSetup(e.target.checked)}
                                        />
                                        <span className={`text-sm font-bold ${needsSetup ? "text-yellow-700" : "text-slate-600"}`}>
                                            ต้องการเวลาจัดเตรียมห้องล่วงหน้า
                                        </span>
                                    </label>
                                    
                                    {needsSetup && (
                                        <div className="mt-4 pt-4 border-t border-yellow-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                            <div className="flex-1">
                                                <div className="text-xs font-bold text-yellow-600 mb-2">เวลาเริ่มจัดเตรียมห้อง</div>
                                                <div className="w-32">
                                                    <CustomTimePicker value={setupStart} onChange={setSetupStart} label="เริ่มจัดเตรียม" colorClass="yellow" />
                                                </div>
                                            </div>
                                            <div className="text-xs text-yellow-600/70 font-medium text-right ml-4">
                                                * เวลาจัดเตรียมจะสิ้นสุดเมื่อ <br/> การใช้งานจริงเริ่มต้น ({startTime} น.)
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {hasConflict && (
                                <div className="p-3 bg-red-50 text-red-600 text-center font-bold rounded-2xl border border-red-100 animate-pulse text-sm">
                                    ⚠️ ช่วงเวลานี้ถูกจองไปแล้ว
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">หัวข้อการจอง</label>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="ระบุหัวข้อการประชุมหรือกิจกรรม..."
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-lg font-bold dark:text-white focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">จำนวนผู้ร่วม (คน)</label>
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <select
                                                value={isCustomGuest ? "custom" : guestCount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "custom") {
                                                        setIsCustomGuest(true);
                                                    } else {
                                                        setIsCustomGuest(false);
                                                        setGuestCount(Number(val));
                                                    }
                                                }}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-11 py-2.5 text-lg font-black text-slate-800 dark:text-white focus:border-indigo-500 focus:bg-white outline-none appearance-none shadow-sm cursor-pointer"
                                            >
                                                <option value="" disabled>เลือกจำนวนผู้ร่วม</option>
                                                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200].map(v => (
                                                    <option key={v} value={v}>{v} คน</option>
                                                ))}
                                                <option value="custom">ระบุนอกเหนือจากนี้...</option>
                                            </select>
                                            <Users className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                        </div>

                                        {isCustomGuest && (
                                            <input
                                                type="number"
                                                value={guestCount}
                                                onChange={(e) => setGuestCount(Number(e.target.value))}
                                                placeholder="กรุณาระบุจำนวนคน..."
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 rounded-xl px-4 py-2.5 text-lg font-black text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-sm animate-in slide-in-from-top-2"
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">วัตถุประสงค์</label>
                                    <textarea
                                        rows={4}
                                        value={purpose}
                                        onChange={(e) => setPurpose(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-lg font-bold dark:text-white focus:border-indigo-500 focus:bg-white outline-none resize-none shadow-sm"
                                        placeholder="ระบุวัตถุประสงค์การใช้งานห้อง..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-5 space-y-4 border border-slate-100 dark:border-slate-700/50">
                                <div className="text-center mb-2">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-0.5">สรุปข้อมูลการจอง</h3>
                                    <p className="text-slate-500 text-[9px]">โปรดตรวจสอบความถูกต้องก่อนกดยืนยัน</p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">ชื่อห้อง</span>
                                        <span className="text-base font-bold dark:text-white">{room.name}</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-indigo-100 dark:border-indigo-900/30">
                                            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">วันและเวลาใช้งานจริง</span>
                                            <span className="text-sm font-bold dark:text-white">{labelEvent}</span>
                                            <span className="text-[10px] font-medium text-slate-500">{startTime} - {endTime} น.</span>
                                        </div>
                                        {needsSetup ? (
                                            <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-yellow-200 dark:border-yellow-900/30">
                                                <span className="text-[8px] font-black text-yellow-600 uppercase tracking-widest">จัดเตรียมห้องล่วงหน้า</span>
                                                <span className="text-sm font-bold dark:text-white">เริ่มต้นเวลา {setupStart} น.</span>
                                                <span className="text-[10px] font-medium text-slate-500">ในวันเดียวกับที่จัดงาน</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-0.5 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 opacity-60">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">การจัดเตรียมห้อง</span>
                                                <span className="text-sm font-bold dark:text-white">ไม่ต้องการ</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">หัวข้อการจอง</span>
                                        <span className="text-base font-bold dark:text-white">{title}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">จำนวนผู้ร่วม</span>
                                            <span className="text-base font-bold dark:text-white">{guestCount} คน</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ผู้ขอใช้</span>
                                            <span className="text-base font-bold dark:text-white truncate">{currentUser.name}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-5 sm:px-8 py-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-3 shrink-0">
                    <button
                        onClick={step === 1 ? onClose : prevStep}
                        className="w-full py-3 sm:py-3.5 rounded-2xl font-black text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm"
                    >
                        {step === 1 ? "ยกเลิก" : "ย้อนกลับ"}
                    </button>
                    {step < 3 ? (
                        <button
                            onClick={nextStep}
                            className="w-full py-3 sm:py-3.5 rounded-2xl font-black text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 shadow-md shadow-slate-900/10 dark:shadow-indigo-500/20 transition-all active:scale-[0.98]"
                        >
                            ถัดไป
                        </button>
                    ) : (
                        <button
                            onClick={submit}
                            disabled={loading}
                            className="w-full py-3 sm:py-3.5 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>กำลังบันทึก...</span>
                                </>
                            ) : (
                                "ยืนยันการจอง"
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Custom Alert */}
            {alertOpen && (
                <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{alertTitle}</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">{alertMessage}</p>
                        <button
                            onClick={() => setAlertOpen(false)}
                            className="w-full py-3 rounded-xl font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 transition-colors"
                        >
                            เข้าใจแล้ว
                        </button>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">ส่งคำขอจองสำเร็จ</h3>
                        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                            ระบบได้รับคำขอจองห้องของคุณแล้ว<br />โปรดรอการอนุมัติจากผู้ดูแลระบบ
                        </p>
                        <button
                            onClick={() => {
                                setShowSuccess(false);
                                onSuccess();
                            }}
                            className="w-full py-3.5 rounded-2xl font-black text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            กลับสู่หน้าหลัก
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingModal;
