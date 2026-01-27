import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // 1) Load initial session
        supabase.auth.getSession().then(({ data }) => {
            if (!mounted) return;
            setUser(data.session?.user ?? null);
            setLoading(false);
        });

        // 2) Subscribe changes
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            setUser(session?.user ?? null);
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    return { user, loading };
}
