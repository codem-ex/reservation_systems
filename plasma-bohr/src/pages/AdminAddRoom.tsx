import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import {
    Save,
    Loader2,
    UploadCloud,
    Image as ImageIcon,
    ShieldAlert,
    Trash2,
} from "lucide-react";

type ProfileAdmin = {
    id: string;
    is_admin: boolean | null;
    email: string | null;
};

type RoomImage = { path: string; url: string };

// ✅ amenities jsonb: เก็บเป็น array ของ string (ง่ายสุดกับ UI)
// ถ้าคุณอยากเก็บเป็น object { "ไมค์": true } ก็ทำได้ แต่ตอนนี้ทำเป็น array
type RoomInsert = {
    name: string;
    location: string | null;
    capacity: number;
    status: string;
    description: string | null; // ✅ รายละเอียดห้อง/ความเป็นมา/เหมาะกับอะไร
    amenities: string[]; // ✅ อุปกรณ์: ลำโพง/ไมค์/โปรเจคเตอร์ ฯลฯ
    images: RoomImage[];
};

const BUCKET = "room-images";
const DRAFT_KEY = "draft:adminAddRoom:v3"; // ✅ bump version

function getExtFromFile(file: File) {
    const byName = (file.name.split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "webp"].includes(byName))
        return byName === "jpeg" ? "jpg" : byName;
    if (file.type === "image/png") return "png";
    if (file.type === "image/jpeg") return "jpg";
    if (file.type === "image/webp") return "webp";
    return "png";
}

function sanitizePath(p: string) {
    return p.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}

function maskErr(e: any) {
    return e?.message ?? "Unknown error";
}

// ✅ แปลงข้อความ amenities จาก textarea -> string[]
// รองรับคั่นด้วย , หรือขึ้นบรรทัด
function parseAmenities(text: string): string[] {
    return text
        .split(/[\n,]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function AdminAddRoom() {
    const { user, loading } = useAuth();
    const nav = useNavigate();

    const [profile, setProfile] = useState<ProfileAdmin | null>(null);
    const [checkingAdmin, setCheckingAdmin] = useState(true);

    const [name, setName] = useState("");
    const [location, setLocation] = useState("");
    const [capacity, setCapacity] = useState<number>(10);
    const [status, setStatus] = useState("available");

    // ✅ description = รายละเอียดห้อง
    const [description, setDescription] = useState("");

    // ✅ amenities input (human-friendly)
    const [amenitiesText, setAmenitiesText] = useState("");

    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement | null>(null);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const isAdmin = useMemo(() => profile?.is_admin === true, [profile?.is_admin]);

    // ===== Admin check =====
    useEffect(() => {
        const run = async () => {
            if (!user) return;

            setCheckingAdmin(true);
            const { data, error } = await supabase
                .from("profiles")
                .select("id, is_admin, email")
                .eq("id", user.id)
                .maybeSingle();

            if (error) {
                setProfile(null);
                setCheckingAdmin(false);
                return;
            }

            setProfile((data as ProfileAdmin) ?? null);
            setCheckingAdmin(false);
        };

        if (!loading) run();
    }, [loading, user]);

    // ===== Draft restore =====
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const d = JSON.parse(raw);

            if (typeof d.name === "string") setName(d.name);
            if (typeof d.location === "string") setLocation(d.location);
            if (typeof d.capacity === "number") setCapacity(d.capacity);
            if (typeof d.status === "string") setStatus(d.status);

            // ✅ restore description + amenitiesText
            if (typeof d.description === "string") setDescription(d.description);
            if (typeof d.amenitiesText === "string") setAmenitiesText(d.amenitiesText);
        } catch {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== Draft autosave =====
    useEffect(() => {
        const payload = {
            name,
            location,
            capacity,
            status,
            description,
            amenitiesText,
            updatedAt: Date.now(),
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }, [name, location, capacity, status, description, amenitiesText]);

    // ===== Cleanup previews on unmount =====
    useEffect(() => {
        return () => {
            imagePreviews.forEach((u) => URL.revokeObjectURL(u));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== Images pick =====
    const onPickFiles = (files: FileList | null) => {
        setError("");
        setMessage("");

        if (!files || files.length === 0) return;

        const allow = ["image/png", "image/jpeg", "image/webp"];
        const picked: File[] = [];

        for (const f of Array.from(files)) {
            if (!allow.includes(f.type)) {
                setError("รองรับเฉพาะ PNG / JPG / WEBP");
                return;
            }
            if (f.size > 5 * 1024 * 1024) {
                setError("ไฟล์รูปใหญ่เกินไป (จำกัด 5MB ต่อรูป)");
                return;
            }
            picked.push(f);
        }

        // cleanup previous previews
        imagePreviews.forEach((u) => URL.revokeObjectURL(u));

        const previews = picked.map((f) => URL.createObjectURL(f));
        setImageFiles(picked);
        setImagePreviews(previews);
    };

    const removeImageAt = (idx: number) => {
        setError("");
        setMessage("");

        setImageFiles((prev) => prev.filter((_, i) => i !== idx));
        setImagePreviews((prev) => {
            const target = prev[idx];
            if (target) URL.revokeObjectURL(target);
            return prev.filter((_, i) => i !== idx);
        });
    };

    // ===== Upload images to Storage =====
    const uploadRoomImages = async (roomId: string, files: File[]) => {
        const results: RoomImage[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = getExtFromFile(file);

            const rawPath = `rooms/${roomId}/${Date.now()}_${i}.${ext}`;
            const path = sanitizePath(rawPath);

            const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
                upsert: false,
                contentType: file.type,
                cacheControl: "3600",
            });

            if (upErr) throw upErr;

            const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
            results.push({ path, url: data.publicUrl });
        }

        return results;
    };

    const onSubmit = async () => {
        setError("");
        setMessage("");

        if (!isAdmin) {
            setError("หน้านี้สำหรับแอดมินเท่านั้น");
            return;
        }

        if (!name.trim()) {
            setError("กรุณากรอกชื่อห้อง");
            return;
        }
        if (!Number.isFinite(capacity) || capacity <= 0) {
            setError("ความจุต้องเป็นตัวเลขมากกว่า 0");
            return;
        }

        // ✅ parse amenities
        const amenities = parseAmenities(amenitiesText);

        setBusy(true);
        try {
            // 1) insert room first (get id)
            const insertPayload: RoomInsert = {
                name: name.trim(),
                location: location.trim() ? location.trim() : null,
                capacity: Number(capacity),
                status,
                // ✅ description = รายละเอียดห้อง
                description: description.trim() ? description.trim() : null,
                // ✅ amenities jsonb
                amenities,
                images: [],
            };

            const { data: created, error: insErr } = await supabase
                .from("rooms")
                .insert(insertPayload as any)
                .select("id")
                .single();

            if (insErr) throw insErr;

            const roomId = (created as any)?.id?.toString();
            if (!roomId) throw new Error("Insert room success but missing id");

            // 2) upload images (optional)
            if (imageFiles.length > 0) {
                const imgs = await uploadRoomImages(roomId, imageFiles);

                const { error: upRoomErr } = await supabase
                    .from("rooms")
                    .update({
                        images: imgs,
                        updated_at: new Date().toISOString(),
                    } as any)
                    .eq("id", roomId);

                if (upRoomErr) throw upRoomErr;
            }

            // clear draft on success
            sessionStorage.removeItem(DRAFT_KEY);

            setMessage("เพิ่มห้องสำเร็จ");
            setTimeout(() => nav("/admin"), 400);
        } catch (e: any) {
            setError(maskErr(e));
        } finally {
            setBusy(false);
        }
    };

    if (loading || checkingAdmin) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading...
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center text-gray-700">
                ยังไม่ได้เข้าสู่ระบบ
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4">
                <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                    <div className="flex items-center gap-3 text-red-700">
                        <ShieldAlert className="w-5 h-5" />
                        <div className="font-semibold">หน้านี้สำหรับแอดมินเท่านั้น</div>
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                        ให้ตั้งค่า <code className="px-1 bg-gray-100 rounded">profiles.is_admin = true</code>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[70vh] flex items-start justify-center py-10 px-4">
            <div className="w-full max-w-5xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Add Room</h1>
                    <p className="text-gray-500 mt-2">เพิ่มข้อมูลห้องประชุม (เฉพาะแอดมิน)</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                    {(error || message) && (
                        <div
                            className={[
                                "rounded-lg border p-3 text-sm mb-6",
                                error
                                    ? "bg-red-50 border-red-100 text-red-700"
                                    : "bg-emerald-50 border-emerald-100 text-emerald-700",
                            ].join(" ")}
                        >
                            {error || message}
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Images */}
                        <div className="w-full md:w-96">
                            <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-2 text-gray-700 font-semibold">
                                    <ImageIcon className="w-4 h-4" />
                                    รูปห้องประชุม (หลายรูป)
                                </div>

                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={busy}
                                    className="mt-4 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <UploadCloud className="w-4 h-4" />
                                    เลือกรูป (เลือกได้หลายไฟล์)
                                </button>

                                <input
                                    ref={fileRef}
                                    type="file"
                                    multiple
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => onPickFiles(e.target.files)}
                                />

                                <div className="mt-3 text-xs text-gray-500">PNG/JPG/WEBP • ≤ 5MB ต่อรูป</div>

                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    {imagePreviews.length === 0 ? (
                                        <div className="col-span-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-4 text-center">
                                            ยังไม่ได้เลือกรูป
                                        </div>
                                    ) : (
                                        imagePreviews.map((src, idx) => (
                                            <div key={src} className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
                                                <img src={src} alt={`preview-${idx}`} className="w-full h-28 object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImageAt(idx)}
                                                    className="absolute top-2 right-2 bg-white/90 border border-gray-200 rounded-lg p-1 hover:bg-white"
                                                    title="ลบรูปนี้"
                                                >
                                                    <Trash2 className="w-4 h-4 text-gray-700" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อห้อง</label>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="เช่น ห้องประชุม A"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่/อาคาร</label>
                                    <input
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="เช่น อาคาร 2 ชั้น 3"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ความจุ (คน)</label>
                                    <input
                                        type="number"
                                        value={capacity}
                                        onChange={(e) => setCapacity(Number(e.target.value))}
                                        min={1}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    >
                                        <option value="available">available</option>
                                        <option value="unavailable">unavailable</option>
                                        <option value="maintenance">maintenance</option>
                                    </select>
                                </div>

                                {/* ✅ description = รายละเอียดห้อง */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        รายละเอียดห้อง (ความเป็นมา/เหมาะกับอะไร)
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="อธิบายห้องนี้คืออะไร ความเป็นมาอย่างไร เหมาะกับการใช้งานแบบไหน เช่น ประชุมคณะ, อบรม, สัมมนา..."
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    />
                                </div>

                                {/* ✅ amenities jsonb */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Amenities / อุปกรณ์ในห้อง (เก็บลง amenities jsonb)
                                    </label>
                                    <textarea
                                        value={amenitiesText}
                                        onChange={(e) => setAmenitiesText(e.target.value)}
                                        placeholder={`พิมพ์รายการอุปกรณ์ เช่น\n- โปรเจคเตอร์\n- ไมโครโฟน\n- ลำโพง\n- กระดานไวท์บอร์ด\n\nคั่นด้วยคอมม่า หรือขึ้นบรรทัดก็ได้`}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    />
                                    <div className="mt-2 text-xs text-gray-500">
                                        ระบบจะบันทึกเป็น array เช่น <code className="px-1 bg-gray-100 rounded">["โปรเจคเตอร์","ไมโครโฟน"]</code>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={onSubmit}
                                    disabled={busy}
                                    className="bg-primary-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    บันทึกห้อง
                                </button>

                                <span className="text-sm text-gray-500">Draft autosave เปิดอยู่</span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* /Card */}
            </div>
        </div>
    );
}
