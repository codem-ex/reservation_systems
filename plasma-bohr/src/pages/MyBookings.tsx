import React from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';
import { getBookings, getRooms, getCurrentUser } from '../services/storage';

const MyBookings = () => {
    const currentUser = getCurrentUser();
    const bookings = getBookings().filter(b => b.userId === currentUser?.id);
    const rooms = getRooms();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-700';
            case 'rejected': return 'bg-red-100 text-red-700';
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {bookings.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <Calendar className="w-12 h-12 mb-3 text-gray-300" />
                        <p>You haven't made any bookings yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {bookings.map(booking => {
                            const room = rooms.find(r => r.id === booking.roomId);
                            const startDate = new Date(booking.startTime);
                            const endDate = new Date(booking.endTime);

                            return (
                                <div key={booking.id} className="p-6 hover:bg-slate-50 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {room?.name || 'Unknown Room'}
                                                </h3>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(booking.status)}`}>
                                                    {booking.status}
                                                </span>
                                            </div>
                                            <p className="text-gray-500 text-sm">{booking.purpose}</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600">
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                                {format(startDate, 'MMM d, yyyy')}
                                            </div>
                                            <div className="flex items-center">
                                                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                                {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                                            </div>
                                            <div className="flex items-center">
                                                <MapPin className="w-4 h-4 mr-2 text-gray-400" />
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
