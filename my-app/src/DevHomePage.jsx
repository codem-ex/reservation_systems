import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

const DevHomePage = () => {
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [displayName, setDisplayName] = useState('');

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            if (!session) {
                setDisplayName('Guest (not logged in)');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', session.user.id)
                .single();

            const nameFromProfile =
                profile?.first_name
                    ? `${profile.first_name}${profile?.last_name ? ` ${profile.last_name}` : ''}`
                    : '';

            const nameFromMeta = session.user.user_metadata?.full_name || '';
            const nameFromEmail = session.user.email || '';

            setDisplayName(nameFromProfile || nameFromMeta || nameFromEmail);
        };

        init();
    }, []);

    const NavButton = ({ label, path, color = '#2563eb' }) => (
        <button
            onClick={() => navigate(path)}
            style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: color,
                color: 'white',
                fontWeight: 600,
                textAlign: 'left'
            }}
        >
            {label}
            <div style={{ fontSize: 12, opacity: 0.85 }}>{path}</div>
        </button>
    );

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 900 }}>
                <h2 className="auth-title">🧪 Dev Home</h2>

                <div style={{ marginBottom: 12 }}>
                    👤 ผู้ใช้ปัจจุบัน: <b>{displayName}</b>
                </div>

                {!session && (
                    <div style={{ marginBottom: 16, color: '#b91c1c' }}>
                        ⚠️ ยังไม่ได้ login (บางหน้าจะเข้าไม่ได้)
                    </div>
                )}

                {/* ================= AUTH ================= */}
                <h3>🔐 Auth / Profile</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <NavButton label="Login" path="/login" />
                    <NavButton label="Register" path="/register" />
                    <NavButton label="Edit Profile" path="/edit-profile" />
                </div>

                {/* ================= RESERVATION ================= */}
                <h3 style={{ marginTop: 20 }}>📅 Reservation (User)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <NavButton
                        label="Reservation Form"
                        path="/reservation-form"
                        color="#059669"
                    />
                    <NavButton
                        label="Reservation Calendar"
                        path="/reserve-calendar"
                        color="#059669"
                    />
                    <NavButton
                        label="My Reservations"
                        path="/my-reservations"
                        color="#059669"
                    />
                </div>

                {/* ================= RESERVATION DETAIL ================= */}
                <h3 style={{ marginTop: 20 }}>🧩 Reservation Detail</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    <NavButton
                        label="Reservation Detail (ใส่ reservId เอง)"
                        path="/reservation/PUT_RESERV_ID_HERE"
                        color="#0f766e"
                    />
                </div>

                {/* ================= ROOMS ================= */}
                <h3 style={{ marginTop: 20 }}>🏢 Meeting Rooms</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <NavButton
                        label="Meeting Rooms List"
                        path="/rooms"
                        color="#7c3aed"
                    />
                    <NavButton
                        label="Add Meeting Room (Admin)"
                        path="/admin/add-room"
                        color="#7c3aed"
                    />
                </div>

                {/* ================= APPROVAL ================= */}
                <h3 style={{ marginTop: 20 }}>✅ Approval</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <NavButton
                        label="Approver Dashboard"
                        path="/approver"
                        color="#b45309"
                    />
                </div>

                {/* ================= ADMIN ================= */}
                <h3 style={{ marginTop: 20 }}>🛠 Admin / System</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <NavButton
                        label="Admin Approver Setup"
                        path="/admin/approvers"
                        color="#dc2626"
                    />
                    <NavButton
                        label="Dev Home (this page)"
                        path="/dev"
                        color="#111827"
                    />
                </div>

                <div style={{ marginTop: 30, fontSize: 12, opacity: 0.7 }}>
                    ⚙️ หน้านี้ใช้สำหรับ Dev / Test / Debug เท่านั้น
                    <br />
                    แนะนำให้จำกัดสิทธิ์หรือปิด route นี้ใน production
                </div>
            </div>
        </div>
    );
};

export default DevHomePage;
