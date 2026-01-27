import type { Booking, Room, User } from '../types';
import { MOCK_ROOMS, MOCK_USERS, MOCK_BOOKINGS } from './mockData';

const STORAGE_KEYS = {
    ROOMS: 'mrs_rooms',
    USERS: 'mrs_users',
    BOOKINGS: 'mrs_bookings',
    CURRENT_USER: 'mrs_current_user',
};

// Initialize Helper
const initStorage = () => {
    const existingRooms = localStorage.getItem(STORAGE_KEYS.ROOMS);
    if (existingRooms) {
        const rooms = JSON.parse(existingRooms);
        // Migration: If rooms are missing description, clear them
        if (rooms.length > 0 && !rooms[0].description) {
            localStorage.removeItem(STORAGE_KEYS.ROOMS);
        }
    }

    const existingUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    if (existingUsers) {
        const users = JSON.parse(existingUsers);
        // Migration: If users have old domain or uni.edu, clear them to force update
        if (users.length > 0 && (users[0].email.includes('@uni.edu') || users[0].email.includes('@chandrakasem.ac.th'))) {
            localStorage.removeItem(STORAGE_KEYS.USERS);
        }
    }

    if (!localStorage.getItem(STORAGE_KEYS.ROOMS)) {
        localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(MOCK_ROOMS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(MOCK_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.BOOKINGS)) {
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(MOCK_BOOKINGS));
    }
};

// Rooms
export const getRooms = (): Room[] => {
    initStorage();
    const data = localStorage.getItem(STORAGE_KEYS.ROOMS);
    return data ? JSON.parse(data) : [];
};

// Users
export const getUsers = (): User[] => {
    initStorage();
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
};

export const getCurrentUser = (): User | null => {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
};

export const setCurrentUser = (user: User) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
};

// Bookings
export const getBookings = (): Booking[] => {
    initStorage();
    const data = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    return data ? JSON.parse(data) : [];
};

export const createBooking = (booking: Booking): boolean => {
    const bookings = getBookings();

    // Check for conflicts
    const hasConflict = bookings.some(b => {
        if (b.roomId !== booking.roomId) return false;
        if (b.status === 'rejected' || b.status === 'cancelled') return false;

        // Check overlap
        const newStart = new Date(booking.startTime);
        const newEnd = new Date(booking.endTime);
        const existingStart = new Date(b.startTime);
        const existingEnd = new Date(b.endTime);

        return newStart < existingEnd && newEnd > existingStart;
    });

    if (hasConflict) {
        return false;
    }

    bookings.push(booking);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    return true;
};

export const updateBookingStatus = (bookingId: string, status: Booking['status'], approverId?: string) => {
    const bookings = getBookings();
    const index = bookings.findIndex(b => b.id === bookingId);
    if (index !== -1) {
        bookings[index].status = status;
        if (approverId) bookings[index].approvedBy = approverId;
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    }
};
