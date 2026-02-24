import { useEffect, useMemo, useState } from "react";
import { X, User as UserIcon, Check, Users } from "lucide-react";

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
    const [guestCount, setGuestCount] = useState<number | string>(1);



    /* ===== time (24h) ===== */
    const [setupStart, setSetupStart] = useState("08:00");
    const [setupEnd, setSetupEnd] = useState(initialStartTime || "09:00");
    const [startTime, setStartTime] = useState(initialStartTime || "09:00");
    const [endTime, setEndTime] = useState(initialEndTime || "10:00");

    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [existingReservations, setExistingReservations] = useState<any[]>([]);



    const useStart = useRange.startDate ?? new Date();
    const useEnd = useRange.endDate ?? useStart;
    const setupStartDate = setupRange.startDate ?? useStart;
    const setupEndDate = setupRange.endDate ?? setupStartDate;

    const labelUse = useMemo(() => fmtRange(useStart, useEnd), [useStart, useEnd]);
    const labelSetup = useMemo(
        () => fmtRange(setupStartDate, setupEndDate),
        [setupStartDate, setupEndDate]
    );

    const onRangeChange = (item: RangeKeyDict) => {
        const r = item[active];
        if (!r?.startDate || !r?.endDate) return;

        if (active === "use") {
            setUseRange({ key: "use", startDate: r.startDate, endDate: r.endDate });
        } else {
            setSetupRange({
                key: "setup",
                startDate: r.startDate,
                endDate: r.endDate,
            });
        }
    };

    const fetchExisting = async () => {
        try {
            const { data } = await supabase
                .from("reservations")
                .select("start_at, end_at, status")
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

    const hasConflict = useMemo(() => {
        const start = dayjs(buildISO(useStart, startTime));
        const end = dayjs(buildISO(useEnd, endTime, true));

        return existingReservations.some(r => {
            const rStart = dayjs(r.start_at);
            const rEnd = dayjs(r.end_at);
            return start.isBefore(rEnd) && end.isAfter(rStart);
        });
    }, [useStart, useEnd, startTime, endTime, existingReservations]);

    const validate = () => {
        if (!title.trim()) return "กรุณาระบุหัวข้อการขอใช้ห้องประชุม";
        if (!purpose.trim()) return "กรุณาระบุวัตถุประสงค์การใช้งาน";

        const useS = timeToMinutes(startTime);
        const useE = timeToMinutes(endTime);
        if (!Number.isFinite(useS) || !Number.isFinite(useE)) return "เวลาใช้งานไม่ถูกต้อง";
        if (useS >= useE) return "เวลาใช้งาน: เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด";

        const setS = timeToMinutes(setupStart);
        const setE = timeToMinutes(setupEnd);
        if (!Number.isFinite(setS) || !Number.isFinite(setE)) return "เวลาจัดเตรียมไม่ถูกต้อง";
        if (setS >= setE) return "เวลาจัดเตรียม: เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด";

        if (hasConflict) return "ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น";

        return "";
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();

        const msg = validate();
        if (msg) return alert(msg);

        setLoading(true);
        try {
            // ✅ ทำให้ profiles.email ไม่ว่าง (แก้ root cause ของ to_email=null)
            await ensureProfileEmail();

            const payload = {
                room_id: room.id,
                requester_id: currentUser.id,
                title: title.trim(),
                purpose: [
                    purpose.trim(),
                    Number(guestCount) > 1 ? `\n(จำนวนผู้เข้าร่วม: ${guestCount} คน)` : "",
                ].filter(Boolean).join("\n"),

                start_at: buildISO(useStart, startTime),
                end_at: buildISO(useEnd, endTime, true),

                setup_date: dayjs(setupStartDate).tz("Asia/Bangkok").format("YYYY-MM-DD"),
                setup_start: setupStart,
                setup_end: setupEnd,
                setup_start_at: buildISO(setupStartDate, setupStart),
                setup_end_at: buildISO(setupEndDate, setupEnd, true),

                // ✅ ยุบเหลือขั้นตอนเดียว (แอดมินอนุมัติ)
                status: "PENDING",
                current_stage: 1
            };

            const { error } = await supabase
                .from("reservations")
                .insert(payload)
                .select("id, chain_id, status, current_stage")
                .single();

            if (error) throw error;

            // ✅ 1. Add notification for the user who booked
            await supabase.from("notifications").insert({
                user_id: currentUser.id,
                title: "ส่งคำขอจองห้องแล้ว",
                message: `ส่งคำขอจองห้อง "${room.name}" สำหรับหัวข้อ "${title}" เรียบร้อยแล้ว ขณะนี้อยู่ระหว่างรอการอนุมัติ`,
                type: 'new_reservation',
                is_read: false
            });

            // ✅ 2. Notify all Admins that there is a new request
            const { data: admins } = await supabase.from("profiles").select("id").eq("is_admin", true);
            if (admins && admins.length > 0) {
                const adminNotifs = admins.map(admin => ({
                    user_id: admin.id,
                    title: "มีคำขอจองห้องใหม่",
                    message: `มีรายการขอใช้ห้อง "${room.name}" จากคุณ ${currentUser.name} (หัวข้อ: ${title})`,
                    type: 'new_reservation',
                    is_read: false
                })).filter(n => n.user_id !== currentUser.id); // Don't notify self if admin is the one booking

                if (adminNotifs.length > 0) {
                    await supabase.from("notifications").insert(adminNotifs);
                }
            }

            setShowSuccess(true);
        } catch (err: any) {
            alert(err?.message ?? "บันทึกไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-slate-800/50 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-slate-900 dark:bg-black px-6 py-4 relative border-b border-white/5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1.5 leading-none">แบบคำขอใช้ห้องประชุม</h2>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-xl font-black text-white tracking-tight truncate shrink-0">{room.name}</h1>

                                {/* Requester Profile Badge - Compact */}
                                <div className="flex items-center gap-2 bg-white/5 p-1.5 px-2.5 rounded-lg border border-white/5 backdrop-blur-md shrink-0">
                                    <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <UserIcon className="text-white w-3 h-3" />
                                    </div>
                                    <div className="text-[10px] font-bold text-white leading-none">{currentUser.name}</div>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white/40 hover:text-white" />
                        </button>
                    </div>
                </div>

                {/* body */}
                <form
                    onSubmit={submit}
                    className="flex flex-col gap-6 px-8 py-8 overflow-y-auto custom-scrollbar flex-1"
                >

                    {/* Date & Time Selection (One Row) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Calendar */}
                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-[32px] p-2 border border-slate-100 dark:border-slate-700/30 overflow-hidden flex flex-col items-center">
                            <div className="grid grid-cols-2 p-1 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl mb-1 w-full">
                                <button
                                    type="button"
                                    onClick={() => setActive("setup")}
                                    className={`py-1.5 rounded-lg text-[10px] font-black transition-all ${active === "setup" ? "bg-white dark:bg-slate-800 text-yellow-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    จัดเตรียม
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActive("use")}
                                    className={`py-1.5 rounded-lg text-[10px] font-black transition-all ${active === "use" ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    วันใช้จริง
                                </button>
                            </div>
                            <div className="transform scale-[0.8] origin-top -mt-2 -mb-8">
                                <DateRange
                                    locale={th}
                                    ranges={[useRange, setupRange]}
                                    onChange={onRangeChange}
                                    focusedRange={active === "use" ? [0, 0] : [1, 0]}
                                    showDateDisplay={false}
                                    months={1}
                                    direction="horizontal"
                                    rangeColors={["#4f46e5", "#f59e0b"]}
                                    minDate={startOfDay(new Date())}
                                />
                            </div>
                            <div className="w-full text-center py-2 text-[10px] border-t border-slate-100 dark:border-slate-800 mt-2">
                                <span className="font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                    {active === "use" ? labelUse : labelSetup}
                                </span>
                            </div>
                        </div>

                        {/* Times */}
                        <div className="flex flex-col gap-3">
                            <div className="bg-yellow-50/40 dark:bg-yellow-900/5 border border-yellow-100 dark:border-yellow-900/20 rounded-2xl p-3 flex flex-col gap-2">
                                <div className="text-[8px] font-black text-yellow-600 uppercase tracking-widest text-center">ช่วงเวลาจัดเตรียม</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <CustomTimePicker value={setupStart} onChange={setSetupStart} label="เริ่ม" colorClass="yellow" />
                                    <CustomTimePicker value={setupEnd} onChange={setSetupEnd} label="จบ" colorClass="yellow" />
                                </div>
                            </div>
                            <div className="bg-indigo-50/40 dark:bg-indigo-900/5 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl p-3 flex flex-col gap-2">
                                <div className="text-[8px] font-black text-indigo-600 uppercase tracking-widest text-center">ช่วงเวลาใช้งานจริง</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <CustomTimePicker value={startTime} onChange={setStartTime} label="เข้า" colorClass="indigo" />
                                    <CustomTimePicker value={endTime} onChange={setEndTime} label="ออก" colorClass="indigo" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">หัวข้อการจอง</label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="หัวข้อการประชุม..."
                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold dark:text-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">จำนวนผู้ร่วม (คน)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={1}
                                        value={guestCount}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => setGuestCount(e.target.value === "" ? "" : Number(e.target.value))}
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-10 py-2.5 text-xs font-black text-slate-800 dark:text-white focus:border-indigo-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">วัตถุประสงค์</label>
                            <textarea
                                rows={2}
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold dark:text-white focus:border-indigo-500 outline-none resize-none"
                                placeholder="วัตถุประสงค์การใช้งาน..."
                            />
                        </div>

                    </div>

                    <div className="sticky bottom-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl pt-2 pb-1 border-t dark:border-slate-800 mt-2">
                        <button
                            type="submit"
                            disabled={loading || !!validate()}
                            className="group w-full bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl py-3.5 font-black text-sm transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    {hasConflict ? "ถูกจองไปแล้ว" : "ยืนยันการขอใช้ห้อง"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
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
        </div>
    );
};

export default BookingModal;
