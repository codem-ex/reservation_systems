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
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                <User className="text-indigo-600 dark:text-indigo-400 w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">1. การเข้าสู่ระบบ</h2>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                    เข้าใช้งานด้วย **Google Account** หากเข้าใช้งานครั้งแรก ระบบจะให้กรอกข้อมูล **แผนก** และ **เบอร์โทรศัพท์** เพื่อใช้สำหรับติดต่อและแจ้งผลการอนุมัติ
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* STEP 2: SEARCH */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                                <Search className="text-emerald-600 dark:text-emerald-400 w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">2. วิธีการค้นหาห้อง</h2>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4">
                                    ไปที่เมนู **"ค้นหาห้องประชุม"** ระบุวันที่ เวลา และจำนวนผู้เข้าร่วมเพื่อกรองห้องที่ว่าง จากนั้นคลิกปุ่ม **"จองห้องนี้"** ในห้องที่ต้องการ
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* STEP 3: BOOKING PROCESS */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                                <CalendarCheck className="text-amber-600 dark:text-amber-400 w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">3. ขั้นตอนการกรอกข้อมูลการจอง</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border dark:border-slate-700">
                                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">ขั้นตอนที่ 1</div>
                                        <h4 className="text-sm font-bold mb-1 dark:text-white">ระบุเวลา</h4>
                                        <p className="text-[11px] text-slate-500">เลือกช่วงเวลาจัดเตรียมห้อง และเวลาใช้งานจริง</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border dark:border-slate-700">
                                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">ขั้นตอนที่ 2</div>
                                        <h4 className="text-sm font-bold mb-1 dark:text-white">กรอกรายละเอียด</h4>
                                        <p className="text-[11px] text-slate-500">ระบุชื่อโครงการ และเลือกจำนวนผู้ใช้จากรายการ</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border dark:border-slate-700">
                                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">ขั้นตอนที่ 3</div>
                                        <h4 className="text-sm font-bold mb-1 dark:text-white">กดยืนยัน</h4>
                                        <p className="text-[11px] text-slate-500">ตรวจสอบความถูกต้องทั้งหมดเพื่อส่งคำขอ</p>
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
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">4. การติดตามผล</h2>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                    ตรวจสอบสถานะการจองของคุณได้ที่เมนู **"การจองของฉัน"** หากการจองได้รับการอนุมัติ ข้อมูลจะถูกบันทึกลงในปฏิทินกลางของห้องนั้นทันที
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ADMIN SECTION */}
                    <div className="pt-6 border-t dark:border-slate-800">
                        <section className="bg-slate-900 rounded-3xl p-8 text-white">
                            <div className="flex items-start gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="text-white w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-bold mb-3">สำหรับผู้ดูแลระบบและผู้อนุมัติ</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
                                        <div className="flex gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                                            <p>ตรวจสอบและอนุมัติรายการในเมนู **จัดการระบบ**</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                                            <p>รายการที่อนุมัติแล้วจะซิงค์เข้า **Google Calendar** อัตโนมัติ</p>
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
