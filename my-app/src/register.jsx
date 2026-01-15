import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import './auth.css';

const RegisterPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phonenum: '',
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        if (!formData.email.endsWith('@chandra.ac.th')) {
            setMessage('Error: ต้องใช้อีเมล @chandra.ac.th เท่านั้น');
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phonenum: formData.phonenum,
                },
                emailRedirectTo: `${window.location.origin}/login`,
            },
        });

        if (error) {
            setMessage(`Error: ${error.message}`);
        } else {
            setMessage('สมัครสมาชิกสำเร็จ! กรุณาเช็คอีเมลเพื่อยืนยันตัวตน');
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                queryParams: {
                    hd: 'chandra.ac.th',
                    prompt: 'select_account',
                },
                redirectTo: window.location.origin, // ⭐ สำคัญ
            },
        });

        if (error) setMessage(`Error: ${error.message}`);
    };

    return (
        <div className="auth-container">
            {/* UI เดิม ใช้ได้ */}
        </div>
    );
};

export default RegisterPage;
