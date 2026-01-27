import React, { useState, useMemo } from 'react';
import { Search, Filter, Calendar as CalendarIcon } from 'lucide-react';
import { getRooms, getBookings, getCurrentUser } from '../services/storage';
import RoomCard from '../components/RoomCard';
import BookingModal from '../components/BookingModal';
import type { Room } from '../types';
import { format } from 'date-fns';

const SearchRooms = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [minCapacity, setMinCapacity] = useState(0);

    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

    const rooms = getRooms();
    const bookings = getBookings();
    const currentUser = getCurrentUser();

    const handleBook = (room: Room) => {
        setSelectedRoom(room);
    };

    const handleCloseModal = () => {
        setSelectedRoom(null);
    };

    const handleBookingSuccess = () => {
        setSelectedRoom(null);
        alert('Booking submitted successfully! Waiting for approval.');
        // Ideally we'd refresh the bookings list here or use a context/query
        // For now, refreshing the page is a crude but effective way to update the "isOccupied" logic if we were re-fetching
        // But since `bookings` is just a variable from `getBookings()` called at top level, it won't react.
        // We should probably force a re-render or make getBookings a state. 
        // For prototype, `window.location.reload()` works best to ensure consistency.
        window.location.reload();
    };

    const filteredRooms = useMemo(() => {
        return rooms.filter(room => {
            // 1. Text Search
            const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                room.type.toLowerCase().includes(searchTerm.toLowerCase());

            // 2. Capacity
            const matchesCapacity = room.capacity >= minCapacity;

            // 3. Availability Check
            // This is a basic check. Real implementation needs to check precise time overlaps.
            const searchStart = new Date(`${selectedDate}T${startTime}`);
            const searchEnd = new Date(`${selectedDate}T${endTime}`);

            const isOccupied = bookings.some(booking => {
                if (booking.roomId !== room.id) return false;
                if (booking.status === 'rejected' || booking.status === 'cancelled') return false;

                const bookingStart = new Date(booking.startTime);
                const bookingEnd = new Date(booking.endTime);

                // Check if ranges overlap
                return (searchStart < bookingEnd && searchEnd > bookingStart);
            });

            return matchesSearch && matchesCapacity && !isOccupied && room.status !== 'maintenance';
        });
    }, [searchTerm, minCapacity, selectedDate, startTime, endTime, rooms, bookings]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Find a Meeting Room</h1>

                {/* Search Bar */}
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by name or type..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                        type="date"
                        className="w-full border border-gray-300 rounded-lg p-2"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                        type="time"
                        className="w-full border border-gray-300 rounded-lg p-2"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                        type="time"
                        className="w-full border border-gray-300 rounded-lg p-2"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Capacity</label>
                    <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg p-2"
                        value={minCapacity}
                        onChange={(e) => setMinCapacity(Number(e.target.value))}
                        min={0}
                    />
                </div>
            </div>

            {/* Results */}
            {filteredRooms.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-gray-300">
                    <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No rooms available</h3>
                    <p className="text-gray-500">Try adjusting your filters or search terms.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRooms.map(room => (
                        <RoomCard key={room.id} room={room} onBook={handleBook} />
                    ))}
                </div>
            )}

            {selectedRoom && currentUser && (
                <BookingModal
                    room={selectedRoom}
                    currentUser={currentUser}
                    initialDate={selectedDate}
                    initialStartTime={startTime}
                    initialEndTime={endTime}
                    onClose={handleCloseModal}
                    onSuccess={handleBookingSuccess}
                />
            )}
        </div>
    );
};

export default SearchRooms;
