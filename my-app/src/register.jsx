import React, { useState } from 'react';
import { supabase } from './supabaseClient'; // เรียกใช้ตัวแปรที่สร้างไว้
import './auth.css';

const RegisterPage = () => {
    const [formData, setFormData] = useState({
        email: '', password: '', first_name: '', last_name: '', phonenum: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phonenum: formData.phonenum,
                }
            }
        });

        if (error) setMessage(`Error: ${error.message}`);
        else setMessage('สมัครสมาชิกสำเร็จ! กรุณาเช็คอีเมลเพื่อยืนยัน');
        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">สมัครสมาชิก</h2>
                <form onSubmit={handleSignUp}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="label">ชื่อจริง</label>
                            <input className="input" name="first_name" type="text" required onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label">นามสกุล</label>
                            <input className="input" name="last_name" type="text" required onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="label">อีเมล</label>
                        <input className="input" name="email" type="email" required onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="label">เบอร์โทรศัพท์</label>
                        <input className="input" name="phonenum" type="tel" required onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="label">รหัสผ่าน</label>
                        <input className="input" name="password" type="password" required onChange={handleChange} />
                    </div>
                    <button className="auth-btn" type="submit" disabled={loading}>
                        {loading ? 'กำลังดำเนินการ...' : 'ลงทะเบียน'}
                    </button>
                </form>
                {message && <div className={`alert ${message.includes('Error') ? 'alert-error' : 'alert-success'}`}>{message}</div>}
            </div>
        </div>
    );
};

export default RegisterPage;