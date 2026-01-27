import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Lock, ArrowRight } from 'lucide-react';
import { getUsers, setCurrentUser } from '../services/storage';
import { MOCK_USERS } from '../services/mockData';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.endsWith('@chandra.ac.th')) {
            setError('Access restricted to Chandrakasem Rajabhat University personnel and students only (@chandra.ac.th).');
            return;
        }

        // Check against mock users to get role/details
        // In a real app we would authenticate with password
        const users = getUsers().length > 0 ? getUsers() : MOCK_USERS;
        const user = users.find(u => u.email === email);

        if (user) {
            setCurrentUser(user);
            // Force reload to update app state if not using context
            window.location.href = '/';
        } else {
            // If valid domain but not in mock data, maybe create a temp student user?
            // For now, let's just reject or say "User not found"
            // But to make it usable for the user, let's allow "creating" a session
            // user if the domain matches.
            const newUser = {
                id: 'u_' + Date.now(),
                name: email.split('@')[0],
                email: email,
                role: 'student', // Default to student
                department: 'General',
                studentId: 'temp',
            };
            // setCurrentUser(newUser); // Types might clash if not exactly matching User interface
            setError('User not found in system. Please use one of the demo accounts: john@chandra.ac.th, jane@chandra.ac.th');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-200 to-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserIcon className="w-8 h-8 text-primary-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
                    <p className="text-gray-500 mt-2">ระบบจองห้องประชุม มหาวิทยาลัยราชภัฏจันทรเกษม</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <div className="relative">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                placeholder="name@chandra.ac.th"
                                required
                            />
                            <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-start">
                            <Lock className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center"
                    >
                        Sign In
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </button>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <p className="text-xs text-center text-gray-500">
                            Authorized personnel and students only. <br />
                            Try <b>john@chandra.ac.th</b> or <b>jane@chandra.ac.th</b>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
