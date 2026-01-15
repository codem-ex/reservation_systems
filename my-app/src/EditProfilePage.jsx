import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const EditProfilePage = () => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [profile, setProfile] = useState({
        email: '',
        first_name: '',
        last_name: '',
        phonenum: '',
        user_agen: '',
        user_cat: '',
        stu_id: '',
    });

    const navigate = useNavigate();

    useEffect(() => {
        const loadData = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                navigate('/login');
                return;
            }

            setSession(session);

            /* ===============================
               1️⃣ profiles
            =============================== */
            const { data: profileData } = await supabase
                .from('profiles')
                .select('first_name, last_name, phonenum')
                .eq('id', session.user.id)
                .single();

            /* ===============================
               2️⃣ Google OAuth → แยกชื่ออัตโนมัติ
               (ทำเฉพาะครั้งแรก)
            =============================== */
            if (
                session.user.app_metadata?.provider === 'google' &&
                (!profileData?.first_name || !profileData?.last_name)
            ) {
                const fullName = session.user.user_metadata?.full_name;

                if (fullName) {
                    const parts = fullName.trim().split(' ');
                    const first_name = parts[0];
                    const last_name = parts.slice(1).join(' ') || null;

                    await supabase
                        .from('profiles')
                        .upsert({
                            id: session.user.id,
                            first_name,
                            last_name,
                        });
                }
            }

            /* ===============================
               3️⃣ user_info
            =============================== */
            const { data: userInfoData } = await supabase
                .from('user_info')
                .select('user_agen, user_cat, stu_id')
                .eq('id', session.user.id)
                .single();

            setProfile({
                email: session.user.email,
                first_name: profileData?.first_name || '',
                last_name: profileData?.last_name || '',
                phonenum: profileData?.phonenum || '',
                user_agen: userInfoData?.user_agen || '',
                user_cat: userInfoData?.user_cat || '',
                stu_id: userInfoData?.stu_id || '',
            });

            setLoading(false);
        };

        loadData();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'user_cat' && value !== 'นักศึกษา') {
            setProfile({ ...profile, user_cat: value, stu_id: '' });
        } else {
            setProfile({ ...profile, [name]: value });
        }
    };

    const handleSave = async () => {
        if (!session) return;
        setSaving(true);

        /* profiles → เบอร์โทรเท่านั้น */
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: session.user.id,
                phonenum: profile.phonenum,
            });

        /* user_info */
        const { error: userInfoError } = await supabase
            .from('user_info')
            .upsert({
                id: session.user.id,
                user_agen: profile.user_agen,
                user_cat: profile.user_cat,
                stu_id: profile.user_cat === 'นักศึกษา' ? profile.stu_id : null,
            });

        if (profileError || userInfoError) {
            alert(profileError?.message || userInfoError?.message);
        } else {
            alert('บันทึกข้อมูลเรียบร้อย');
        }

        setSaving(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    if (loading) return <p>กำลังโหลดข้อมูล...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">ข้อมูลส่วนตัว</h2>

                <label>อีเมล</label>
                <input className="input" value={profile.email} disabled />

                <label>ชื่อของท่าน</label>
                <input
                    className="input"
                    value={`${profile.first_name} ${profile.last_name}`}
                    disabled
                />

                <label>เบอร์โทรศัพท์</label>
                <input
                    className="input"
                    name="phonenum"
                    value={profile.phonenum}
                    onChange={handleChange}
                />

                <label>ตำแหน่ง</label>
                <select
                    className="input"
                    name="user_cat"
                    value={profile.user_cat}
                    onChange={handleChange}
                >
                    <option value="">-- เลือกตำแหน่ง --</option>
                    <option value="อาจารย์">อาจารย์</option>
                    <option value="บุคลากร">บุคลากร</option>
                    <option value="นักศึกษา">นักศึกษา</option>
                </select>

                {profile.user_cat === 'นักศึกษา' && (
                    <>
                        <label>รหัสนักศึกษา</label>
                        <input
                            className="input"
                            name="stu_id"
                            value={profile.stu_id}
                            onChange={handleChange}
                        />
                    </>
                )}

                <label>หน่วยงาน</label>
                <input
                    className="input"
                    name="user_agen"
                    value={profile.user_agen}
                    onChange={handleChange}
                />

                <button className="auth-btn" onClick={handleSave} disabled={saving}>
                    {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>

                <button
                    onClick={handleLogout}
                    className="auth-btn"
                    style={{ backgroundColor: '#ff4444', marginTop: '20px' }}
                >
                    ออกจากระบบ
                </button>
            </div>
        </div>
    );
};

export default EditProfilePage;
