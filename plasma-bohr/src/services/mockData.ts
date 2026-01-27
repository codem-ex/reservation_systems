import type { Room, User, Booking } from '../types';

export const MOCK_ROOMS: Room[] = [
    {
        id: 'r1',
        name: 'ห้องครุสัมมนา 1 ชั้น 2',
        type: 'Seminar',
        capacity: 40,
        equipment: ['Projector', 'Microphone', 'Whiteboard', 'Fast Wi-Fi'],
        status: 'available',
        image: 'https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'A modern seminar room ideal for workshops and training sessions. Features comfortable seating and ample natural light.',
        location: 'Building 3, 2nd Floor, Room 3201',
        images: [
            'https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1503428593586-e225b39bddfe?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        ],
    },
    {
        id: 'r2',
        name: 'ห้องครุสัมมนา 2 ชั้น 2',
        type: 'Seminar',
        capacity: 40,
        equipment: ['Projector', 'Smart TV', 'Whiteboard'],
        status: 'available',
        image: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Quiet meeting space designed for small group collaboration and focused discussions.',
        location: 'Building 3, 2nd Floor, Room 3205',
        images: [
            'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        ],
    },
    {
        id: 'r3',
        name: 'ห้องสัมมนา ชั้น 5',
        type: 'Training',
        capacity: 60,
        equipment: ['Computers', 'Projector', 'Sound System'],
        status: 'available',
        image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Spacious training room equipped with computers for technical workshops and hands-on learning.',
        location: 'Building 5, 5th Floor, Room 5502',
        images: [
            'https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1504384308090-c54be3855091?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
        ],
    },
    {
        id: 'r4',
        name: 'ห้องประชุมใหญ่ ชั้น 12',
        type: 'Conference Hall',
        capacity: 150,
        equipment: ['Dual Projectors', 'Professional Audio', 'Video Conference', 'Stage'],
        status: 'available',
        image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Grand conference hall suitable for large events, lectures, and university-wide gatherings. Includes stage and professional AV setup.',
        location: 'Building 9, 12th Floor, Grand Hall',
        images: [
            'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1517502884422-41e157d44301?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
        ],
    }
];

export const MOCK_USERS: User[] = [
    {
        id: 'u1',
        name: 'John Student',
        role: 'student',
        email: 'john@chandra.ac.th',
        department: 'Computer Science',
        studentId: '640001',
    },
    {
        id: 'u2',
        name: 'Jane Staff',
        role: 'staff',
        email: 'jane@chandra.ac.th',
        department: 'IT Support',
    },
    {
        id: 'u3',
        name: 'Admin User',
        role: 'admin',
        email: 'admin@chandra.ac.th',
        department: 'Administration',
    },
];

export const MOCK_BOOKINGS: Booking[] = [];
