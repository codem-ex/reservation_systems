import { useEffect, useState } from "react";
import { Bell, X, Check, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { format } from "date-fns";
import { th } from "date-fns/locale";

type Notification = {
    id: string;
    user_id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: 'status_change' | 'new_reservation' | string;
};

const NotificationBell = ({ userId }: { userId: string }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const fetchNotifications = async () => {
        try {
            const { data } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(10);

            if (data) setNotifications(data as Notification[]);
        } catch (error) {
            setNotifications([]);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchNotifications();

            const channel = supabase
                .channel('notifications')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                    () => fetchNotifications())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [userId]);

    const markAsRead = async (id: string) => {
        await supabase.from("notifications").update({ is_read: true }).eq("id", id);
        fetchNotifications();
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute right-[-60px] bottom-12 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-bottom-2 transition-colors">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                        <span className="font-bold text-slate-900 dark:text-white">การแจ้งเตือน</span>
                        <button onClick={() => setShowDropdown(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto bg-white dark:bg-slate-900">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                ไม่มีแจ้งเตือนใหม่
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                {notifications.map(n => (
                                    <div
                                        key={n.id}
                                        className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${!n.is_read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                        onClick={() => markAsRead(n.id)}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center
                                                ${n.title.includes('อนุมัติ') ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                                                {n.title.includes('อนุมัติ') ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs font-bold mb-1 text-slate-900 dark:text-white">{n.title}</div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{n.message}</div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                                                    {format(new Date(n.created_at), "d MMM HH:mm", { locale: th })}
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
                        className="w-full py-3 text-xs font-semibold text-primary-600 dark:text-primary-400 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900"
                    >
                        ดูทั้งหมด
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
