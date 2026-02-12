import { format } from 'date-fns';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { getBookings, getRooms, getCurrentUser } from '../services/storage';

const MyBookings = () => {
    const currentUser = getCurrentUser();
    const bookings = getBookings().filter(b => b.userId === currentUser?.id);
    const rooms = getRooms();

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'approved') return 'bg-green-100 text-green-700';
        if (s === 'rejected' || s === 'cancelled') return 'bg-red-100 text-red-700';
        if (s === 'pending') return 'bg-yellow-100 text-yellow-700';
        return 'bg-gray-100 text-gray-700';
    };

    const getStatusThai = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'approved') return 'อนุมัติแล้ว';
        if (s === 'rejected') return 'ปฏิเสธ';
        if (s === 'cancelled') return 'ยกเลิกแล้ว';
        if (s === 'pending') return 'รออนุมัติ';
        return status;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">การจองของฉัน</h1>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                {bookings.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 dark:text-slate-400 flex flex-col items-center">
                        <Calendar className="w-12 h-12 mb-3 text-gray-300 dark:text-slate-700" />
                        <p>คุณยังไม่มีรายการจองห้องประชุม</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {bookings.map(booking => {
                            const room = rooms.find(r => r.id === booking.roomId);
                            const startDate = new Date(booking.start_at);
                            const endDate = new Date(booking.end_at);

                            return (
                                <div key={booking.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {room?.name || 'ไม่ทราบชื่อห้อง'}
                                                </h3>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(booking.status).replace('bg-', 'bg-').replace('text-', 'text-').includes('green') ? 'dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' : getStatusColor(booking.status).includes('red') ? 'dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' : 'dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800/50'} ${getStatusColor(booking.status)}`}>
                                                    {getStatusThai(booking.status)}
                                                </span>
                                            </div>
                                            <p className="text-gray-500 dark:text-slate-400 text-sm">{booking.purpose}</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600 dark:text-slate-400">
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500" />
                                                {format(startDate, 'MMM d, yyyy')}
                                            </div>
                                            <div className="flex items-center">
                                                <Clock className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500" />
                                                {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                                            </div>
                                            <div className="flex items-center">
                                                <MapPin className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500" />
                                                {room?.type}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyBookings;
