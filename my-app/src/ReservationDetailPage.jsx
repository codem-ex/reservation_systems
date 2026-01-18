import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';

const ReservationDetailPage = () => {
    const navigate = useNavigate();
    const { reservId } = useParams();

    const [loading, setLoading] = useState(true);
    const [reservation, setReservation] = useState(null);
    const [stages, setStages] = useState([]);
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

            const { data: r, error: rErr } = await supabase
                .from('reservation_info')
                .select('reserv_id, room_id, reserv_start, reserv_end, reserv_purp, approval_status')
                .eq('reserv_id', reservId)
                .single();

            if (rErr) {
                setErrorMsg(rErr.message);
                setReservation(null);
                setStages([]);
                setLoading(false);
                return;
            }

            const { data: s, error: sErr } = await supabase
                .from('v_reservation_approval_stages')
                .select('stage_no, status, acted_at, note, approv_name, approv_pos, approver_id, acted_by_name')
                .eq('reservation_id', reservId)
                .order('stage_no', { ascending: true });

            setReservation(r);
            setStages(sErr ? [] : (s || []));
            if (sErr) setErrorMsg((prev) => prev ? prev : sErr.message);

            setLoading(false);
        };

        load();
    }, [navigate, reservId]);

    const stageCardStyle = (status) => {
        const base = { border: '1px solid #eee', borderRadius: 14, padding: 12 };
        if (status === 'APPROVED') return { ...base, borderColor: '#16a34a' };
        if (status === 'REJECTED') return { ...base, borderColor: '#dc2626' };
        return { ...base, borderColor: '#f59e0b' };
    };

    const statusLabel = (s) => s || 'PENDING';

    if (loading) return <p>กำลังโหลด...</p>;

    if (!reservation) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <h2 className="auth-title">รายละเอียดใบจอง</h2>
                    <p style={{ color: 'crimson' }}>โหลดไม่สำเร็จ: {errorMsg || 'ไม่พบข้อมูล'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 1100 }}>
                <h2 className="auth-title">รายละเอียดใบจอง</h2>

                <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
                    <div><b>Reserv ID:</b> {reservation.reserv_id}</div>
                    <div><b>ช่วงวัน:</b> {reservation.reserv_start} ถึง {reservation.reserv_end}</div>
                    <div><b>เหตุผล:</b> {reservation.reserv_purp}</div>
                    <div><b>สถานะรวม:</b> {reservation.approval_status}</div>
                </div>

                <h3 style={{ marginTop: 10 }}>Stage การอนุมัติ (2 ขั้น)</h3>

                {stages.length < 2 ? (
                    <p style={{ color: '#b45309' }}>
                        ระบบยังไม่มี Stage ครบ 2 ขั้น (ตรวจว่า <b>approver_chain</b> ตั้ง active ไว้ครบหรือยัง)
                    </p>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {stages.map((s) => (
                            <div key={s.stage_no} style={stageCardStyle(s.status)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                    <div style={{ fontWeight: 800 }}>Stage {s.stage_no}</div>
                                    <div style={{ fontWeight: 700 }}>{statusLabel(s.status)}</div>
                                </div>

                                {/* ✅ ชื่อผู้อนุมัติของ stage */}
                                <div style={{ marginTop: 6 }}>
                                    <b>ผู้อนุมัติ (ตามระบบ):</b>{' '}
                                    {s.approv_name || '(ไม่ระบุชื่อ)'} {s.approv_pos ? `(${s.approv_pos})` : ''}
                                </div>

                                {/* ✅ ชื่อผู้ที่กดอนุมัติจริง */}
                                <div style={{ marginTop: 6, opacity: 0.9 }}>
                                    <b>ผู้ที่กดอนุมัติ:</b> {s.acted_by_name ? s.acted_by_name : '-'}
                                </div>

                                <div style={{ marginTop: 6, opacity: 0.9 }}>
                                    <b>เวลาอนุมัติ:</b> {s.acted_at ? s.acted_at : '-'}
                                </div>

                                {s.note && (
                                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                                        <b>หมายเหตุ/เหตุผล:</b> {s.note}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {errorMsg && <p style={{ marginTop: 12, color: 'crimson' }}>หมายเหตุ: {errorMsg}</p>}

                <button
                    className="auth-btn"
                    type="button"
                    style={{ marginTop: 16 }}
                    onClick={() => navigate('/my-reservations')}
                >
                    กลับไปหน้าใบจองของฉัน
                </button>
            </div>
        </div>
    );
};

export default ReservationDetailPage;
