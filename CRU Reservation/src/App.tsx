import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";
import SearchRooms from "./pages/SearchRooms";
import MyBookings from "./pages/MyBookings";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import AdminAddRoom from "./pages/AdminAddRoom";

import { getCurrentUser } from "./services/storage";
import { useAuth } from "./lib/auth";
import { supabase } from "./lib/supabaseClient";

type ProfileLite = {
  id: string;
  department: string | null;
  mobile_phone: string | null;
  avatar_url: string | null;
};

function isProfileComplete(p: ProfileLite | null): boolean {
  if (!p) return false;
  const deptOk = !!(p.department && p.department.trim().length > 0);
  const phoneOk = !!(p.mobile_phone && p.mobile_phone.trim().length > 0);
  const avatarOk = !!(p.avatar_url && p.avatar_url.trim().length > 0);
  return deptOk && phoneOk && avatarOk;
}

/* ===================================
   Private Route (Supabase-first)
   - If profile incomplete -> force /profile
   - If complete -> allow access
=================================== */
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: supabaseUser, loading: authLoading } = useAuth();
  const localUser = getCurrentUser();
  const location = useLocation();

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  const isAuthed = useMemo(() => !!supabaseUser || !!localUser, [supabaseUser, localUser]);

  useEffect(() => {
    const run = async () => {
      // Only check profile completeness for Supabase-auth users
      if (!supabaseUser) {
        setProfileComplete(true); // fallback path (legacy local user) -> allow
        return;
      }

      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, department, mobile_phone, avatar_url")
          .eq("id", supabaseUser.id)
          .maybeSingle();

        if (error) {
          // If cannot read profile due to policy, treat as incomplete to force profile page
          setProfileComplete(false);
          return;
        }

        setProfileComplete(isProfileComplete((data as ProfileLite) ?? null));
      } finally {
        setProfileLoading(false);
      }
    };

    if (!authLoading) run();
  }, [authLoading, supabaseUser]);

  // Wait until auth state is resolved
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Checking session...
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  // While checking profile completeness
  if (profileLoading || profileComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading profile...
      </div>
    );
  }

  const isOnProfile = location.pathname === "/profile";
  const isOnLogin = location.pathname === "/login";

  // If logged in and profile incomplete -> force /profile (except already on /profile)
  if (profileComplete === false && !isOnProfile && !isOnLogin) {
    return <Navigate to="/profile" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public: Login */}
        <Route path="/login" element={<Login />} />

        {/* Protected single page: Profile (force for first-time users) */}
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />

        {/* Protected: Main app layout */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="search" element={<SearchRooms />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="admin" element={<AdminDashboard />} />

          {/* ✅ New: Admin add room */}
          <Route path="admin/rooms/new" element={<AdminAddRoom />} />

          {/* Redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;
