import React, { useState } from 'react';
import { supabase } from './supabaseClient'; // เรียกใช้ตัวแปรที่สร้างไว้
import './auth.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) setMessage(`Error: ${error.message}`);
        else setMessage('เข้าสู่ระบบสำเร็จ!');
        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">เข้าสู่ระบบ</h2>
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label className="label">อีเมล</label>
                        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="label">รหัสผ่าน</label>
                        <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <button className="auth-btn" type="submit" disabled={loading}>
                        {loading ? 'กำลังเข้าสู่ระบบ...' : 'Login'}
                    </button>
                </form>
                {message && <div className={`alert ${message.includes('Error') ? 'alert-error' : 'alert-success'}`}>{message}</div>}
            </div>
        </div>
    );
};

export default LoginPage;