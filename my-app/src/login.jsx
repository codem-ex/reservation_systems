import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { saveLog, downloadLogs } from './logger';
import './auth.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        saveLog('LOGIN_ATTEMPT', { email });

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            saveLog('LOGIN_ERROR', error);
            alert(error.message);
        } else {
            saveLog('LOGIN_SUCCESS', data.user?.id);
            // ❌ ไม่ navigate
        }
    };

    const handleGoogleLogin = async () => {
        saveLog('GOOGLE_LOGIN_START', {});
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

        if (error) saveLog('GOOGLE_ERROR', error);
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">Login</h2>

                <form onSubmit={handleLogin}>
                    <input
                        className="input"
                        type="email"
                        placeholder="Email"
                        required
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        className="input"
                        type="password"
                        placeholder="Password"
                        required
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button className="auth-btn" type="submit">
                        Login
                    </button>
                </form>

                <div className="divider">หรือ</div>

                <button onClick={handleGoogleLogin} className="google-btn" type="button">
                    Login with Google
                </button>

                <button
                    onClick={downloadLogs}
                    style={{
                        marginTop: '20px',
                        fontSize: '12px',
                        color: 'blue',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    📥 ดาวน์โหลด Log ไฟล์เพื่อส่งตรวจสอบ
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
