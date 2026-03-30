import { useEffect, useMemo, useState } from "react";
import { X, User as UserIcon, Check, Users, AlertCircle, ChevronDown, Trash2 } from "lucide-react";

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
    colorClass = "indigo"
}: {
    value: string;
    onChange: (val: string) => void;
    label: string;
    colorClass?: "indigo" | "yellow"
}) => {
    const [hStr, mStr] = value.split(":");

    const theme = colorClass === "indigo"
        ? "text-indigo-600 border-indigo-100 focus-within:border-indigo-400 bg-indigo-50/20"
        : "text-yellow-600 border-yellow-100 focus-within:border-yellow-400 bg-yellow-50/20";

    const updateHour = (val: string) => {
        let h = parseInt(val);
        if (isNaN(h)) h = 0;
        if (h > 23) h = 23;
        if (h < 0) h = 0;
        onChange(`${h.toString().padStart(2, '0')}:${mStr}`);
    };

    const updateMinute = (val: string) => {
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
                    onFocus={(e) => e.target.select()}
                    className="w-8 bg-transparent text-sm font-black text-center outline-none dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="00"
                />
                <span className="text-xs font-black opacity-30">:</span>
                <input
                    type="number"
                    value={mStr}
                    onChange={(e) => updateMinute(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-8 bg-transparent text-sm font-black text-center outline-none dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
    /* ===== ranges ===== */
    const [useRange, setUseRange] = useState<Range>({
        key: "use",
        startDate: initialDate ? startOfDay(new Date(initialDate)) : startOfDay(new Date()),
        endDate: initialDate ? startOfDay(new Date(initialDate)) : startOfDay(new Date()),
    });

    const [setupRange, setSetupRange] = useState<Range>({
        key: "setup",
        startDate: initialDate ? startOfDay(new Date(initialDate)) : startOfDay(new Date()),
        endDate: initialDate ? startOfDay(new Date(initialDate)) : startOfDay(new Date()),
    });

    const [active, setActive] = useState<"use" | "setup">("setup");

    /* ===== form ===== */
    const [title, setTitle] = useState("");
    const [purpose, setPurpose] = useState("");
    const [guestCount, setGuestCount] = useState<number>(1);



    /* ===== time (24h) ===== */
    const [setupStart, setSetupStart] = useState("08:00");
    const [setupEnd, setSetupEnd] = useState(initialStartTime || "09:00");
    const [startTime, setStartTime] = useState(initialStartTime || "09:00");
    const [endTime, setEndTime] = useState(initialEndTime || "10:00");

    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [existingReservations, setExistingReservations] = useState<any[]>([]);
    const [step, setStep] = useState(1);
    const [isCustomGuest, setIsCustomGuest] = useState(false);

    // 📌 Draft Persistence Logic
    const DRAFT_KEY = `mrs_draft_${room.id}`;

    // Load Draft on Mount
    useEffect(() => {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                if (draft.useRange) setUseRange({ ...draft.useRange, startDate: new Date(draft.useRange.startDate), endDate: new Date(draft.useRange.endDate) });
                if (draft.setupRange) setSetupRange({ ...draft.setupRange, startDate: new Date(draft.setupRange.startDate), endDate: new Date(draft.setupRange.endDate) });
                if (draft.active) setActive(draft.active);
                if (draft.title) setTitle(draft.title);
                if (draft.purpose) setPurpose(draft.purpose);
                if (draft.guestCount) setGuestCount(draft.guestCount);
                if (draft.setupStart) setSetupStart(draft.setupStart);
                if (draft.setupEnd) setSetupEnd(draft.setupEnd);
                if (draft.startTime) setStartTime(draft.startTime);
                if (draft.endTime) setEndTime(draft.endTime);
                if (draft.isCustomGuest) setIsCustomGuest(draft.isCustomGuest);
                if (draft.step) setStep(draft.step);
            } catch (e) {
                console.error("Failed to load draft", e);
            }
        }
    }, [DRAFT_KEY]);

    // Save Draft on Change
    useEffect(() => {
        const payload = {
            useRange,
            setupRange,
            active,
            title,
            purpose,
            guestCount,
            setupStart,
            setupEnd,
            startTime,
            endTime,
            isCustomGuest,
            step
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }, [DRAFT_KEY, useRange, setupRange, active, title, purpose, guestCount, setupStart, setupEnd, startTime, endTime, isCustomGuest, step]);

    const clearDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        setTitle("");
        setPurpose("");
        setGuestCount(1);
        setStep(1);
        setIsCustomGuest(false);
        // Reset dates to initial
        const initial = initialDate ? startOfDay(new Date(initialDate)) : startOfDay(new Date());
        setUseRange({ key: "use", startDate: initial, endDate: initial });
        setSetupRange({ key: "setup", startDate: initial, endDate: initial });
        setSetupStart("08:00");
        setSetupEnd(initialStartTime || "09:00");
        setStartTime(initialStartTime || "09:00");
        setEndTime(initialEndTime || "10:00");
        
        showCustomAlert("ล้างข้อมูลสำเร็จ", "แบบร่างของคุณถูกลบออกแล้ว", "info");
    };

    // Custom Alert Modal
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertType, setAlertType] = useState<"info" | "success" | "warning" | "error">("info");

    const showCustomAlert = (title: string, message: string, type: "info" | "success" | "warning" | "error" = "info") => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertType(type);
        setAlertOpen(true);
    };

    const reservationMap = useMemo(() => {
        const map = new Map<string, { title: string; type: 'use' | 'setup' }>();
        existingReservations.forEach(r => {
            // Event usage
            let curr = dayjs(r.start_at).startOf('day');
            const end = dayjs(r.end_at).startOf('day');
            while (!curr.isAfter(end)) {
                map.set(curr.format('YYYY-MM-DD'), { title: r.title || "ไม่ระบุชื่อช่วง", type: 'use' });
                curr = curr.add(1, 'day');
            }

            // Setup time
            if (r.setup_start_at && r.setup_end_at) {
                let sCurr = dayjs(r.setup_start_at).startOf('day');
                const sEnd = dayjs(r.setup_end_at).startOf('day');
                while (!sCurr.isAfter(sEnd)) {
                    // Only mark as setup if it's not already marked as use (use takes priority)
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



    const useStart = useRange.startDate ?? new Date();
    const useEnd = useRange.endDate ?? useStart;
    const setupStartDate = setupRange.startDate ?? useStart;
    const setupEndDate = setupRange.endDate ?? setupStartDate;

    const labelUse = useMemo(() => fmtRange(useStart, useEnd), [useStart, useEnd]);

    // Calculate exact dates in setup range to disable them in Use tab
    const setupDateDays = useMemo(() => {
        const dates: Date[] = [];
        if (!setupRange.startDate || !setupRange.endDate) return dates;
        let curr = dayjs(setupRange.startDate).startOf('day');
        const endDay = dayjs(setupRange.endDate).startOf('day');
        // Only include if more than one click (a real range or confirmed single day)
        // But per user request, we basically disable whatever setup picked
        while (curr.isBefore(endDay) || curr.isSame(endDay, 'day')) {
            dates.push(curr.toDate());
            curr = curr.add(1, 'day');
        }
        return dates;
    }, [setupRange.startDate, setupRange.endDate]);

    const labelSetup = useMemo(
        () => fmtRange(setupStartDate, setupEndDate),
        [setupStartDate, setupEndDate]
    );

    const [focusedRange, setFocusedRange] = useState<[number, number]>([0, 0]);

    const handleSelect = (ranges: RangeKeyDict) => {
        const { use, setup } = ranges;
        const target = active === "use" ? use : setup;
        const current = active === "use" ? useRange : setupRange;
        const setter = active === "use" ? setUseRange : setSetupRange;

        if (!target?.startDate || !target?.endDate) return;

        const start = dayjs(target.startDate).startOf('day');
        const end = dayjs(target.endDate).startOf('day');
        const currStart = dayjs(current.startDate).startOf('day');
        const currEnd = dayjs(current.endDate).startOf('day');

        // Logic 1: Click same date twice when it's just a single day -> Reset
        const isSingleDay = currStart.isSame(currEnd, 'day');
        const clickedSameDay = start.isSame(currStart, 'day') && end.isSame(currStart, 'day');

        if (isSingleDay && clickedSameDay) {
            setter({ key: active, startDate: startOfDay(new Date()), endDate: startOfDay(new Date()) });
            return;
        }

        // Logic 2: Reset on new click after range formed
        const hasFullRange = !currStart.isSame(currEnd, 'day');
        const isNewClick = start.isSame(end, 'day');
        if (hasFullRange && isNewClick) {
            setter({ key: active, startDate: target.startDate, endDate: target.startDate });
            return;
        }

        // Apply selection
        setter({ key: active, startDate: target.startDate, endDate: target.endDate });

        // AUTOMATIC SWITCH: If setup is picked (range formed), jump to use
        if (active === "setup" && !start.isSame(end, 'day')) {
            setTimeout(() => setActive("use"), 300); // Slight delay for visual feedback
        }
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
        // ALWAYS use index 0 because in both cases the "active" range is the first element in the array we pass
        setFocusedRange([0, 0]);
        fetchExisting();
    }, [active, room.id]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    const hasConflict = useMemo(() => {
        const start = dayjs(buildISO(useStart, startTime));
        const end = dayjs(buildISO(useEnd, endTime, true));

        return existingReservations.some(r => {
            const rStart = dayjs(r.start_at);
            const rEnd = dayjs(r.end_at);
            return start.isBefore(rEnd) && end.isAfter(rStart);
        });
    }, [useStart, useEnd, startTime, endTime, existingReservations]);

    const validateStep = (s: number) => {
        if (s === 1) {
            const useS = timeToMinutes(startTime);
            const useE = timeToMinutes(endTime);
            if (!Number.isFinite(useS) || !Number.isFinite(useE)) return "เวลาใช้งานไม่ถูกต้อง";
            if (useS >= useE) return "เวลาใช้งาน: เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด";

            const setS = timeToMinutes(setupStart);
            const setE = timeToMinutes(setupEnd);
            if (!Number.isFinite(setS) || !Number.isFinite(setE)) return "เวลาจัดเตรียมไม่ถูกต้อง";
            if (setS >= setE) return "เวลาจัดเตรียม: เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด";

            // Date validation: Setup must be before or on Use day
            const dSetupEnd = dayjs(setupEndDate).startOf('day');
            const dUseStart = dayjs(useStart).startOf('day');

            if (dSetupEnd.isAfter(dUseStart)) {
                return "วันที่จัดเตรียมห้ามเกินวันที่ใช้งานจริง";
            }

            // If same day, setup must end before or at use start time
            if (dSetupEnd.isSame(dUseStart)) {
                const setE = timeToMinutes(setupEnd);
                const useS = timeToMinutes(startTime);
                if (setE > useS) {
                    return "ในวันที่เดียวกัน: เวลาจัดเตรียมเสร็จสิ้นต้องไม่เกินเวลาเริ่มใช้งานจริง";
                }
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
        if (msg) return showCustomAlert("ข้อมูลไม่ครบถ้วน", msg, "warning");
        if (step < 3) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const submit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const msg = validateStep(2); // วัลลิเดทข้อมูลหลักอีกครั้ง
        if (msg) return showCustomAlert("ข้อมูลไม่ครบถ้วน", msg, "warning");

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

                start_at: buildISO(useStart, startTime),
                end_at: buildISO(useEnd, endTime, true),

                setup_date: dayjs(setupStartDate).tz("Asia/Bangkok").format("YYYY-MM-DD"),
                setup_start: setupStart,
                setup_end: setupEnd,
                setup_start_at: buildISO(setupStartDate, setupStart),
                setup_end_at: buildISO(setupEndDate, setupEnd, true),

                status: "PENDING",
                current_stage: 1
            };

            const { error } = await supabase
                .from("reservations")
                .insert(payload)
                .select("id, chain_id, status, current_stage")
                .single();

            if (error) throw error;

            // Success -> Clear draft
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
            showCustomAlert("บันทึกไม่สำเร็จ", err?.message ?? "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
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

                                {/* Requester Profile Badge - Compact */}
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

                {/* Stepper Indicator */}
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

                {/* body */}
                <div className="flex flex-col gap-6 px-5 sm:px-8 py-6 sm:py-8 overflow-y-auto custom-scrollbar flex-1">
                    {step === 1 && (
                        <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
                            {/* Calendar - Rectangular & Centered */}
                            <div className="mx-auto w-full max-w-[520px] bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl p-4 border border-slate-100 dark:border-slate-700/30 overflow-hidden flex flex-col items-center shadow-sm">
                                <div className="grid grid-cols-2 p-1 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl mb-4 w-[280px]">
                                    <button
                                        type="button"
                                        onClick={() => setActive("setup")}
                                        className={`py-2 rounded-lg text-sm font-black transition-all ${active === "setup" ? "bg-white dark:bg-slate-800 text-yellow-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                        จัดเตรียม
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActive("use")}
                                        className={`py-2 rounded-lg text-sm font-black transition-all ${active === "use" ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                        วันใช้จริง
                                    </button>
                                </div>
                                <div className="w-full flex justify-center transform scale-100 origin-top mb-4 rounded-2xl overflow-hidden shadow-sm">
                                    <DateRange
                                        locale={th}
                                        ranges={active === "setup" ? [setupRange] : [useRange, setupRange]}
                                        onChange={handleSelect}
                                        focusedRange={focusedRange}
                                        // @ts-ignore
                                        onRangeFocusChange={(newRange) => {
                                            if (newRange && Array.isArray(newRange)) {
                                                setFocusedRange([0, newRange[1]]);
                                            }
                                        }}
                                        disabledDates={[
                                            ...Array.from(busyDateStrings).map(s => dayjs(s).toDate()),
                                            ...(active === "use" ? setupDateDays : [])
                                        ]}
                                        minDate={
                                            active === "use" && setupRange.startDate
                                                ? setupRange.startDate
                                                : startOfDay(new Date())
                                        }
                                        months={1}
                                        direction="vertical"
                                        showDateDisplay={false}
                                        rangeColors={active === "setup" ? ["#f59e0b"] : ["#4f46e5", "#f59e0b"]}
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

                                {/* Legend */}
                                <div className="w-full flex justify-center gap-4 mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">จัดเตรียม</span>
                                    </div>
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
                                        {active === "use" ? labelUse : labelSetup}
                                    </span>
                                </div>
                            </div>

                            {/* Times - Bottom Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-yellow-50/40 dark:bg-yellow-900/5 border border-yellow-100 dark:border-yellow-900/20 rounded-2xl p-3 flex flex-col gap-2">
                                    <div className="text-[10px] font-black text-yellow-600 uppercase tracking-widest text-center">ช่วงเวลาจัดเตรียม</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <CustomTimePicker value={setupStart} onChange={setSetupStart} label="เริ่ม" colorClass="yellow" />
                                        <CustomTimePicker value={setupEnd} onChange={setSetupEnd} label="จบ" colorClass="yellow" />
                                    </div>
                                </div>
                                <div className="bg-indigo-50/40 dark:bg-indigo-900/5 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl p-3 flex flex-col gap-2">
                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center">ช่วงเวลาใช้งานจริง</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <CustomTimePicker value={startTime} onChange={setStartTime} label="เข้า" colorClass="indigo" />
                                        <CustomTimePicker value={endTime} onChange={setEndTime} label="ออก" colorClass="indigo" />
                                    </div>
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
                            {/* Form Fields - Balanced Font Size */}
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

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                            <span className="text-[8px] font-black text-yellow-600 uppercase tracking-widest">วันจัดเตรียม</span>
                                            <span className="text-sm font-bold dark:text-white">{labelSetup}</span>
                                            <span className="text-[10px] font-medium text-slate-500">{setupStart} - {setupEnd} น.</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">วันใช้งานจริง</span>
                                            <span className="text-sm font-bold dark:text-white">{labelUse}</span>
                                            <span className="text-[10px] font-medium text-slate-500">{startTime} - {endTime} น.</span>
                                        </div>
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

                                    <div className="flex flex-col gap-0.5 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">วัตถุประสงค์</span>
                                        <span className="text-sm font-medium dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{purpose}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-8 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-8 border-t border-slate-100 dark:border-slate-800 flex gap-4 items-center">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={step === 1 ? onClose : prevStep}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-[1.5rem] px-8 py-5 font-black text-lg transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98]"
                        >
                            {step === 1 ? "ยกเลิก" : "ย้อนกลับ"}
                        </button>
                        
                        <button
                            type="button"
                            onClick={clearDraft}
                            title="ล้างข้อมูลร่าง"
                            className="bg-red-50 dark:bg-red-900/20 text-red-500 rounded-[1.5rem] px-5 py-5 font-black text-lg transition-all hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-[0.98] flex items-center justify-center border border-red-100 dark:border-red-900/30"
                        >
                            <Trash2 className="w-6 h-6" />
                        </button>
                    </div>

                    {step < 3 ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="flex-1 bg-slate-900 dark:bg-indigo-600 text-white rounded-[1.5rem] py-5 font-black text-lg transition-all hover:scale-[1.01] active:scale-[0.98] shadow-xl shadow-indigo-500/20"
                        >
                            ถัดไป
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => submit()}
                            disabled={loading}
                            className="flex-1 bg-indigo-600 dark:bg-indigo-500 text-white rounded-[1.5rem] py-5 font-black text-lg transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/30"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-6 h-6" />
                                    ยืนยันการจอง
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
            {/* Success Modal Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center transform animate-in zoom-in-95 duration-200 border dark:border-slate-800">
                        <div className="w-20 h-20 bg-green-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check className="w-10 h-10 text-green-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">ส่งคำขอจองแล้ว!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-8 leading-relaxed">
                            ระบบได้รับคำขอจองห้องของคุณเรียบร้อยแล้ว<br />
                            ขณะนี้อยู่ระหว่างรอการพิจารณาอนุมัติ
                        </p>
                        <button
                            onClick={() => {
                                setShowSuccess(false);
                                onSuccess();
                            }}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-200 dark:shadow-none"
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Alert Modal (Premium Interface) */}
            {alertOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl transform animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 border border-white/20 dark:border-slate-800">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${alertType === 'success' ? 'bg-green-100 text-green-600' :
                                alertType === 'error' ? 'bg-red-100 text-red-600' :
                                    alertType === 'warning' ? 'bg-amber-100 text-amber-600' :
                                        'bg-indigo-100 text-indigo-600'
                                }`}>
                                {alertType === 'success' && <Check className="w-10 h-10" />}
                                {alertType === 'error' && <X className="w-10 h-10" />}
                                {alertType === 'warning' && <AlertCircle className="w-10 h-10" />}
                                {alertType === 'info' && <Check className="w-10 h-10" />}
                            </div>

                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">
                                {alertTitle}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-8">
                                {alertMessage}
                            </p>

                            <button
                                onClick={() => setAlertOpen(false)}
                                className={`w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 shadow-lg ${alertType === 'success' ? 'bg-green-600 shadow-green-200 hover:bg-green-700' :
                                    alertType === 'error' ? 'bg-red-600 shadow-red-200 hover:bg-red-700' :
                                        alertType === 'warning' ? 'bg-amber-500 shadow-amber-200 hover:bg-amber-600' :
                                            'bg-primary-600 shadow-primary-200 hover:bg-primary-700'
                                    }`}
                            >
                                ตกลง
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingModal;
