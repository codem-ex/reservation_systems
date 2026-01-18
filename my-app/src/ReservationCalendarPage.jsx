import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const ReservationCalendarPage = () => {
    const navigate = useNavigate();

    // ✅ ใช้ .env ก่อน ถ้าไม่ตั้งให้ใช้โดเมนเดียว
    const API_BASE = (process.env.REACT_APP_API_BASE || window.location.origin).replace(/\/$/, '');

    const CLIENT_TZ = 'Asia/Bangkok';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [session, setSession] = useState(null);
    const [displayName, setDisplayName] = useState('');

    const [rooms, setRooms] = useState([]);
    const [roomId, setRoomId] = useState('');

    const [reservStart, setReservStart] = useState('');
    const [reservEnd, setReservEnd] = useState('');
    const [reservPurp, setReservPurp] = useState('');

    const [errMsg, setErrMsg] = useState('');

    // แปลงค่า datetime-local ("YYYY-MM-DDTHH:mm") -> ISO (UTC, มี Z) เพื่อให้ backend/GCAL ตีความชัดเจน
    const toIsoUtc = (localDateTimeStr) => {
        if (!localDateTimeStr) return null;
        const d = new Date(localDateTimeStr); // browser จะ parse เป็น local time
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString();
    };

    const validate = useMemo(() => {
        if (!roomId) return 'กรุณาเลือกห้อง';
        if (!reservStart) return 'กรุณาเลือกวันเริ่มจอง';
        if (!reservEnd) return 'กรุณาเลือกวันสิ้นสุด';
        if (!reservPurp.trim()) return 'กรุณากรอกเหตุผลในการจอง';

        const s = new Date(reservStart);
        const e = new Date(reservEnd);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'รูปแบบวันที่ไม่ถูกต้อง';
        if (e <= s) return 'วันสิ้นสุดต้องมากกว่าวันเริ่มจอง';
        return '';
    }, [roomId, reservStart, reservEnd, reservPurp]);

    const loadRooms = async () => {
        const { data, error } = await supabase
            .from('meeting_rooms')
            .select('room_id, room_name')
            .order('room_name', { ascending: true });

        if (error) throw new Error(`โหลดรายการห้องไม่สำเร็จ: ${error.message}`);

        const list = data || [];
        setRooms(list);

        // ตั้งค่า default room ถ้ายังไม่เคยเลือก
        if (list.length > 0 && !roomId) setRoomId(list[0].room_id);
    };

    const loadProfileName = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', userId)
            .single();

        if (error) {
            setDisplayName('');
            return;
        }

        const full = `${data?.first_name || ''} ${data?.last_name || ''}`.trim();
        setDisplayName(full || data?.email || '');
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setErrMsg('');

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }
            setSession(session);

            try {
                await Promise.all([loadRooms(), loadProfileName(session.user.id)]);
            } catch (e) {
                setErrMsg(e?.message || String(e));
            }

            setLoading(false);
        };

        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const submit = async (e) => {
        e.preventDefault();
        setErrMsg('');

        if (!session) {
            navigate('/login');
            return;
        }

        const v = validate;
        if (v) {
            alert(v);
            return;
        }

        setSaving(true);

        try {
            const { data: sessData } = await supabase.auth.getSession();
            const token = sessData?.session?.access_token;
            if (!token) throw new Error('ไม่พบ access token (กรุณา login ใหม่)');

            // แปลงเป็น ISO ชัดเจน (UTC) เพื่อให้ backend/Google Calendar parse ได้แน่นอน
            const startIso = toIsoUtc(reservStart);
            const endIso = toIsoUtc(reservEnd);
            if (!startIso || !endIso) throw new Error('รูปแบบวันที่ไม่ถูกต้อง (แปลงเวลาไม่สำเร็จ)');

            const payload = {
                room_id: roomId,
                reserv_start: startIso,
                reserv_end: endIso,
                reserv_purp: reservPurp.trim(),
                client_tz: CLIENT_TZ,
            };

            const resp = await fetch(`${API_BASE}/api/reservations/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json?.ok) {
                throw new Error(json?.message || `HTTP ${resp.status}`);
            }

            alert('จองสำเร็จ');

            const reservId = json?.reservation?.reserv_id;
            if (reservId) navigate(`/reservation/${reservId}`);
            else navigate('/my-reservations');
        } catch (e2) {
            alert(`จองไม่สำเร็จ: ${e2?.message || String(e2)}`);
        }

        setSaving(false);
    };

    if (loading) return <p>กำลังโหลด...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 900 }}>
                <h2 className="auth-title">จองห้องประชุม (Calendar)</h2>

                {errMsg && <p style={{ color: 'crimson', marginTop: 8 }}>{errMsg}</p>}

                {rooms.length === 0 ? (
                    <p>ยังไม่มีข้อมูลห้องประชุมในระบบ (เพิ่มข้อมูลใน public.meeting_rooms ก่อน)</p>
                ) : (
                    <form onSubmit={submit}>
                        <div style={{ marginBottom: 10, opacity: 0.9 }}>
                            ผู้จอง: <b>{displayName || session?.user?.email || session?.user?.id}</b>
                        </div>

                        <label>เลือกห้อง</label>
                        <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                            {rooms.map((r) => (
                                <option key={r.room_id} value={r.room_id}>
                                    {r.room_name}
                                </option>
                            ))}
                        </select>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                                <label>วันเริ่มจอง</label>
                                <input
                                    className="input"
                                    type="datetime-local"
                                    value={reservStart}
                                    onChange={(e) => setReservStart(e.target.value)}
                                />
                                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                                    ส่งไป backend เป็น ISO: <code>{toIsoUtc(reservStart) || '-'}</code>
                                </div>
                            </div>

                            <div>
                                <label>วันสิ้นสุดการจอง</label>
                                <input
                                    className="input"
                                    type="datetime-local"
                                    value={reservEnd}
                                    onChange={(e) => setReservEnd(e.target.value)}
                                />
                                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                                    ส่งไป backend เป็น ISO: <code>{toIsoUtc(reservEnd) || '-'}</code>
                                </div>
                            </div>
                        </div>

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

                        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                            API_BASE: <code>{API_BASE}</code>
                            <br />
                            client_tz: <code>{CLIENT_TZ}</code>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ReservationCalendarPage;
