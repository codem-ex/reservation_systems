import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import LoginPage from './login';
import EditProfilePage from './EditProfilePage';
import RegisterPage from './register';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null; // ⭐ จุดแก้หลัก

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!session ? <LoginPage /> : <Navigate to="/edit-profile" />}
        />
        <Route
          path="/edit-profile"
          element={session ? <EditProfilePage session={session} /> : <Navigate to="/login" />}
        />
        <Route
          path="/register"
          element={!session ? <RegisterPage /> : <Navigate to="/edit-profile" />}
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

window.supabase = supabase;
export default App;
