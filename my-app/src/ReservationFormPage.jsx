import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const CONFIG = {
    RESERVATION_TABLE: 'reservation_info',
    ROOM_TABLE: 'meeting_rooms',   // ✅ ใช้ meeting_rooms ตามที่คุณบอก
    ROOM_ID_COL: 'room_id',
    ROOM_LABEL_COL: 'room_name',
};

const ReservationFormPage = () => {
    const navigate = useNavigate();

    const [session, setSession] = useState(null);
    const [displayName, setDisplayName] = useState('');
    const [rooms, setRooms] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        room_id: '',
        reserv_start: '',
        reserv_end: '',
        reserv_purp: '',
    });

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }
            setSession(session);

            // ชื่อผู้จอง (profiles ก่อน)
            const { data: p } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', session.user.id)
                .single();

            const fullFromProfile =
                p?.first_name ? `${p.first_name}${p?.last_name ? ` ${p.last_name}` : ''}` : '';
            const fullFromMeta = session.user.user_metadata?.full_name || '';
            const fallback = session.user.email || '';
            setDisplayName(fullFromProfile || fullFromMeta || fallback);

            // โหลดรายการห้องจาก meeting_rooms
            const { data: roomList, error: roomErr } = await supabase
                .from(CONFIG.ROOM_TABLE)
                .select(`${CONFIG.ROOM_ID_COL}, ${CONFIG.ROOM_LABEL_COL}`)
                .order(CONFIG.ROOM_LABEL_COL, { ascending: true });

            if (roomErr) {
                alert(`โหลดรายการห้องไม่สำเร็จ: ${roomErr.message}`);
                setRooms([]);
            } else {
                setRooms(roomList || []);
            }

            setLoading(false);
        };

        init();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!session) return;

        if (rooms.length === 0) {
            alert('ยังไม่มีข้อมูลห้องประชุมในระบบ กรุณาให้ผู้ดูแลเพิ่มห้องก่อน');
            return;
        }
        if (!form.room_id) {
            alert('กรุณาเลือกห้องประชุม');
            return;
        }
        if (!form.reserv_start || !form.reserv_end) {
            alert('กรุณาเลือกวันเริ่มจองและวันสิ้นสุดการจอง');
            return;
        }
        if (new Date(form.reserv_end) < new Date(form.reserv_start)) {
            alert('วันสิ้นสุดการจองต้องไม่ก่อนวันเริ่มจอง');
            return;
        }
        if (!form.reserv_purp.trim()) {
            alert('กรุณากรอกเหตุผลในการจอง');
            return;
        }

        setSaving(true);

        const payload = {
            room_id: form.room_id,
            reserv_start: form.reserv_start,
            reserv_end: form.reserv_end,
            reserv_purp: form.reserv_purp.trim(),
            who_reserv_id: session.user.id,
        };

        const { error } = await supabase
            .from(CONFIG.RESERVATION_TABLE)
            .insert(payload);

        if (error) {
            alert(error.message);
        } else {
            alert('ส่งคำขอจองเรียบร้อย');
            setForm({ room_id: '', reserv_start: '', reserv_end: '', reserv_purp: '' });
        }

        setSaving(false);
    };

    if (loading) return <p>กำลังโหลด...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">จองห้องประชุม</h2>

                {rooms.length === 0 && (
                    <p style={{ color: '#b45309', marginBottom: 12 }}>
                        ยังไม่มีข้อมูลห้องประชุมในระบบ (เพิ่มข้อมูลใน public.meeting_rooms ก่อน)
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <label>ผู้จอง</label>
                    <input className="input" value={displayName} disabled />

                    <label>เลือกห้องประชุม</label>
                    <select
                        className="input"
                        name="room_id"
                        value={form.room_id}
                        onChange={handleChange}
                        required
                        disabled={rooms.length === 0}
                    >
                        <option value="">-- เลือกห้อง --</option>
                        {rooms.map((r) => (
                            <option key={r[CONFIG.ROOM_ID_COL]} value={r[CONFIG.ROOM_ID_COL]}>
                                {r[CONFIG.ROOM_LABEL_COL]}
                            </option>
                        ))}
                    </select>

                    <label>วันเริ่มจอง</label>
                    <input
                        className="input"
                        type="date"
                        name="reserv_start"
                        value={form.reserv_start}
                        onChange={handleChange}
                        required
                    />

                    <label>วันสิ้นสุดการจอง</label>
                    <input
                        className="input"
                        type="date"
                        name="reserv_end"
                        value={form.reserv_end}
                        onChange={handleChange}
                        required
                    />

                    <label>เหตุผลในการจอง</label>
                    <textarea
                        className="input"
                        name="reserv_purp"
                        value={form.reserv_purp}
                        onChange={handleChange}
                        rows={3}
                        required
                    />

                    <button className="auth-btn" type="submit" disabled={saving || rooms.length === 0}>
                        {saving ? 'กำลังบันทึก...' : 'ยืนยันการจอง'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ReservationFormPage;
