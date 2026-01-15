import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const AdminApproverPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [session, setSession] = useState(null);

    const [users, setUsers] = useState([]);       // profiles ทั้งหมด
    const [approvers, setApprovers] = useState([]); // approver_info ทั้งหมด
    const [q, setQ] = useState('');

    const [selectedUser, setSelectedUser] = useState(null);
    const [approvPos, setApprovPos] = useState('');

    const loadAll = async () => {
        // โหลด users จาก profiles
        const { data: userRows, error: userErr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .order('first_name', { ascending: true });

        if (userErr) {
            alert(`โหลดรายชื่อผู้ใช้ไม่สำเร็จ: ${userErr.message}`);
            setUsers([]);
        } else {
            setUsers(userRows || []);
        }

        // โหลด approvers จาก approver_info
        const { data: approverRows, error: approverErr } = await supabase
            .from('approver_info')
            .select('user_id, approv_name, approv_pos')
            .order('approv_name', { ascending: true });

        if (approverErr) {
            // ถ้า policy ไม่ให้ select อาจขึ้น RLS (ให้คุณตั้ง policy แอดมิน)
            setApprovers([]);
        } else {
            setApprovers(approverRows || []);
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

            // 🔒 (optional) จุดตรวจสอบสิทธิ์แอดมิน
            // ถ้าคุณมี is_admin ใน user_info ให้เปิดใช้บล็อคนี้
            // const { data: ui } = await supabase.from('user_info').select('is_admin').eq('id', session.user.id).single();
            // if (!ui?.is_admin) { alert('คุณไม่มีสิทธิ์เข้าหน้านี้'); navigate('/edit-profile'); return; }

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
            const email = (u.email || '').toLowerCase();
            return full.includes(needle) || email.includes(needle);
        });
    }, [q, users]);

    const pickUser = (u) => {
        setSelectedUser(u);

        // ถ้าเคยเป็น approver อยู่แล้ว ให้เติมตำแหน่งเดิมมาให้แก้ได้
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
            || selectedUser.email
            || '(ไม่พบชื่อ)';

        setSaving(true);

        // ✅ สำคัญ: ใช้ user_id ตาม FK ที่ชี้ไป profiles(id)
        const { error } = await supabase
            .from('approver_info')
            .upsert(
                {
                    user_id: selectedUser.id,
                    approv_name: approvName,
                    approv_pos: approvPos.trim(),
                },
                { onConflict: 'user_id' }
            );

        if (error) {
            alert(`ตั้ง approver ไม่สำเร็จ: ${error.message}`);
        } else {
            alert('ตั้งเป็น approver เรียบร้อย');
            setSelectedUser(null);
            setApprovPos('');
            await loadAll(); // refresh list
        }

        setSaving(false);
    };

    const handleRemoveApprover = async (userId) => {
        if (!window.confirm('ต้องการยกเลิกสิทธิ์ approver ของผู้ใช้นี้ใช่ไหม?')) return;

        const { error } = await supabase
            .from('approver_info')
            .delete()
            .eq('user_id', userId);

        if (error) alert(`ลบ approver ไม่สำเร็จ: ${error.message}`);
        else {
            alert('ยกเลิก approver แล้ว');
            await loadAll();
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
                        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || '(ไม่มีชื่อ)';
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
