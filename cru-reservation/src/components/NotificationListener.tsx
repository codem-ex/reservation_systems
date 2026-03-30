import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import { toast } from "react-hot-toast";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NotificationListener = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user?.id) return;

        console.log("👂 [Global Listener] เริ่มต้นการฟังแจ้งเตือนระบบ...");

        const channel = supabase
            .channel(`global-notifications-${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                const newNotif = payload.new;
                if (!newNotif) return;

                console.log("🚀 [Global Listener] ตรวจพบแจ้งเตือนใหม่!", newNotif);

                // 1. เล่นเสียงแจ้งเตือน (ครั้งเดียว)
                try {
                    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
                    audio.volume = 0.5;
                    audio.play().catch(() => console.warn("🔊 Autoplay blocked"));
                } catch (e) {
                    console.error("Audio error", e);
                }

                // 2. แสดง Pop-up (ครั้งเดียว)
                const isDark = document.documentElement.classList.contains("dark");
                
                toast.success(
                    (t) => (
                        <div className="flex flex-col gap-1 cursor-pointer pr-4 min-w-[200px]" onClick={() => {
                            toast.dismiss(t.id);
                            if (newNotif.title.includes("จอง") || newNotif.type === "new_reservation") {
                                navigate("/admin");
                            } else {
                                navigate("/bookings");
                            }
                        }}>
                            <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{newNotif.title}</span>
                            <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'} line-clamp-2`}>{newNotif.message}</span>
                        </div>
                    ),
                    {
                        duration: 6000,
                        position: "top-right",
                        icon: <Bell className="w-5 h-5 text-indigo-500 animate-bounce" />,
                        style: {
                            borderRadius: '16px',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                            color: isDark ? '#f8fafc' : '#1e293b',
                            padding: '16px',
                            boxShadow: isDark 
                                ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' 
                                : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            zIndex: 9999
                        }
                    }
                );
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, navigate]);

    return null; // ตัวนี้เป็น Logic เปล่าๆ ไม่ต้องแสดงผลอะไร
};

export default NotificationListener;
