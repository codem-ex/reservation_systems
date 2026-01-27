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
    startTime: string; // ISO string
    endTime: string; // ISO string
    purpose: string;
    status: BookingStatus;
    approvedBy?: string; // User ID of approver
    createdAt: string;
}
