import {
    Search,
    User,
    Bell,
    ShieldCheck,
    Settings,
    ArrowRight,
    MousePointer2,
    CalendarCheck,
    LayoutDashboard
} from "lucide-react";

export default function UserGuide() {
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

                <div className="space-y-12">
                    {/* STEP 1: LOGIN & PROFILE */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 transition-transform hover:scale-[1.01]">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                <User className="text-indigo-600 dark:text-indigo-400 w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">1. การเข้าสู่ระบบและตั้งค่าโปรไฟล์</h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                                    เมื่อเข้าใช้งานครั้งแรก ระบบจะให้คุณเข้าสู่ระบบผ่าน Google และกรอกข้อูลเบื้องต้น เช่น เบอร์โทรศัพท์ และ แผนก/สาขา เพื่อให้แอดมินสามารถติดต่อประสานงานได้
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border dark:border-slate-700">
                                        <div className="font-semibold text-sm mb-2 text-indigo-600 dark:text-indigo-400">จุดสำคัญ</div>
                                        <ul className="text-sm space-y-2 text-slate-600 dark:text-slate-400">
                                            <li>• ต้องกรอกเบอร์โทรที่ติดต่อได้จริง</li>
                                            <li>• เลือกหน่วยงานสังกัดให้ถูกต้อง</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* STEP 2: SEARCH */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 transition-transform hover:scale-[1.01]">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                                <Search className="text-emerald-600 dark:text-emerald-400 w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">2. การค้นหาห้องที่ว่าง</h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                                    ไปที่เมนู <span className="font-bold text-indigo-600 dark:text-indigo-400 italic">"จองห้องประชุม"</span> เลือกวันที่คุณต้องการใช้งาน ระบบจะคัดกรองเฉพาะห้องที่ **ว่าง** ในเวลานั้นมาให้คุณทันที
                                </p>
                                <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border dark:border-slate-700">
                                    <div className="text-center p-8">
                                        <div className="flex justify-center mb-4">
                                            <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-900 shadow-lg flex items-center justify-center">
                                                <MousePointer2 className="text-indigo-600 w-8 h-8" />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500">จำลอง: การคลิกเลือกวันที่จากปฏิทิน</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* STEP 3: BOOKING PROCESS */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 transition-transform hover:scale-[1.01]">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                                <CalendarCheck className="text-amber-600 dark:text-amber-400 w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">3. ขั้นตอนการกรอกข้อมูลจอง</h2>
                                <div className="space-y-4 text-slate-600 dark:text-slate-400">
                                    <div className="flex gap-4">
                                        <div className="font-bold text-amber-600">A.</div>
                                        <p>เลือกช่วงวัน **จัดเตรียมสถานที่** (ถ้ามี) และช่วงวัน **ใช้งานจริง**</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="font-bold text-amber-600">B.</div>
                                        <p>เลือก **อุปกรณ์ (Amenities)** ที่มีในห้องเพื่อแจ้งความประสงค์</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="font-bold text-amber-600">C.</div>
                                        <p>ระบุหัวข้อประชุมและจำนวนคนให้ชัดเจน</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* STEP 4: TRACKING */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 transition-transform hover:scale-[1.01]">
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                                <Bell className="text-blue-600 dark:text-blue-400 w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">4. การติดตามสถานะ</h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                                    คุณสามารถดูสถานะการจองย้อนหลังได้ที่เมนู <span className="font-bold italic">"การจองของฉัน"</span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-bold ring-1 ring-yellow-200 dark:ring-yellow-800">รออนุมัติ</span>
                                    <ArrowRight className="w-4 h-4 self-center text-slate-400" />
                                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold ring-1 ring-emerald-200 dark:ring-emerald-800">อนุมัติเรียบร้อย</span>
                                </div>
                                <p className="mt-4 text-sm text-slate-500">
                                    *หากห้องถูกปฏิเสธ คุณจะเห็น **"เหตุผลการปฏิเสธ"** เพื่อนำไปแก้ไขข้อมูลต่อไป
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ADMIN SECTION */}
                    <div className="pt-8 border-t dark:border-slate-800">
                        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 shadow-2xl text-white">
                            <div className="flex items-start gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                                    <ShieldCheck className="text-white w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-4">สำหรับผู้ดูแลระบบ (Admin)</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <LayoutDashboard className="w-4 h-4" />
                                                <span className="font-semibold">ระบบ Dashboard</span>
                                            </div>
                                            <p className="text-sm text-indigo-100">รวมรวมสถิติการใช้งานห้องประชุม และสรุปรายการที่ต้องพิจารณาเร่งด่วน</p>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Settings className="w-4 h-4" />
                                                <span className="font-semibold">การจัดการห้อง</span>
                                            </div>
                                            <p className="text-sm text-indigo-100">เพิ่ม/ลบ ห้องประชุม และตั้งค่าสถานะ "อยู่ระหว่างซ่อมบำรุง" ได้ทันที</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <button
                        onClick={() => window.history.back()}
                        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg"
                    >
                        เข้าใจแล้ว เริ่มใช้งานเลย!
                    </button>
                </div>
            </div>
        </div>
    );
}
