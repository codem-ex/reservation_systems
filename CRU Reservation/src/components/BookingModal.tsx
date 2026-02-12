import { useMemo, useState } from "react";
import { X, User as UserIcon, Check, Maximize2, Layers } from "lucide-react";

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
import ImageLightbox from "./ImageLightbox";

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

const timeToMinutes = (t: string) => {
    const [h, m] = t.split(":").map((x) => Number(x));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return h * 60 + m;
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

    const [active, setActive] = useState<"use" | "setup">("use");

    /* ===== form ===== */
    const [title, setTitle] = useState("");
    const [purpose, setPurpose] = useState("");
    const [agenda, setAgenda] = useState("");
    const [guestCount, setGuestCount] = useState(1);



    /* ===== time (24h) ===== */
    const [setupStart, setSetupStart] = useState("08:00");
    const [setupEnd, setSetupEnd] = useState(initialStartTime || "09:00");
    const [startTime, setStartTime] = useState(initialStartTime || "09:00");
    const [endTime, setEndTime] = useState(initialEndTime || "10:00");

    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    /* ===== Lightbox ===== */
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentImgIdx, setCurrentImgIdx] = useState(0);

    // Extract all image URLs
    const allImages = useMemo(() => {
        const list: string[] = [];
        // Legacy single URL
        const single = (room as any).imageUrl;
        if (single) list.push(single);

        // Multiple images array
        const multi = (room as any).images;
        if (Array.isArray(multi)) {
            multi.forEach(item => {
                const url = typeof item === 'string' ? item : item?.url;
                if (url && !list.includes(url)) list.push(url);
            });
        }
        return list;
    }, [room]);

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
                    agenda.trim() ? `\n(วาระการประชุม: ${agenda.trim()})` : "",
                    guestCount > 1 ? `\n(จำนวนผู้เข้าร่วม: ${guestCount} คน)` : "",
                ].filter(Boolean).join("\n"),

                start_at: buildISO(useStart, startTime),
                end_at: buildISO(useEnd, endTime, true),

                setup_date: dayjs(setupStartDate).tz("Asia/Bangkok").format("YYYY-MM-DD"),
                setup_start: setupStart,
                setup_end: setupEnd,
                setup_start_at: buildISO(setupStartDate, setupStart),
                setup_end_at: buildISO(setupEndDate, setupEnd, true),

                // ✅ ไม่ส่ง chain_id / status / current_stage ปล่อย trigger+default ทำเอง
            };

            const { data, error } = await supabase
                .from("reservations")
                .insert(payload)
                .select("id, chain_id, status, current_stage")
                .single();

            if (error) throw error;

            // ✅ ต้องได้ chain_id ถ้าตั้ง approver/chain ครบและ trigger เติมสำเร็จ
            if (!data?.chain_id) {
                alert("สร้างคำขอแล้ว แต่ไม่พบสายอนุมัติ (chain_id). กรุณาตั้ง approver_chains/steps ของห้องนี้ให้ active");
            }

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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
            <div className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border dark:border-slate-800">
                {/* header */}
                <div className="flex justify-between items-center px-8 py-6 border-b dark:border-slate-800">
                    <div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">แบบคำขอใช้ห้องประชุม</div>
                        <div className="text-xl font-semibold text-slate-900 dark:text-white">{room.name}</div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400"
                    >
                        <X />
                    </button>
                </div>

                {/* body */}
                <form
                    onSubmit={submit}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-8 py-6 max-h-[80vh] overflow-y-auto"
                >
                    {/* LEFT */}
                    <div className="space-y-6">
                        {/* Room Preview Image */}
                        {allImages.length > 0 && (
                            <div
                                className="w-full h-48 rounded-[24px] overflow-hidden border dark:border-slate-800 shadow-sm relative group cursor-pointer"
                                onClick={() => {
                                    setCurrentImgIdx(0);
                                    setLightboxOpen(true);
                                }}
                            >
                                <img
                                    src={allImages[0]}
                                    alt={room.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                        <Maximize2 className="text-white w-6 h-6" />
                                    </div>
                                </div>

                                {allImages.length > 1 && (
                                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/20 flex items-center gap-1.5 shadow-lg">
                                        <Layers className="w-3.5 h-3.5 text-white" />
                                        <span className="text-[10px] font-bold text-white">+{allImages.length - 1} รูป</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 flex items-center gap-3 border dark:border-indigo-800/30">
                            <UserIcon className="text-indigo-600 dark:text-indigo-400" />
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                ผู้จอง : <b className="text-slate-900 dark:text-white">{currentUser.name}</b>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setActive("use")}
                                className={`p-4 rounded-2xl border text-left transition-colors ${active === "use" ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                                    }`}
                            >
                                <div className="text-xs text-gray-500 dark:text-slate-400">ช่วงวันใช้งาน</div>
                                <div className={`font-semibold ${active === "use" ? "text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"}`}>{labelUse}</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActive("setup")}
                                className={`p-4 rounded-2xl border text-left transition-colors ${active === "setup" ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                                    }`}
                            >
                                <div className="text-xs text-gray-500 dark:text-slate-400">ช่วงวันจัดเตรียม</div>
                                <div className={`font-semibold ${active === "setup" ? "text-yellow-700 dark:text-yellow-400" : "text-slate-600 dark:text-slate-400"}`}>{labelSetup}</div>
                            </button>
                        </div>

                        <div className="rounded-2xl border overflow-hidden">
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

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-2xl p-4">
                            <div className="font-semibold mb-3 text-yellow-800 dark:text-yellow-400 text-sm">เวลาจัดเตรียมสถานที่</div>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="time"
                                    value={setupStart}
                                    onChange={(e) => setSetupStart(e.target.value)}
                                    className="border dark:border-slate-700 rounded-xl p-3 dark:bg-slate-800 dark:text-white"
                                />
                                <input
                                    type="time"
                                    value={setupEnd}
                                    onChange={(e) => setSetupEnd(e.target.value)}
                                    className="border dark:border-slate-700 rounded-xl p-3 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div className="space-y-6">
                        <div className="border dark:border-slate-800 rounded-2xl p-6 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">หัวข้อการขอใช้ห้องประชุม</label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="mt-2 w-full border dark:border-slate-700 rounded-xl p-3 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">วัตถุประสงค์การใช้งาน</label>
                                <textarea
                                    rows={4}
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    className="mt-2 w-full border rounded-xl p-3 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="เช่น เพื่อประชุมวางแผนงบประมาณ..."
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">วาระการประชุม / รายละเอียดเพิ่มเติม</label>
                                <textarea
                                    rows={3}
                                    value={agenda}
                                    onChange={(e) => setAgenda(e.target.value)}
                                    className="mt-2 w-full border rounded-xl p-3 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="เช่น 1. สรุปรายรับรายจ่าย 2. พิจารณาโครงการใหม่..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">จำนวนผู้เข้าร่วม (คน)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={guestCount}
                                        onChange={(e) => setGuestCount(Number(e.target.value))}
                                        className="mt-2 w-full border rounded-xl p-3 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>


                        <div className="border dark:border-slate-800 rounded-2xl p-6 bg-indigo-50/30 dark:bg-indigo-900/10">
                            <div className="font-semibold mb-3 text-indigo-800 dark:text-indigo-400 text-sm">เวลาใช้งานห้องประชุม</div>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="border dark:border-slate-700 rounded-xl p-3 dark:bg-slate-800 dark:text-white"
                                />
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="border dark:border-slate-700 rounded-xl p-3 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                        </div>

                        <button
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {loading ? "กำลังบันทึก..." : "ยืนยันคำขอใช้ห้องประชุม"}
                        </button>
                    </div>
                </form>
            </div>
            {/* Success Modal Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center transform animate-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check className="w-10 h-10 text-green-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">ส่งคำขอจองแล้ว!</h3>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            ระบบได้รับคำขอจองห้องของคุณเรียบร้อยแล้ว<br />
                            ขณะนี้อยู่ระหว่างรอการพิจารณาอนุมัติ
                        </p>
                        <button
                            onClick={() => {
                                setShowSuccess(false);
                                onSuccess();
                            }}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-200"
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            )}

            <ImageLightbox
                images={allImages}
                isOpen={lightboxOpen}
                initialIndex={currentImgIdx}
                onClose={() => setLightboxOpen(false)}
            />
        </div>
    );
};

export default BookingModal;
