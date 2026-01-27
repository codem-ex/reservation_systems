import React, { useState } from 'react';
import { Check, X, Clock, Calendar, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { getBookings, getRooms, getUsers, updateBookingStatus, getCurrentUser } from '../services/storage';
import { exportToPDF, exportToExcel } from '../services/reportService';
import type { Booking } from '../types';
import { format } from 'date-fns';

const AdminDashboard = () => {
    const currentUser = getCurrentUser();
    const [bookings, setBookings] = useState(getBookings()); // Local state to trigger re-renders
    const rooms = getRooms();
    const users = getUsers();

    const pendingBookings = bookings.filter(b => b.status === 'pending');
    const pastBookings = bookings.filter(b => b.status !== 'pending');

    const handleAction = (bookingId: string, status: Booking['status']) => {
        updateBookingStatus(bookingId, status, currentUser?.id);
        setBookings(getBookings()); // Refresh data
    };

    const handleExportPDF = () => exportToPDF(bookings, rooms, users);
    const handleExportExcel = () => exportToExcel(bookings, rooms, users);

    if (currentUser?.role !== 'admin' && currentUser?.role !== 'staff') {
        return (
            <div className="p-8 text-center bg-red-50 text-red-700 rounded-xl">
                Access Denied. You must be staff or admin to view this page.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <div className="flex space-x-2">
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center px-4 py-2 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center px-4 py-2 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Pending Approvals */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-yellow-500" />
                    Pending Approvals ({pendingBookings.length})
                </h2>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {pendingBookings.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">No pending requests.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingBookings.map(booking => {
                                const room = rooms.find(r => r.id === booking.roomId);
                                const user = users.find(u => u.id === booking.userId);

                                return (
                                    <div key={booking.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900">{room?.name}</span>
                                                <span className="text-gray-400">•</span>
                                                <span className="text-primary-600 font-medium">{user?.name}</span>
                                            </div>
                                            <p className="text-gray-600 text-sm mb-2">{booking.purpose}</p>
                                            <div className="flex items-center text-sm text-gray-500 gap-4">
                                                <span className="flex items-center">
                                                    <Calendar className="w-4 h-4 mr-1.5" />
                                                    {format(new Date(booking.startTime), 'MMM d, yyyy')}
                                                </span>
                                                <span className="flex items-center">
                                                    <Clock className="w-4 h-4 mr-1.5" />
                                                    {format(new Date(booking.startTime), 'HH:mm')} - {format(new Date(booking.endTime), 'HH:mm')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAction(booking.id, 'approved')}
                                                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleAction(booking.id, 'rejected')}
                                                className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* History */}
            <section className="opacity-75">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">History</h2>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {pastBookings.slice(0, 5).map(booking => {
                            const room = rooms.find(r => r.id === booking.roomId);
                            const user = users.find(u => u.id === booking.userId);
                            return (
                                <div key={booking.id} className="p-4 flex justify-between items-center text-sm">
                                    <div>
                                        <span className="font-medium">{room?.name}</span>
                                        <span className="mx-2 text-gray-300">|</span>
                                        <span className="text-gray-600">{user?.name}</span>
                                    </div>
                                    <span className={`capitalize ${booking.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                        {booking.status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdminDashboard;
