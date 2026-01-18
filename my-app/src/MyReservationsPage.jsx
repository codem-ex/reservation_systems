import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const MyReservationsPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setErrorMsg('');

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }

            const { data, error } = await supabase
                .from('reservation_info')
                .select('reserv_id, room_id, reserv_start, reserv_end, reserv_purp, approval_status')
                .order('reserv_start', { ascending: false });

            if (error) {
                setErrorMsg(error.message);
                setRows([]);
            } else {
                setRows(data || []);
            }

            setLoading(false);
        };

        load();
    }, [navigate]);

    const badgeStyle = (s) => {
        const base = {
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 12,
            border: '1px solid #ddd'
        };
        if (s === 'APPROVED') return { ...base, borderColor: '#16a34a' };
        if (s === 'REJECTED') return { ...base, borderColor: '#dc2626' };
        return { ...base, borderColor: '#f59e0b' };
    };

    if (loading) return <p>กำลังโหลด...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 1100 }}>
                <h2 className="auth-title">ใบจองของฉัน</h2>

                {errorMsg && <p style={{ color: 'crimson' }}>โหลดไม่สำเร็จ: {errorMsg}</p>}

                {rows.length === 0 ? (
                    <p>ยังไม่มีรายการจอง</p>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {rows.map((r) => (
                            <div
                                key={r.reserv_id}
                                style={{
                                    border: '1px solid #eee',
                                    borderRadius: 14,
                                    padding: 12,
                                    cursor: 'pointer'
                                }}
                                onClick={() => navigate(`/reservation/${r.reserv_id}`)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                    <div style={{ fontWeight: 700 }}>
                                        Reserv ID: {r.reserv_id}
                                    </div>
                                    <span style={badgeStyle(r.approval_status)}>
                                        {r.approval_status || 'PENDING'}
                                    </span>
                                </div>

                                <div style={{ marginTop: 6, opacity: 0.9 }}>
                                    ช่วงวัน: <b>{r.reserv_start}</b> ถึง <b>{r.reserv_end}</b>
                                </div>

                                <div style={{ marginTop: 6, opacity: 0.9 }}>
                                    เหตุผล: {r.reserv_purp}
                                </div>

                                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                                    คลิกเพื่อดู Stage การอนุมัติ
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyReservationsPage;
