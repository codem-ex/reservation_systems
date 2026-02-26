import { supabase } from "./supabaseClient";

export async function ensureProfileEmail() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user?.id) return;

    const email = user.email ?? null;

    // ✅ อัปเดต/อัปเสิร์ตให้ profiles.email มีค่าเสมอ
    const { error } = await supabase
        .from("profiles")
        .upsert(
            {
                id: user.id,
                email,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
        );

    if (error) throw error;
}
