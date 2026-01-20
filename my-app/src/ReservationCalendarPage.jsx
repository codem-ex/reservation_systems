import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

import thLocale from '@fullcalendar/core/locales/th';

const ReservationCalendarPage = () => {
    const navigate = useNavigate();
    const calendarRef = useRef(null);

    const API_BASE = (process.env.REACT_APP_API_BASE || window.location.origin).replace(/\/$/, '');
    const CLIENT_TZ = 'Asia/Bangkok';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [session, setSession] = useState(null);
    const [displayName, setDisplayName] = useState('');

    const [rooms, setRooms] = useState([]);
    const [roomId, setRoomId] = useState('');

    const [errMsg, setErrMsg] = useState('');
    const [events, setEvents] = useState([]);

    // ช่วงเวลาที่ user ลากเลือก
    const [selectedRange, setSelectedRange] = useState(null); // { start: Date, end: Date }
    const [reservPurp, setReservPurp] = useState('');

    const validate = useMemo(() => {
        if (!roomId) return 'กรุณาเลือกห้อง';
        if (!selectedRange?.start || !selectedRange?.end) return 'กรุณาลากเลือกช่วงเวลาในการจองบนปฏิทิน';
        if (new Date(selectedRange.end) <= new Date(selectedRange.start)) return 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม';
        if (!reservPurp.trim()) return 'กรุณากรอกเหตุผลในการจอง';
        return '';
    }, [roomId, selectedRange, reservPurp]);

    const loadRooms = useCallback(async () => {
        const { data, error } = await supabase
            .from('meeting_rooms')
            .select('room_id, room_name')
            .order('room_name', { ascending: true });

        if (error) throw new Error(`โหลดรายการห้องไม่สำเร็จ: ${error.message}`);

        const list = data || [];
        setRooms(list);
        if (list.length > 0) setRoomId((prev) => prev || list[0].room_id);
    }, []);

    const loadProfileName = useCallback(async (userId) => {
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
    }, []);

    const mapReservationsToEvents = useCallback((rows) => {
        return (rows || []).map((r) => ({
            id: String(r.reserv_id),
            title: r.reserv_purp ? `จอง: ${r.reserv_purp}` : 'จองห้อง',
            start: r.reserv_start,
            end: r.reserv_end,
            extendedProps: {
                reserv_id: r.reserv_id,
                who_reserv_id: r.who_reserv_id,
            },
        }));
    }, []);

    // โหลดรายการจองในช่วงวันที่ที่กำลังแสดง (ลด query ให้น้อยลง)
    const loadReservationsForRoomInRange = useCallback(async (rid, rangeStart, rangeEnd) => {
        if (!rid) {
            setEvents([]);
            return;
        }

        const { data, error } = await supabase
            .from('reservation_info')
            .select('reserv_id, room_id, reserv_start, reserv_end, reserv_purp, who_reserv_id')
            .eq('room_id', rid)
            .gte('reserv_start', new Date(rangeStart).toISOString())
            .lte('reserv_start', new Date(rangeEnd).toISOString())
            .order('reserv_start', { ascending: true });

        if (error) throw new Error(`โหลดรายการจองไม่สำเร็จ: ${error.message}`);

        setEvents(mapReservationsToEvents(data));
    }, [mapReservationsToEvents]);

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
    }, [navigate, loadRooms, loadProfileName]);

    // เมื่อเปลี่ยนห้อง ให้รีโหลดช่วงที่ calendar กำลังแสดง
    useEffect(() => {
        const api = calendarRef.current?.getApi?.();
        if (!api || !roomId) return;
        const v = api.view;
        loadReservationsForRoomInRange(roomId, v.activeStart, v.activeEnd).catch((e) =>
            setErrMsg(e?.message || String(e))
        );
    }, [roomId, loadReservationsForRoomInRange]);

    const handleDatesSet = async (arg) => {
        try {
            setErrMsg('');
            if (!roomId) return;
            await loadReservationsForRoomInRange(roomId, arg.start, arg.end);
        } catch (e) {
            setErrMsg(e?.message || String(e));
        }
    };

    const onSelectRange = (selectInfo) => {
        setSelectedRange({ start: selectInfo.start, end: selectInfo.end });
    };

    const onEventClick = (clickInfo) => {
        const ev = clickInfo.event;
        const start = ev.start ? ev.start.toLocaleString('th-TH') : '-';
        const end = ev.end ? ev.end.toLocaleString('th-TH') : '-';
        alert(`${ev.title}\n\nเริ่ม: ${start}\nสิ้นสุด: ${end}\nID: ${ev.id}`);
    };

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

            const startIso = new Date(selectedRange.start).toISOString();
            const endIso = new Date(selectedRange.end).toISOString();

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

            // รีโหลดช่วงที่กำลังดูอยู่ เพื่อให้เห็น event ใหม่
            const api = calendarRef.current?.getApi?.();
            if (api) {
                const v2 = api.view;
                await loadReservationsForRoomInRange(roomId, v2.activeStart, v2.activeEnd);
            }

            setSelectedRange(null);
            setReservPurp('');

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

    const selectedText =
        selectedRange?.start && selectedRange?.end
            ? `${selectedRange.start.toLocaleString('th-TH')} ถึง ${selectedRange.end.toLocaleString('th-TH')}`
            : '-';

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 1150 }}>
                <h2 className="auth-title">จองห้องประชุม (Time Grid)</h2>

                {errMsg && <p style={{ color: 'crimson', marginTop: 8 }}>{errMsg}</p>}

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

                <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
                        ลากเลือกช่วงเวลาในตาราง เพื่อสร้างการจอง
                    </div>

                    <FullCalendar
                        ref={calendarRef}
                        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'timeGridDay,timeGridWeek,dayGridMonth',
                        }}
                        height="auto"
                        locale={thLocale}
                        timeZone={CLIENT_TZ}
                        selectable
                        selectMirror
                        select={onSelectRange}
                        events={events}
                        eventClick={onEventClick}
                        datesSet={handleDatesSet}
                        slotMinTime="06:00:00"
                        slotMaxTime="22:00:00"
                        nowIndicator
                        selectAllow={(info) => info.end > info.start}
                    />
                </div>

                <form onSubmit={submit} style={{ marginTop: 14 }}>
                    <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.9 }}>
                        ช่วงเวลาที่เลือก: <b>{selectedText}</b>
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
                        {saving ? 'กำลังบันทึก...' : 'ยืนยันการจอง'}
                    </button>

                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                        API_BASE: <code>{API_BASE}</code>
                        <br />
                        client_tz: <code>{CLIENT_TZ}</code>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReservationCalendarPage;
