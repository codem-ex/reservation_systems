import { useEffect, useMemo, useState } from "react";
import { Search, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

import RoomCard from "../components/RoomCard";
import BookingModal from "../components/BookingModal";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

type DbRoom = {
    id: string;
    name: string;
    location: string | null;
    capacity: number;
    amenities: any; // jsonb
    is_active: boolean;
    description: string | null;
    status: string | null; // varchar nullable
    image_url: string | null;
    image_path: string | null;
    images: any; // jsonb array
};

type DbReservation = {
    id: string;
    room_id: string;
    requester_id: string;
    title: string;
    purpose: string;
    start_at: string; // timestamptz
    end_at: string;   // timestamptz
    status: string;   // enum reservation_status เช่น PENDING/APPROVED/REJECTED/CANCELLED
};

function normalizeRoomStatus(s: string | null | undefined) {
    const v = (s ?? "").toString().trim().toLowerCase();
    if (!v) return "available"; // ถ้า null ให้ถือว่า available (แก้ตาม policy ของคุณได้)
    return v;
}

function isReservationBlocking(status: string) {
    const s = status.toUpperCase();
    // กันเฉพาะที่ไม่ควรบล็อกเวลาค้นหา
    if (s === "REJECTED" || s === "CANCELLED") return false;
    return true; // PENDING / APPROVED / อื่น ๆ ให้บล็อก
}

function toSearchBlob(r: DbRoom) {
    return [
        r.name ?? "",
        r.location ?? "",
        r.description ?? "",
    ]
        .join(" ")
        .toLowerCase();
}

function toLegacyRoom(r: DbRoom): any {
    // adapter ให้ RoomCard ใช้ได้ (เพราะ types เดิมมาจาก mock)
    // ถ้า RoomCard ใช้ field เพิ่มเติม คุณบอกได้ ผมจะเติมให้ตรง
    return {
        id: r.id,
        name: r.name,
        location: r.location ?? "",
        capacity: r.capacity,
        status: normalizeRoomStatus(r.status), // ใช้ rooms.status
        description: r.description ?? "",
        amenities: r.amenities,
        // รูป: ถ้ามี images array ให้ใช้รูปแรกเป็น cover
        imageUrl:
            (Array.isArray(r.images) && r.images.length > 0 && (r.images[0]?.url || r.images[0])) ||
            r.image_url ||
            null,
        images: Array.isArray(r.images) ? r.images : [],
    };
}

const SearchRooms = () => {
    const { user, loading: authLoading } = useAuth();

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("10:00");
    const [minCapacity, setMinCapacity] = useState(0);
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

    const [selectedRoom, setSelectedRoom] = useState<any | null>(null);

    const [rooms, setRooms] = useState<DbRoom[]>([]);
    const [reservations, setReservations] = useState<DbReservation[]>([]);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const fetchRoomsAndReservations = async () => {
        setErr("");
        setLoading(true);

        try {
            // rooms
            const { data: roomsData, error: roomsErr } = await supabase
                .from("rooms")
                .select(
                    "id,name,location,capacity,amenities,is_active,description,status,image_url,image_path,images"
                )
                .eq("is_active", true)
                .order("name", { ascending: true });

            if (roomsErr) throw roomsErr;

            // reservations
            const { data: resvData, error: resvErr } = await supabase
                .from("reservations")
                .select("id,room_id,requester_id,title,purpose,start_at,end_at,status")
                .order("start_at", { ascending: false });

            if (resvErr) throw resvErr;

            setRooms((roomsData as DbRoom[]) ?? []);
            setReservations((resvData as DbReservation[]) ?? []);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        fetchRoomsAndReservations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading]);

    const filteredRooms = useMemo(() => {
        const searchStart = new Date(`${selectedDate}T${startTime}`);
        const searchEnd = new Date(`${selectedDate}T${endTime}`);

        if (isNaN(+searchStart) || isNaN(+searchEnd)) return [];
        if (searchEnd <= searchStart) return [];

        const term = searchTerm.trim().toLowerCase();

        return rooms
            .filter((room) => {
                // 1) search text: name/location/description
                const blob = toSearchBlob(room);
                const matchesSearch = term === "" ? true : blob.includes(term);

                // 2) capacity
                const matchesCapacity = Number(room.capacity) >= Number(minCapacity);

                // 3) is_active
                const isActive = room.is_active === true;

                // 4) amenities filter
                const matchesAmenities = selectedAmenities.length === 0 ||
                    selectedAmenities.every(a => Array.isArray(room.amenities) && room.amenities.includes(a));

                return matchesSearch && matchesCapacity && isActive && matchesAmenities;
            })
            .map((room) => {
                const legacy = toLegacyRoom(room);

                // Check overlap by reservations
                const isOccupied = reservations.some((r) => {
                    if (r.room_id !== room.id) return false;
                    if (!isReservationBlocking(r.status)) return false;

                    const bStart = new Date(r.start_at);
                    const bEnd = new Date(r.end_at);
                    if (isNaN(+bStart) || isNaN(+bEnd)) return false;

                    return searchStart < bEnd && searchEnd > bStart;
                });

                if (isOccupied) {
                    legacy.status = "occupied";
                }

                return legacy;
            });
    }, [rooms, reservations, searchTerm, minCapacity, selectedDate, startTime, endTime, selectedAmenities]);

    const handleBook = (room: any) => setSelectedRoom(room);
    const handleCloseModal = () => setSelectedRoom(null);

    const handleBookingSuccess = async () => {
        setSelectedRoom(null);
        alert("Booking submitted successfully! Waiting for approval.");
        // ✅ ไม่ reload หน้า: refetch เพื่อให้ occupied logic อัปเดต
        await fetchRoomsAndReservations();
    };

    if (authLoading || loading) {
        return (
            <div className="p-6 text-gray-500 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading rooms...
            </div>
        );
    }

    if (err) {
        return (
            <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-100">
                {err}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ค้นหาห้องประชุม</h1>

                {/* Search Bar */}
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="ค้นหาตามชื่อ / สถานที่ / รายละเอียด..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 transition-colors">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">วันที่</label>
                    <input
                        type="date"
                        className="w-full border border-gray-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800 dark:text-white"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={format(new Date(), "yyyy-MM-dd")}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">เวลาเริ่ม</label>
                    <input
                        type="time"
                        className="w-full border border-gray-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800 dark:text-white"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">เวลาสิ้นสุด</label>
                    <input
                        type="time"
                        className="w-full border border-gray-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800 dark:text-white"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                    />
                    {new Date(`${selectedDate}T${endTime}`) <= new Date(`${selectedDate}T${startTime}`) && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม</div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">ความจุขั้นต่ำ (คน)</label>
                    <input
                        type="number"
                        className="w-full border border-gray-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800 dark:text-white"
                        value={minCapacity}
                        onChange={(e) => setMinCapacity(Number(e.target.value))}
                        min={0}
                    />
                </div>
            </div>

            {/* Amenities Filter */}
            <div className="flex flex-wrap gap-2">
                {Array.from(new Set(rooms.flatMap(r => Array.isArray(r.amenities) ? r.amenities : []))).map(a => (
                    <button
                        key={a}
                        onClick={() => setSelectedAmenities(prev =>
                            prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
                        )}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${selectedAmenities.includes(a)
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        {a}
                    </button>
                ))}
            </div>

            {/* Results */}
            {filteredRooms.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-gray-300 dark:border-slate-800 transition-colors">
                    <CalendarIcon className="w-12 h-12 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">ไม่พบห้องว่าง</h3>
                    <p className="text-gray-500 dark:text-slate-400">กรุณาลองปรับฟิลเตอร์ หรือคำค้นหาใหม่อีกครั้ง</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    {filteredRooms.map((room: any) => (
                        <RoomCard key={room.id} room={room} onBook={handleBook} />
                    ))}
                </div>
            )}

            {/* Booking Modal */}
            {selectedRoom && user && (
                <BookingModal
                    room={selectedRoom}
                    currentUser={
                        {
                            id: user.id,
                            email: user.email ?? "",
                            name:
                                (user.user_metadata?.full_name as string | undefined) ||
                                (user.user_metadata?.name as string | undefined) ||
                                user.email?.split("@")[0] ||
                                "User",
                            role: "user",
                        } as any
                    }
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
