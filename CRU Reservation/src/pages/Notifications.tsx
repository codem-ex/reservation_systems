import { useEffect, useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Bell, Check, Clock, Trash2, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

type Notification = {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: string;
};

const Notifications = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (data) setNotifications(data as Notification[]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [user?.id]);

    const markAsRead = async (id: string) => {
        await supabase.from("notifications").update({ is_read: true }).eq("id", id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const markAllAsRead = async () => {
        if (!user) return;
        await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const deleteNotification = async (id: string) => {
        await supabase.from("notifications").delete().eq("id", id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>กำลังโหลดการแจ้งเตือน...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">การแจ้งเตือนทั้งหมด</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        คุณมีการแจ้งเตือนทั้งหมด {notifications.length} รายการ
                    </p>
                </div>
                {notifications.some(n => !n.is_read) && (
                    <button
                        onClick={markAllAsRead}
                        className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                {notifications.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">ไม่มีการแจ้งเตือน</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">คุณจะได้รับการแจ้งเตือนเมื่อมีการเปลี่ยนแปลงสถานะการจอง</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {notifications.map(n => (
                            <div
                                key={n.id}
                                className={`p-6 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${!n.is_read ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                                    ${n.title.includes('อนุมัติ') ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                                    {n.title.includes('อนุมัติ') ? <Check className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-slate-900 dark:text-white">{n.title}</div>
                                        <div className="text-xs text-slate-400">
                                            {format(new Date(n.created_at), "d MMMM yyyy HH:mm", { locale: th })}
                                        </div>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 mt-1">{n.message}</p>
                                    <div className="mt-3 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!n.is_read && (
                                            <button
                                                onClick={() => markAsRead(n.id)}
                                                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                                            >
                                                ทำเครื่องหมายว่าอ่านแล้ว
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteNotification(n.id)}
                                            className="text-xs font-semibold text-red-500 hover:underline flex items-center gap-1"
                                        >
                                            <Trash2 className="w-3 h-3" /> ลบ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
