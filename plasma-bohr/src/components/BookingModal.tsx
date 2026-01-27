import React, { useState } from 'react';
import { X, Calendar, Clock, User as UserIcon } from 'lucide-react';
import type { Room, User, Booking } from '../types';
import { createBooking } from '../services/storage';

interface BookingModalProps {
    room: Room;
    currentUser: User;
    onClose: () => void;
    onSuccess: () => void;
    initialDate: string;
    initialStartTime: string;
    initialEndTime: string;
}

const BookingModal: React.FC<BookingModalProps> = ({
    room,
    currentUser,
    onClose,
    onSuccess,
    initialDate,
    initialStartTime,
    initialEndTime
}) => {
    const [date, setDate] = useState(initialDate);
    const [startTime, setStartTime] = useState(initialStartTime);
    const [endTime, setEndTime] = useState(initialEndTime);
    const [purpose, setPurpose] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate API delay
        setTimeout(() => {
            const newBooking: Booking = {
                id: crypto.randomUUID(),
                roomId: room.id,
                userId: currentUser.id,
                startTime: `${date}T${startTime}`,
                endTime: `${date}T${endTime}`,
                purpose,
                status: 'pending', // Default to pending
                createdAt: new Date().toISOString()
            };

            const success = createBooking(newBooking);
            setIsSubmitting(false);

            if (success) {
                onSuccess();
            } else {
                alert('Booking failed: Time slot is already booked.');
            }
        }, 1000);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Book {room.name}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex items-center p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800 mb-4">
                        <UserIcon className="w-4 h-4 mr-2" />
                        <span>Booking as <span className="font-semibold">{currentUser.name}</span></span>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    required
                                    className="w-full pl-9 border border-gray-300 rounded-lg p-2 text-sm"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        required
                                        className="w-full pl-9 border border-gray-300 rounded-lg p-2 text-sm"
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        required
                                        className="w-full pl-9 border border-gray-300 rounded-lg p-2 text-sm"
                                        value={endTime}
                                        onChange={e => setEndTime(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                            <textarea
                                required
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                placeholder="e.g., Team Weekly Sync"
                                value={purpose}
                                onChange={e => setPurpose(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-70 flex justify-center items-center"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : 'Confirm Booking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BookingModal;
