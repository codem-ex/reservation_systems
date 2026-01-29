import React, { useMemo, useState } from "react";
import { X, User as UserIcon } from "lucide-react";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { DateRange, Range, RangeKeyDict } from "react-date-range";
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
    onClose,
    onSuccess,
}) => {
    /* ===== ranges ===== */
    const [useRange, setUseRange] = useState<Range>({
        key: "use",
        startDate: startOfDay(new Date()),
        endDate: startOfDay(new Date()),
    });

    const [setupRange, setSetupRange] = useState<Range>({
        key: "setup",
        startDate: startOfDay(new Date()),
        endDate: startOfDay(new Date()),
    });

    const [active, setActive] = useState<"use" | "setup">("use");

    /* ===== form ===== */
    const [title, setTitle] = useState("");
    const [purpose, setPurpose] = useState("");

    /* ===== time (24h) ===== */
    const [setupStart, setSetupStart] = useState("08:00");
    const [setupEnd, setSetupEnd] = useState("09:00");
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("10:00");

    const [loading, setLoading] = useState(false);

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
                purpose: purpose.trim(),

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

            onSuccess();
        } catch (err: any) {
            alert(err?.message ?? "บันทึกไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
            <div className="w-full max-w-6xl bg-white rounded-[32px] shadow-2xl overflow-hidden">
                {/* header */}
                <div className="flex justify-between items-center px-8 py-6 border-b">
                    <div>
                        <div className="text-sm text-gray-500">แบบคำขอใช้ห้องประชุม</div>
                        <div className="text-xl font-semibold">{room.name}</div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
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
                        <div className="bg-indigo-50 rounded-2xl p-4 flex items-center gap-3">
                            <UserIcon className="text-indigo-600" />
                            <div className="text-sm">
                                ผู้จอง : <b>{currentUser.name}</b>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setActive("use")}
                                className={`p-4 rounded-2xl border text-left ${active === "use" ? "bg-indigo-50 border-indigo-300" : "border-gray-200"
                                    }`}
                            >
                                <div className="text-xs text-gray-500">ช่วงวันใช้งาน</div>
                                <div className="font-semibold text-indigo-700">{labelUse}</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActive("setup")}
                                className={`p-4 rounded-2xl border text-left ${active === "setup" ? "bg-yellow-50 border-yellow-300" : "border-gray-200"
                                    }`}
                            >
                                <div className="text-xs text-gray-500">ช่วงวันจัดเตรียม</div>
                                <div className="font-semibold text-yellow-700">{labelSetup}</div>
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

                        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                            <div className="font-semibold mb-3">เวลาจัดเตรียมสถานที่</div>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="time"
                                    value={setupStart}
                                    onChange={(e) => setSetupStart(e.target.value)}
                                    className="border rounded-xl p-3"
                                />
                                <input
                                    type="time"
                                    value={setupEnd}
                                    onChange={(e) => setSetupEnd(e.target.value)}
                                    className="border rounded-xl p-3"
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div className="space-y-6">
                        <div className="border rounded-2xl p-6 space-y-4">
                            <div>
                                <label className="text-sm font-medium">หัวข้อการขอใช้ห้องประชุม</label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="mt-2 w-full border rounded-xl p-3"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">วัตถุประสงค์การใช้งาน</label>
                                <textarea
                                    rows={4}
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    className="mt-2 w-full border rounded-xl p-3"
                                />
                            </div>
                        </div>

                        <div className="border rounded-2xl p-6">
                            <div className="font-semibold mb-3">เวลาใช้งานห้องประชุม</div>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="border rounded-xl p-3"
                                />
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="border rounded-xl p-3"
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
        </div>
    );
};

export default BookingModal;
