import React, { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:4000'; // ✅ ให้ตรงกับ backend ที่รันอยู่

function compareISO(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

const ReservationCalendarPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [session, setSession] = useState(null);
    const [displayName, setDisplayName] = useState('');

    const [rooms, setRooms] = useState([]);

    const [form, setForm] = useState({
        room_id: '',
        reserv_start: '',
        reserv_end: '', // inclusive สำหรับ user
        reserv_purp: '',
    });

    const [pickStep, setPickStep] = useState(0); // 0=start, 1=end

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }
            setSession(session);

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

            const { data: roomRows, error: roomErr } = await supabase
                .from('meeting_rooms')
                .select('room_id, room_name')
                .order('room_name', { ascending: true });

            if (roomErr) {
                alert(`โหลดรายการห้องไม่สำเร็จ: ${roomErr.message}`);
                setRooms([]);
            } else {
                setRooms(roomRows || []);
            }

            setLoading(false);
        };

        init();
    }, [navigate]);

    const handleDateClick = (arg) => {
        const clicked = arg.dateStr;

        if (pickStep === 0) {
            setForm((prev) => ({ ...prev, reserv_start: clicked, reserv_end: '' }));
            setPickStep(1);
            return;
        }

        if (pickStep === 1) {
            const start = form.reserv_start;

            let s = start;
            let e = clicked;

            if (!s) {
                setForm((prev) => ({ ...prev, reserv_start: clicked, reserv_end: '' }));
                setPickStep(1);
                return;
            }

            if (compareISO(e, s) < 0) {
                const tmp = s;
                s = e;
                e = tmp;
            }

            setForm((prev) => ({ ...prev, reserv_start: s, reserv_end: e }));
            setPickStep(0);
        }
    };

    const selectionHint = useMemo(() => {
        return pickStep === 0 ? 'คลิกเลือก “วันเริ่มจอง”' : 'คลิกเลือก “วันสิ้นสุดการจอง”';
    }, [pickStep]);

    const clearSelection = () => {
        setForm((prev) => ({ ...prev, reserv_start: '', reserv_end: '' }));
        setPickStep(0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!session) return;

        if (!form.room_id) return alert('กรุณาเลือกห้องประชุม');
        if (!form.reserv_start || !form.reserv_end) return alert('กรุณาเลือกวันเริ่มและวันสิ้นสุดจากปฏิทิน');
        if (!form.reserv_purp.trim()) return alert('กรุณากรอกเหตุผลในการจอง');

        setSaving(true);

        try {
            const { data: sessData, error: sessErr } = await supabase.auth.getSession();
            const token = sessData?.session?.access_token;
            if (sessErr || !token) throw new Error('ไม่พบ access token (กรุณา login ใหม่)');

            const url = `${API_BASE}/api/reservations/create`;

            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    room_id: form.room_id,
                    reserv_start: form.reserv_start,
                    reserv_end_inclusive: form.reserv_end,
                    reserv_purp: form.reserv_purp.trim(),
                }),
            });

            // ถ้า backend ไม่เจอ route/พอร์ตผิด มักเป็น 404 HTML
            const text = await resp.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch {
                json = null;
            }

            if (!resp.ok) {
                // แสดงรายละเอียดให้รู้ว่า 404 มาจากไหน
                const detail = json?.message || text || `HTTP ${resp.status}`;
                throw new Error(`HTTP ${resp.status} (${resp.statusText}): ${detail}`);
            }

            if (!json?.ok) {
                throw new Error(json?.message || 'Unknown error');
            }

            alert('บันทึกการจองเรียบร้อย (DB + Google Calendar)');

            if (json.htmlLink) {
                window.open(json.htmlLink, '_blank', 'noopener,noreferrer');
            }

            setForm({ room_id: '', reserv_start: '', reserv_end: '', reserv_purp: '' });
            setPickStep(0);
        } catch (err) {
            alert(`จองไม่สำเร็จ: ${err?.message || String(err)}\n\nเช็กด้วยว่า API_BASE ถูกไหม: ${API_BASE}`);
        }

        setSaving(false);
    };

    if (loading) return <p>กำลังโหลด...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 1000 }}>
                <h2 className="auth-title">จองห้องประชุม (DB + Google Calendar)</h2>

                <div style={{ marginBottom: 10, opacity: 0.85 }}>
                    ผู้จอง: <b>{displayName}</b>
                </div>

                <div style={{ marginBottom: 10 }}>
                    <b>วิธีเลือกวัน:</b> {selectionHint}
                    <button
                        type="button"
                        onClick={clearSelection}
                        style={{
                            marginLeft: 10,
                            padding: '6px 10px',
                            borderRadius: 10,
                            border: '1px solid #ccc',
                            background: '#fff',
                            cursor: 'pointer',
                        }}
                    >
                        ล้างการเลือกวัน
                    </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <FullCalendar
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        dateClick={handleDateClick}
                        height="auto"
                    />
                </div>

                <form onSubmit={handleSubmit}>
                    <label>ห้องประชุม</label>
                    <select
                        className="input"
                        value={form.room_id}
                        onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                        required
                    >
                        <option value="">-- เลือกห้อง --</option>
                        {rooms.map((r) => (
                            <option key={r.room_id} value={r.room_id}>
                                {r.room_name}
                            </option>
                        ))}
                    </select>

                    <label>วันเริ่มจอง</label>
                    <input className="input" value={form.reserv_start} readOnly />

                    <label>วันสิ้นสุดการจอง</label>
                    <input className="input" value={form.reserv_end} readOnly />

                    <label>เหตุผลในการจอง</label>
                    <textarea
                        className="input"
                        rows={3}
                        value={form.reserv_purp}
                        onChange={(e) => setForm({ ...form, reserv_purp: e.target.value })}
                    />

                    <button className="auth-btn" type="submit" disabled={saving} style={{ marginTop: 16 }}>
                        {saving ? 'กำลังบันทึก...' : 'ยืนยันการจอง (DB + Calendar)'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ReservationCalendarPage;
