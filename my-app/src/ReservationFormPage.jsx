import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const ReservationFormPage = () => {
    const navigate = useNavigate();
    const API_BASE = window.location.origin;

    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState([]);

    const [roomId, setRoomId] = useState('');
    const [reservStart, setReservStart] = useState('');
    const [reservEnd, setReservEnd] = useState('');
    const [reservPurp, setReservPurp] = useState('');

    const [saving, setSaving] = useState(false);

    const loadRooms = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate('/login');
            return;
        }

        // meeting_rooms ใช้ room_id
        const { data, error } = await supabase
            .from('meeting_rooms')
            .select('room_id, room_name')
            .order('room_name', { ascending: true });

        if (error) {
            alert(`โหลดรายการห้องไม่สำเร็จ: ${error.message}`);
            setRooms([]);
        } else {
            setRooms(data || []);
            if ((data || []).length > 0) setRoomId(data[0].room_id);
        }
    };

    useEffect(() => {
        const init = async () => {
            await loadRooms();
            setLoading(false);
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submit = async (e) => {
        e.preventDefault();

        if (!roomId) return alert('กรุณาเลือกห้อง');
        if (!reservStart) return alert('กรุณาเลือกวันเริ่มจอง');
        if (!reservEnd) return alert('กรุณาเลือกวันสิ้นสุด');
        if (!reservPurp.trim()) return alert('กรุณากรอกเหตุผล');

        setSaving(true);

        try {
            const { data: sessData } = await supabase.auth.getSession();
            const token = sessData?.session?.access_token;
            if (!token) throw new Error('ไม่พบ access token (กรุณา login ใหม่)');

            const resp = await fetch(`${API_BASE}/api/reservations/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    room_id: roomId,
                    reserv_start: reservStart,
                    reserv_end: reservEnd,
                    reserv_purp: reservPurp.trim(),
                }),
            });

            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json?.ok) {
                throw new Error(json?.message || `HTTP ${resp.status}`);
            }

            alert('จองสำเร็จ');
            // ไปหน้า detail ใบจองได้เลยถ้ามี route นี้
            if (json?.reservation?.reserv_id) {
                navigate(`/reservation/${json.reservation.reserv_id}`);
            } else {
                navigate('/my-reservations');
            }
        } catch (err) {
            alert(`จองไม่สำเร็จ: ${err?.message || String(err)}`);
        }

        setSaving(false);
    };

    if (loading) return <p>กำลังโหลด...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 780 }}>
                <h2 className="auth-title">จองห้องประชุม</h2>

                {rooms.length === 0 ? (
                    <p>ยังไม่มีข้อมูลห้องประชุมในระบบ (เพิ่มข้อมูลใน public.meeting_rooms ก่อน)</p>
                ) : (
                    <form onSubmit={submit}>
                        <label>เลือกห้อง</label>
                        <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                            {rooms.map((r) => (
                                <option key={r.room_id} value={r.room_id}>
                                    {r.room_name}
                                </option>
                            ))}
                        </select>

                        <label>วันเริ่มจอง</label>
                        <input
                            className="input"
                            type="datetime-local"
                            value={reservStart}
                            onChange={(e) => setReservStart(e.target.value)}
                        />

                        <label>วันสิ้นสุดการจอง</label>
                        <input
                            className="input"
                            type="datetime-local"
                            value={reservEnd}
                            onChange={(e) => setReservEnd(e.target.value)}
                        />

                        <label>เหตุผลในการจอง</label>
                        <textarea
                            className="input"
                            rows={4}
                            value={reservPurp}
                            onChange={(e) => setReservPurp(e.target.value)}
                            placeholder="ระบุเหตุผล..."
                        />

                        <button className="auth-btn" type="submit" disabled={saving}>
                            {saving ? 'กำลังบันทึก...' : 'บันทึกการจอง'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ReservationFormPage;
