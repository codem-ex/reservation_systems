import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const MeetingRoomsListPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const loadRooms = async () => {
            // ถ้าคุณอยากให้ "ดูได้เฉพาะคน login" ให้เปิดเช็ก session ตรงนี้
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }

            const { data, error } = await supabase
                .from('meeting_rooms')
                .select('room_name, room_cap, room_prop, room_status, room_free, images')
                .order('room_name', { ascending: true });

            if (error) {
                setErrorMsg(error.message);
                setRooms([]);
            } else {
                setRooms(data || []);
            }

            setLoading(false);
        };

        loadRooms();
    }, [navigate]);

    const normalizeImages = (images) => {
        // รองรับ: null / [] / jsonb array / text[] / หรือ json string เผื่อไว้
        if (!images) return [];
        if (Array.isArray(images)) return images.filter(Boolean);
        if (typeof images === 'string') {
            try {
                const parsed = JSON.parse(images);
                return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } catch {
                return [];
            }
        }
        return [];
    };

    if (loading) return <p>กำลังโหลด...</p>;

    if (errorMsg) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <h2 className="auth-title">รายการห้องประชุม</h2>
                    <p style={{ color: 'crimson' }}>โหลดข้อมูลไม่สำเร็จ: {errorMsg}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 980 }}>
                <h2 className="auth-title">รายการห้องประชุม</h2>

                {rooms.length === 0 ? (
                    <p>ยังไม่มีห้องประชุมในระบบ</p>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {rooms.map((r, idx) => {
                            const imgs = normalizeImages(r.images);
                            const cover = imgs[0];

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        border: '1px solid #eee',
                                        borderRadius: 14,
                                        padding: 12,
                                        display: 'grid',
                                        gridTemplateColumns: cover ? '180px 1fr' : '1fr',
                                        gap: 12,
                                        alignItems: 'start',
                                    }}
                                >
                                    {cover && (
                                        <img
                                            src={cover}
                                            alt={r.room_name}
                                            style={{
                                                width: 180,
                                                height: 120,
                                                objectFit: 'cover',
                                                borderRadius: 12,
                                                border: '1px solid #f1f1f1',
                                            }}
                                        />
                                    )}

                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                                            {r.room_name}
                                        </div>

                                        <div style={{ marginTop: 4, opacity: 0.85 }}>
                                            ความจุ: {r.room_cap} คน
                                        </div>

                                        <div style={{ marginTop: 4 }}>
                                            สถานะห้อง: <b>{r.room_status || '-'}</b>
                                            {' · '}
                                            ว่าง: <b>{r.room_free ? 'ว่าง' : 'ไม่ว่าง'}</b>
                                        </div>

                                        {r.room_prop && (
                                            <div style={{ marginTop: 8, opacity: 0.9 }}>
                                                อุปกรณ์: {r.room_prop}
                                            </div>
                                        )}

                                        {imgs.length > 1 && (
                                            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {imgs.slice(1, 5).map((u, i) => (
                                                    <img
                                                        key={i}
                                                        src={u}
                                                        alt={`${r.room_name}-${i}`}
                                                        style={{
                                                            width: 70,
                                                            height: 50,
                                                            objectFit: 'cover',
                                                            borderRadius: 10,
                                                            border: '1px solid #f1f1f1',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MeetingRoomsListPage;
