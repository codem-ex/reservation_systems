import {
    Search,
    User,
    Bell,
    ShieldCheck,
    CalendarCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UserGuide() {
    const navigate = useNavigate();

    const handleFinish = () => {
        localStorage.setItem("has_seen_user_guide", "true");
        navigate("/");
    };
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-500">
                        คู่มือการใช้งานระบบจองห้องประชุม
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-lg">
                        เรียนรู้วิธีการจองห้องและจัดการคำขอของคุณในไม่กี่นาที
                    </p>
                </div>

                <div className="space-y-8">
                    {/* STEP 1: LOGIN */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                <User className="text-indigo-600 dark:text-indigo-400 w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">1. การเข้าสู่ระบบเข้าใช้งานครั้งแรก</h2>
                                <div className="space-y-3 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                    <p>
                                        ท่านสามารถเข้าใช้งานระบบได้ทันทีผ่านบัญชี Google Account ขององค์กรเพื่อความสะดวกและรวดเร็ว
                                    </p>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <p className="font-bold text-slate-800 dark:text-white mb-2">ข้อมูลที่ต้องระบุเพิ่มเติมในครั้งแรก:</p>
                                        <ul className="list-disc list-inside space-y-1 text-xs">
                                            <li>แผนกหรือสังกัด (เพื่อระบุที่มาของคำขอ)</li>
                                            <li>เบอร์โทรศัพท์มือถือ (สำหรับการติดต่อสอบถามกรณีเร่งด่วน)</li>
                                        </ul>
                                    </div>
                                    <p className="text-[11px] text-indigo-500 font-medium">หมายเหตุ: ข้อมูลนี้จะถูกบันทึกไว้เพียงครั้งเดียวและสามารถแก้ไขได้ในภายหลังที่หน้าโปรไฟล์</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* STEP 2: SEARCH */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                                <Search className="text-emerald-600 dark:text-emerald-400 w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">2. วิธีการค้นหาและตรวจสอบห้องว่าง</h2>
                                <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                    <p>
                                        ท่านสามารถเลือกดูรายการห้องประชุมทั้งหมดได้จากเมนู "ค้นหาห้องประชุม" พร้อมระบบกรองข้อมูลที่แม่นยำ
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100/50 dark:border-emerald-800/30">
                                            <span className="block font-bold text-emerald-700 dark:text-emerald-400 mb-1">กรองข้อมูล:</span>
                                            <p className="text-[11px]">ระบุวันที่ เวลาที่เริ่ม/จบ และจำนวนผู้เข้าร่วม เพื่อให้ระบบแสดงเฉพาะห้องที่ว่างจริงๆ เท่านั้น</p>
                                        </div>
                                        <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100/50 dark:border-blue-800/30">
                                            <span className="block font-bold text-blue-700 dark:text-blue-400 mb-1">เลือกจอง:</span>
                                            <p className="text-[11px]">เมื่อพบห้องที่ถูกใจ สามารถคลิกที่ปุ่ม "จองห้องนี้" หรือคลิกที่รูปภาพเพื่อดูรายละเอียดสิ่งอำนวยความสะดวกก่อนได้</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* STEP 3: BOOKING PROCESS */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                                <CalendarCheck className="text-amber-600 dark:text-amber-400 w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">3. ขั้นตอนการทำรายการจอง (3 ขั้นตอนสั้นๆ)</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="text-xs font-bold text-amber-600 mb-2 underline decoration-2">ขั้นที่ 1: วันและเวลา</div>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                            เลือกวันและเวลาที่ใช้งานจริงเป็นหลัก และหากต้องการจัดสถานที่ล่วงหน้า สามารถเปิดสวิตช์ "ต้องการเวลาจัดเตรียมห้อง" ได้เลย
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="text-xs font-bold text-amber-600 mb-2 underline decoration-2">ขั้นที่ 2: กรอกข้อมูล</div>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                            กรอกหัวข้อการประชุม วัตถุประสงค์ และจำนวนผู้ใช้ (เลือกจากรายการหรือระบุเองได้จนถึง 200 คน)
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="text-xs font-bold text-amber-600 mb-2 underline decoration-2">ขั้นที่ 3: ตรวจสอบและส่ง</div>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                            ตรวจสอบสรุปข้อมูลเป็นครั้งสุดท้ายก่อนกดปุ่ม "ยืนยันการจอง" เพื่อส่งไปยังผู้ดูแลระบบ
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* STEP 4: TRACKING */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                                <Bell className="text-blue-600 dark:text-blue-400 w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">4. การติดตามและแจ้งเตือน Real-time</h2>
                                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                                    ระบบจะแจ้งเตือนความคืบหน้าให้ท่านทราบทันทีเมื่อมีผู้ดูแลระบบดำเนินการ (โดยไม่ต้องกด Refresh หน้าเว็บ)
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <span className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] px-3 py-2 rounded-xl font-bold border border-indigo-100 dark:border-indigo-800">
                                        <span className="animate-bounce">🔔</span> กระดิ่งแจ้งเตือนสั่น
                                    </span>
                                    <span className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] px-3 py-2 rounded-xl font-bold border border-amber-100 dark:border-amber-800">
                                        📢 เสียงเตือนกิจกรรม
                                    </span>
                                    <span className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] px-3 py-2 rounded-xl font-bold border border-emerald-100 dark:border-emerald-800">
                                        📊 สถานะอัปเดตอัตโนมัติ
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SHORTCUT TIP */}
                    <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium italic">
                        เคล็ดลับ: คลิกที่ชื่อ "ระบบจองห้องประชุม" ในแถบข้างเพื่อกลับหน้าแรกได้ทันที!
                    </p>

                    {/* ADMIN SECTION */}
                    <div className="pt-6 border-t dark:border-slate-800">
                        <section className="bg-slate-900 rounded-3xl p-8 text-white">
                            <div className="flex items-start gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="text-white w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-bold mb-3 text-indigo-400">สำหรับผู้ดูแลระบบและผู้อนุมัติ</h2>
                                    <div className="space-y-3 text-xs text-slate-300">
                                        <div className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                            <p>ตรวจสอบและอนุมัติรายการที่ค้างอยู่ได้จากเมนู "จัดการระบบ" โดยจะแสดงลำดับการอนุมัติ (Chain) อย่างชัดเจน</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                            <p>เมื่อรายการได้รับการอนุมัติเสร็จสมบูรณ์ ระบบจะซิงค์ข้อมูลเข้าสู่ Google Calendar โดยอัตโนมัติเพื่อให้คนอื่นๆ เห็นหัวข้อกิจกรรม</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <button
                        onClick={handleFinish}
                        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg"
                    >
                        เข้าใจแล้ว เริ่มใช้งานเลย!
                    </button>
                </div>
            </div>
        </div>
    );
}
