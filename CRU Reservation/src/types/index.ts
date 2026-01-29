export type UserRole = 'student' | 'staff' | 'admin';

export interface User {
    id: string;
    name: string;
    role: UserRole;
    email: string;
    department: string;
    studentId?: string; // Only for students
}

export type RoomStatus = 'available' | 'maintenance' | 'occupied';

export interface Room {
    id: string;
    name: string;
    type: string; // e.g., 'Conference', 'Classroom'
    capacity: number;
    equipment: string[];
    status: RoomStatus;
    image?: string;
    images?: string[];
    description?: string;
    location?: string;
}

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Booking {
    id: string;

    roomId: string;
    userId: string;

    start_at: string;
    end_at: string;

    setup_date?: string | null;
    setup_start?: string | null;
    setup_end?: string | null;

    purpose: string;
    status: string;

    created_at: string;
}

