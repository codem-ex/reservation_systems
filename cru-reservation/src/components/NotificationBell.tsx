import { useEffect, useState, useRef } from "react";
import { Bell, X, Check, Clock, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "react-hot-toast";

type Notification = {
    id: string;
    user_id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: 'status_change' | 'new_reservation' | string;
};

const NotificationBell = ({ userId, direction = "down" }: { userId: string, direction?: "up" | "down" }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Detect click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showDropdown]);

    const fetchNotifications = async () => {
        if (!userId) return;
        try {
            const { data } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(10);

            if (data) setNotifications(data as Notification[]);
        } catch (error) {
            console.error("Fetch notifications error:", error);
            setNotifications([]);
        }
    };

    const markAsRead = async (id: string) => {
        await supabase.from("notifications").update({ is_read: true }).eq("id", id);
        fetchNotifications();
    };

    const handleNotificationClick = (n: Notification) => {
        markAsRead(n.id);
        setShowDropdown(false);

        // Simple routing logic based on notification type/content
        if (n.title.includes("จองห้องใหม่") || n.type === "new_reservation") {
            navigate("/admin");
        } else if (n.title.includes("อนุมัติ") || n.title.includes("ปฏิเสธ")) {
            navigate("/bookings");
        }
    };

    useEffect(() => {
        if (userId) {
            console.log(`🔔 [Realtime] เริ่มต้นการเชื่อมต่อสำหรับ User: ${userId} (${direction})`);
            fetchNotifications();

            const channel = supabase
                .channel(`realtime-notifications-${userId}-${direction}`) // Unique name for each instance
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                    // นำ filter ออกแล้วเช็คใน Code แทนเพื่อความแม่นยำ (RLS จะคุมความปลอดภัยให้เอง)
                }, (payload) => {
                    console.log("⚡ [Realtime] พัสดุมาถึงแล้ว (Raw Payload):", payload);
                    const newNotif = payload.new as Notification;

                    if (!newNotif) {
                        console.warn("⚠️ [Realtime] ข้อมูลที่ส่งมาว่างเปล่า (Empty Payload)");
                        return;
                    }

                    // เช็คว่าเป็นการแจ้งเตือนของเราจริงไหม
                    if (newNotif.user_id !== userId) {
                        console.log(`⏭️ [Realtime] ข้ามแจ้งเตือนนี้ (ไม่ใช่ของเรา) -> Target: ${newNotif.user_id}, Current: ${userId}`);
                        return;
                    }

                    console.log("🚀 [Realtime] ตรวจพบแจ้งเตือนใหม่สำหรับเรา!", newNotif);

                    // 1. เล่นเสียงแจ้งเตือน
                    try {
                        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
                        audio.volume = 0.6;
                        const playPromise = audio.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(e => console.warn("🔊 เล่นเสียงไม่ได้ (ติด Browser Autoplay):", e));
                        }
                    } catch (err) {
                        console.error("🔊 Audio Error:", err);
                    }

                    // 2. กระดิ่งสั่น
                    setIsShaking(false);
                    setTimeout(() => {
                        setIsShaking(true);
                        setTimeout(() => setIsShaking(false), 800);
                    }, 10);

                    // 3. แสดง Toast เด้งขึ้นมา
                    toast.success(
                        (t) => (
                            <div className="flex flex-col gap-1 cursor-pointer pr-4" onClick={() => {
                                toast.dismiss(t.id);
                                handleNotificationClick(newNotif);
                            }}>
                                <span className="font-bold text-sm text-slate-900">{newNotif.title}</span>
                                <span className="text-xs text-slate-600 line-clamp-2">{newNotif.message}</span>
                            </div>
                        ),
                        {
                            duration: 6000,
                            icon: <Bell className="w-5 h-5 text-indigo-500 animate-bounce" />,
                            style: {
                                borderRadius: '16px',
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                padding: '16px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }
                        }
                    );

                    fetchNotifications();
                })
                .subscribe(async (status) => {
                    console.log(`📡 [Realtime] สถานะ (${direction}):`, status);
                    if (status === 'SUBSCRIBED') {
                        console.log("✅ [%cRealtime Connected%c] -> ตาราง notifications พร้อมใช้งาน!", "color: #10b981; font-weight: bold", "");
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error("❌ [%cRealtime Error%c] -> เชื่อมต่อไม่ติด! (รบกวนเช็ค SQL ในขั้นตอนที่ 1)", "color: #ef4444; font-weight: bold", "");
                    }
                    if (status === 'TIMED_OUT') {
                        console.warn("⏳ [Realtime] การเชื่อมต่อหมดเวลา (Timed Out)...");
                    }
                });

            return () => {
                console.log("📴 ยกเลิกการเชื่อมต่อ Channel");
                supabase.removeChannel(channel);
            };
        }
    }, [userId]);

    const markAllAsRead = async () => {
        if (!userId) return;
        const unread = notifications.filter(n => !n.is_read);
        if (unread.length === 0) return;
        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", userId)
            .eq("is_read", false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const toggleDropdown = () => {
        const willOpen = !showDropdown;
        setShowDropdown(willOpen);
        if (willOpen && unreadCount > 0) {
            markAllAsRead();
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={toggleDropdown}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative"
            >
                <div className={isShaking ? "animate-bell" : ""}>
                    <Bell className="w-5 h-5" />
                </div>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>
                )}
            </button>

            {showDropdown && (
                <>
                    <div className="fixed inset-0 z-[90] sm:hidden" onClick={() => setShowDropdown(false)} />

                    <div
                        className={`
                            absolute z-[100] w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-${direction === "up" ? "bottom" : "top"}-2 transition-colors
                            ${direction === "up" ? "bottom-[calc(100%+12px)] left-0" : "top-[calc(100%+12px)] -right-2 sm:right-0"}
                        `}
                    >
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">การแจ้งเตือน</span>
                            <button onClick={() => setShowDropdown(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="max-h-96 overflow-y-auto bg-white dark:bg-slate-900 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center flex flex-col items-center gap-3">
                                    <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-800">
                                        <Bell className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <div className="text-xs text-slate-400">ยังไม่มีแจ้งเตือนใหม่</div>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {notifications.map(n => (
                                        <div
                                            key={n.id}
                                            className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${!n.is_read ? 'bg-indigo-50/30 dark:bg-indigo-900/5' : ''}`}
                                            onClick={() => handleNotificationClick(n)}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0
                                                    ${n.title.includes('อนุมัติ')
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                        : n.title.includes('ปฏิเสธ')
                                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                                                    {n.title.includes('อนุมัติ') ? (
                                                        <Check className="w-4 h-4" />
                                                    ) : n.title.includes('ปฏิเสธ') ? (
                                                        <AlertCircle className="w-4 h-4" />
                                                    ) : (
                                                        <Clock className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold mb-1 text-slate-900 dark:text-white truncate">{n.title}</div>
                                                    <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{n.message}</div>
                                                    <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                                                        {format(new Date(n.created_at), "d MMM | HH:mm", { locale: th })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setShowDropdown(false);
                                navigate('/notifications');
                            }}
                            className="w-full py-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900"
                        >
                            ดูแจ้งเตือนทั้งหมด
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationBell;
