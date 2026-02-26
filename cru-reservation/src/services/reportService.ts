import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Booking, Room, User } from '../types';
import { format } from 'date-fns';

export const exportToPDF = (bookings: Booking[], rooms: Room[], users: User[]) => {
    const doc = new jsPDF();

    doc.text('Meeting Room Booking Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'PPpp')}`, 14, 30);

    const tableData = bookings.map(b => {
        const room = rooms.find(r => r.id === b.roomId)?.name || 'Unknown';
        const user = users.find(u => u.id === b.userId)?.name || 'Unknown';
        return [
            room,
            user,
            format(new Date(b.startTime), 'MMM d, HH:mm'),
            format(new Date(b.endTime), 'HH:mm'),
            b.purpose,
            b.status
        ];
    });

    autoTable(doc, {
        startY: 40,
        head: [['Room', 'User', 'Start', 'End', 'Purpose', 'Status']],
        body: tableData,
    });

    doc.save('booking-report.pdf');
};

export const exportToExcel = (bookings: Booking[], rooms: Room[], users: User[]) => {
    const data = bookings.map(b => ({
        Room: rooms.find(r => r.id === b.roomId)?.name || 'Unknown',
        User: users.find(u => u.id === b.userId)?.name || 'Unknown',
        StartTime: format(new Date(b.startTime), 'yyyy-MM-dd HH:mm'),
        EndTime: format(new Date(b.endTime), 'yyyy-MM-dd HH:mm'),
        Purpose: b.purpose,
        Status: b.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    XLSX.writeFile(workbook, "booking-report.xlsx");
};
