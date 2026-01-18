import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const AdminApproverPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [session, setSession] = useState(null);

    const [users, setUsers] = useState([]);          // มาจาก backend (auth.users + profiles)
    const [approvers, setApprovers] = useState([]);  // มาจาก backend (approver_info)

    const [q, setQ] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [approvPos, setApprovPos] = useState('');

    const apiFetch = async (path, options = {}) => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
            navigate('/login');
            throw new Error('No session token');
        }

        const res = await fetch(path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...(options.headers || {}),
            },
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            const msg = data?.message || data?.error || res.statusText;
            throw new Error(msg);
        }

        return data;
    };

    const loadAll = async () => {
        // 1) users จาก backend
        try {
            const u = await apiFetch('/api/admin/users');
            setUsers(u.users || []);
        } catch (err) {
            alert(`โหลดรายชื่อผู้ใช้ไม่สำเร็จ: ${err.message}`);
            setUsers([]);
        }

        // 2) approvers จาก backend
        try {
            const a = await apiFetch('/api/admin/approvers');
            setApprovers(a.approvers || []);
        } catch (err) {
            // ถ้าไม่ใช่ admin จะโดน 403
            setApprovers([]);
        }
    };

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }
            setSession(session);

            await loadAll();
            setLoading(false);
        };

        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const approverMap = useMemo(() => {
        const m = new Map();
        approvers.forEach((a) => m.set(a.user_id, a));
        return m;
    }, [approvers]);

    const filteredUsers = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return users;

        return users.filter((u) => {
            const full = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
            const display = (u.display_name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            return full.includes(needle) || email.includes(needle) || display.includes(needle);
        });
    }, [q, users]);

    const pickUser = (u) => {
        setSelectedUser(u);
        const existing = approverMap.get(u.id);
        setApprovPos(existing?.approv_pos || '');
    };

    const handleMakeApprover = async () => {
        if (!selectedUser) return;

        if (!approvPos.trim()) {
            alert('กรุณากรอกตำแหน่งของ approver');
            return;
        }

        const approvName =
            `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim()
            || selectedUser.display_name
            || selectedUser.email
            || '(ไม่พบชื่อ)';

        setSaving(true);

        try {
            await apiFetch('/api/admin/approvers/upsert', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: selectedUser.id,
                    approv_name: approvName,
                    approv_pos: approvPos.trim(),
                }),
            });

            alert('ตั้งเป็น approver เรียบร้อย');
            setSelectedUser(null);
            setApprovPos('');
            await loadAll();
        } catch (err) {
            alert(`ตั้ง approver ไม่สำเร็จ: ${err.message}`);
        }

        setSaving(false);
    };

    const handleRemoveApprover = async (userId) => {
        const ok = window.confirm('ต้องการยกเลิกสิทธิ์ approver ของผู้ใช้นี้ใช่ไหม?');
        if (!ok) return;

        try {
            await apiFetch(`/api/admin/approvers/${userId}`, { method: 'DELETE' });
            alert('ยกเลิก approver แล้ว');
            await loadAll();
        } catch (err) {
            alert(`ลบ approver ไม่สำเร็จ: ${err.message}`);
        }
    };

    if (loading) return <p>กำลังโหลด...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 980 }}>
                <h2 className="auth-title">จัดการ Approver (แอดมิน)</h2>

                <input
                    className="input"
                    placeholder="ค้นหาชื่อหรืออีเมล..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: 10, fontWeight: 600 }}>
                    <div>ชื่อ-นามสกุล</div>
                    <div>อีเมล</div>
                    <div>สถานะ</div>
                </div>

                <div style={{ marginTop: 6 }}>
                    {filteredUsers.map((u) => {
                        const fullName =
                            `${u.first_name || ''} ${u.last_name || ''}`.trim()
                            || u.display_name
                            || '(ไม่มีชื่อ)';

                        const isApprover = approverMap.has(u.id);

                        return (
                            <div
                                key={u.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1.2fr 1.2fr 0.8fr',
                                    gap: 10,
                                    padding: '10px 0',
                                    borderBottom: '1px solid #eee',
                                    alignItems: 'center',
                                }}
                            >
                                <div>{fullName}</div>
                                <div style={{ opacity: 0.8 }}>{u.email || '-'}</div>

                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => pickUser(u)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 10,
                                            border: '1px solid #ccc',
                                            background: '#fff',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {isApprover ? 'แก้ไข Approver' : 'ตั้งเป็น Approver'}
                                    </button>

                                    {isApprover && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveApprover(u.id)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: 10,
                                                border: '1px solid #fca5a5',
                                                background: '#fff',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            ยกเลิก
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredUsers.length === 0 && (
                        <p style={{ marginTop: 12, opacity: 0.7 }}>ไม่พบผู้ใช้ตามคำค้นหา</p>
                    )}
                </div>

                {selectedUser && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
                        <h3 style={{ margin: 0, marginBottom: 10 }}>ตั้งค่า Approver</h3>

                        <div style={{ marginBottom: 8, opacity: 0.9 }}>
                            ผู้ใช้ที่เลือก:{' '}
                            <b>
                                {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim()
                                    || selectedUser.display_name
                                    || selectedUser.email
                                    || '(ไม่พบชื่อ)'}
                            </b>
                        </div>

                        <label>ตำแหน่งของ approver (approv_pos)</label>
                        <input
                            className="input"
                            value={approvPos}
                            onChange={(e) => setApprovPos(e.target.value)}
                            placeholder="เช่น หัวหน้าสาขา / คณบดี / ผู้จัดการ..."
                        />

                        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                            <button className="auth-btn" type="button" disabled={saving} onClick={handleMakeApprover}>
                                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setSelectedUser(null); setApprovPos(''); }}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    border: '1px solid #ccc',
                                    background: '#fff',
                                    cursor: 'pointer',
                                }}
                            >
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminApproverPage;
