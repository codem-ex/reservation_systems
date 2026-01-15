import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const EditProfilePage = () => {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState({
        email: '',
        phonenum: '',
        user_agen: '',
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const loadData = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                navigate('/login');
                return;
            }

            setSession(session);

            // -----------------------------
            // 1. ดึงเบอร์โทรจาก profiles
            // -----------------------------
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('phonenum')
                .eq('id', session.user.id)
                .single();

            // -----------------------------
            // 2. ดึงหน่วยงานจาก user_info
            // -----------------------------
            const { data: userInfoData, error: userInfoError } = await supabase
                .from('user_info')
                .select('user_agen')
                .eq('id', session.user.id)
                .single();

            setProfile({
                email: session.user.email,
                phonenum: profileData?.phonenum || '',
                user_agen: userInfoData?.user_agen || '',
            });

            setLoading(false);
        };

        loadData();
    }, [navigate]);

    const handleChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        if (!session) return;
        setSaving(true);

        // -----------------------------
        // 1. save → profiles
        // -----------------------------
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: session.user.id,
                phonenum: profile.phonenum,
            });

        // -----------------------------
        // 2. save → user_info
        // -----------------------------
        const { error: userInfoError } = await supabase
            .from('user_info')
            .upsert({
                id: session.user.id,
                user_agen: profile.user_agen,
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
                <h2 className="auth-title">แก้ไขข้อมูลส่วนตัว</h2>

                <div className="form-group">
                    <label className="label">Email</label>
                    <input
                        className="input"
                        type="email"
                        value={profile.email}
                        disabled
                    />
                </div>

                <div className="form-group">
                    <label className="label">เบอร์โทรศัพท์</label>
                    <input
                        className="input"
                        name="phonenum"
                        value={profile.phonenum}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label className="label">หน่วยงาน</label>
                    <input
                        className="input"
                        name="user_agen"
                        value={profile.user_agen}
                        onChange={handleChange}
                    />
                </div>

                <button
                    className="auth-btn"
                    onClick={handleSave}
                    disabled={saving}
                >
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
