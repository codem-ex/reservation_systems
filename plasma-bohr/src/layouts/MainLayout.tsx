import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, Calendar, LogOut, User as UserIcon, Menu, X } from 'lucide-react';
import { getCurrentUser, setCurrentUser } from '../services/storage';

const MainLayout = () => {
    const location = useLocation();
    const user = getCurrentUser();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('mrs_current_user');
        window.location.href = '/login';
    };

    const navItems = [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Search Rooms', path: '/search', icon: Search },
        { label: 'My Bookings', path: '/bookings', icon: Calendar },
    ];

    if (user?.role === 'admin' || user?.role === 'staff') {
        navItems.push({ label: 'Admin Dashboard', path: '/admin', icon: UserIcon });
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between md:hidden">
                <div className="flex items-center">
                    <Menu className="w-6 h-6 text-gray-600 mr-3" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
                    <h1 className="text-xl font-bold text-primary-600">ระบบจองห้องประชุม</h1>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                    {user?.name.charAt(0)}
                </div>
            </div>

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-primary-600">ระบบจองห้องประชุม</h1>
                        <p className="text-xs text-gray-500 mt-1">มหาวิทยาลัยราชภัฏจันทรเกษม</p>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-primary-50 text-primary-600'
                                    : 'text-gray-600 hover:bg-slate-50 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="w-5 h-5 mr-3" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center p-3 bg-slate-50 rounded-lg mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold mr-3">
                            {user?.name.charAt(0)}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center w-full px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-[calc(100vh-64px)] md:h-screen">
                <div className="flex-1 overflow-auto p-4 md:p-8">
                    <Outlet />
                </div>
            </main>

            {/* Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}
        </div>
    );
};

export default MainLayout;
