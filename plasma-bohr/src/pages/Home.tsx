import React from 'react';
import { Link } from 'react-router-dom';
import { Search, CalendarDays, Clock } from 'lucide-react';
import { getRooms, getBookings, getCurrentUser } from '../services/storage';

const Home = () => {
    const user = getCurrentUser();
    const rooms = getRooms();
    const allBookings = getBookings();
    const myBookings = allBookings.filter(b => b.userId === user?.id);

    // Quick stats
    const activeBookings = myBookings.filter(b => b.status === 'approved' || b.status === 'pending').length;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name.split(' ')[0]}!</h1>
                <p className="text-gray-500 mt-2">Here's what's happening with your room bookings.</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary-600 rounded-xl p-6 text-white shadow-lg shadow-primary-200 transition-transform hover:scale-[1.02] cursor-pointer">
                    <Link to="/search">
                        <div className="flex items-center justify-between mb-4">
                            <Search className="w-8 h-8 opacity-80" />
                            <span className="bg-primary-500 px-3 py-1 rounded-full text-xs font-semibold">New</span>
                        </div>
                        <h3 className="text-xl font-bold mb-1">Find a Room</h3>
                        <p className="text-primary-100 text-sm">Search available rooms by time and capacity.</p>
                    </Link>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <CalendarDays className="w-8 h-8 text-blue-500" />
                        <span className="text-2xl font-bold text-gray-900">{activeBookings}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Your Bookings</h3>
                    <p className="text-gray-500 text-sm">Active reservations</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <Clock className="w-8 h-8 text-emerald-500" />
                        <span className="text-2xl font-bold text-gray-900">{rooms.filter(r => r.status === 'available').length}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Available Rooms</h3>
                    <p className="text-gray-500 text-sm">Ready for booking now</p>
                </div>
            </div>

            {/* Recent Activity (Placeholder) */}
            <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity (All Rooms)</h2>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {allBookings.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No bookings yet. Start by finding a room!
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {allBookings.slice(0, 10).map(booking => {
                                const room = rooms.find(r => r.id === booking.roomId);
                                return (
                                    <div key={booking.id} className="p-4 hover:bg-slate-50 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-gray-900">{room?.name || 'Unknown Room'}</h4>
                                            <p className="text-sm text-gray-500">
                                                {new Date(booking.startTime).toLocaleDateString()} • {new Date(booking.startTime).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize 
                                    ${booking.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                            {booking.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Home;
