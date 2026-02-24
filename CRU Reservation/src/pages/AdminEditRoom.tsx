import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import {
    Save,
    Loader2,
    UploadCloud,
    Trash2,
    ArrowLeft
} from "lucide-react";

type ProfileAdmin = {
    id: string;
    is_admin: boolean | null;
    email: string | null;
};

type RoomImage = { path: string; url: string };

type RoomData = {
    id: string;
    name: string;
    location: string | null;
    capacity: number;
    status: string;
    description: string | null;
    amenities: string[];
    images: RoomImage[];
};

const BUCKET = "room-images";

function getExtFromFile(file: File) {
    const byName = (file.name.split(".").pop() || "").toLowerCase();
    return ["png", "jpg", "jpeg", "webp"].includes(byName) ? (byName === "jpeg" ? "jpg" : byName) : "png";
}

function sanitizePath(p: string) {
    return p.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}

function parseAmenities(text: string): string[] {
    return text.split(/[\n,]+/g).map((s) => s.trim()).filter(Boolean);
}

export default function AdminEditRoom() {
    const { user, loading } = useAuth();
    const { id } = useParams();
    const nav = useNavigate();

    const [profile, setProfile] = useState<ProfileAdmin | null>(null);
    const [checkingAdmin, setCheckingAdmin] = useState(true);
    const [fetchingRoom, setFetchingRoom] = useState(true);

    const [name, setName] = useState("");
    const [location, setLocation] = useState("");
    const [capacity, setCapacity] = useState<number>(10);
    const [status, setStatus] = useState("available");
    const [description, setDescription] = useState("");
    const [amenitiesText, setAmenitiesText] = useState("");
    const [existingImages, setExistingImages] = useState<RoomImage[]>([]);

    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement | null>(null);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const isAdmin = useMemo(() => profile?.is_admin === true, [profile?.is_admin]);

    useEffect(() => {
        const checkAdmin = async () => {
            if (!user) return;
            const { data } = await supabase.from("profiles").select("id, is_admin, email").eq("id", user.id).maybeSingle();
            setProfile(data as any);
            setCheckingAdmin(false);
        };
        if (!loading) checkAdmin();
    }, [loading, user]);

    useEffect(() => {
        const fetchRoom = async () => {
            if (!id) return;
            setFetchingRoom(true);
            const { data, error } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
            if (error || !data) {
                setError("ไม่พบข้อมูลห้องประชุม");
            } else {
                const r = data as RoomData;
                setName(r.name);
                setLocation(r.location || "");
                setCapacity(r.capacity);
                setStatus(r.status || "available");
                setDescription(r.description || "");
                setAmenitiesText(Array.isArray(r.amenities) ? r.amenities.join("\n") : "");
                setExistingImages(r.images || []);
            }
            setFetchingRoom(false);
        };
        if (id) fetchRoom();
    }, [id]);

    const onPickFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const picked = Array.from(files).filter(f => ["image/png", "image/jpeg", "image/webp"].includes(f.type) && f.size <= 5 * 1024 * 1024);
        const previews = picked.map((f) => URL.createObjectURL(f));
        setImageFiles(prev => [...prev, ...picked]);
        setImagePreviews(prev => [...prev, ...previews]);
    };

    const removeNewImageAt = (idx: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== idx));
        setImagePreviews(prev => {
            URL.revokeObjectURL(prev[idx]);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const removeExistingImageAt = (idx: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== idx));
    };

    const onSubmit = async () => {
        if (!isAdmin || !id) return;
        if (!name.trim()) return setError("กรุณากรอกชื่อห้อง");

        setBusy(true);
        try {
            let finalImages = [...existingImages];

            // Upload new images
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                const ext = getExtFromFile(file);
                const path = sanitizePath(`rooms/${id}/${Date.now()}_new_${i}.${ext}`);
                const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
                if (upErr) throw upErr;
                const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
                finalImages.push({ path, url: data.publicUrl });
            }

            const { error: updErr } = await supabase.from("rooms").update({
                name: name.trim(),
                location: location.trim() || null,
                capacity: Number(capacity),
                status,
                description: description.trim() || null,
                amenities: parseAmenities(amenitiesText),
                images: finalImages,
                updated_at: new Date().toISOString()
            }).eq("id", id);

            if (updErr) throw updErr;
            setMessage("แก้ไขข้อมูลสำเร็จ");
            setTimeout(() => nav("/admin"), 1000);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    if (loading || checkingAdmin || fetchingRoom) return <div className="p-10 text-center text-gray-500 dark:text-slate-400">Loading...</div>;
    if (!isAdmin) return <div className="p-10 text-center text-red-500 dark:text-red-400">Access Denied</div>;

    return (
        <div className="max-w-5xl mx-auto py-10 px-4">
            <button onClick={() => nav("/admin")} className="mb-6 flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> กลับหน้าจัดการ
            </button>
            <h1 className="text-3xl font-bold mb-8 dark:text-white">แก้ไขห้องประชุม: {name}</h1>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
                {(error || message) && (
                    <div className={`p-4 rounded-xl mb-6 border ${error ? "bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400" : "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400"}`}>
                        {error || message}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <label className="block text-sm font-semibold mb-2 dark:text-white">รูปภาพห้องประชุม</label>
                        <div className="grid grid-cols-2 gap-2">
                            {existingImages.map((img, idx) => (
                                <div key={img.path} className="relative group">
                                    <img src={img.url} className="w-full h-24 object-cover rounded-lg" />
                                    <button onClick={() => removeExistingImageAt(idx)} className="absolute top-1 right-1 bg-white/90 dark:bg-slate-800/90 p-1 rounded-md opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-3 h-3 text-red-600" />
                                    </button>
                                </div>
                            ))}
                            {imagePreviews.map((src, idx) => (
                                <div key={src} className="relative group">
                                    <img src={src} className="w-full h-24 object-cover rounded-lg border-2 border-indigo-500" />
                                    <button onClick={() => removeNewImageAt(idx)} className="absolute top-1 right-1 bg-white/90 dark:bg-slate-800/90 p-1 rounded-md opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-3 h-3 text-red-600" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => fileRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                            <UploadCloud className="w-4 h-4" /> เพิ่มรูปใหม่
                        </button>
                        <input ref={fileRef} type="file" multiple hidden accept="image/*" onChange={(e) => onPickFiles(e.target.files)} />
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-sm font-medium dark:text-slate-300">ชื่อห้อง</label>
                                <input value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-xl mt-1 dark:bg-slate-800 dark:border-slate-700" />
                            </div>
                            <div>
                                <label className="text-sm font-medium dark:text-slate-300">ความจุ (คน)</label>
                                <input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="w-full p-3 border rounded-xl mt-1 dark:bg-slate-800 dark:border-slate-700" />
                            </div>
                            <div>
                                <label className="text-sm font-medium dark:text-slate-300">สถานะ</label>
                                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-3 border rounded-xl mt-1 dark:bg-slate-800 dark:border-slate-700">
                                    <option value="available">พร้อมใช้งาน</option>
                                    <option value="unavailable">ไม่พร้อมใช้งาน</option>
                                    <option value="maintenance">ปิดปรับปรุง</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium dark:text-slate-300">สถานที่</label>
                                <input value={location} onChange={e => setLocation(e.target.value)} className="w-full p-3 border rounded-xl mt-1 dark:bg-slate-800 dark:border-slate-700" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-6">
                    <div>
                        <label className="text-sm font-medium dark:text-slate-300">รายละเอียดห้อง</label>
                        <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border rounded-xl mt-1 dark:bg-slate-800 dark:border-slate-700" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-sm font-medium dark:text-slate-300">อุปกรณ์/สิ่งอำนวยความสะดวก (หนึ่งรายการต่อคนบรรทัด)</label>
                            <div className="flex gap-2">
                                {["โปรเจคเตอร์", "ไมโครโฟนไร้สาย", "เครื่องเสียง", "ไวท์บอร์ด", "ปลั๊กไฟเสริม"].map(q => (
                                    <button
                                        key={q}
                                        type="button"
                                        onClick={() => {
                                            if (!amenitiesText.includes(q)) {
                                                setAmenitiesText(prev => prev ? `${prev}\n${q}` : q);
                                            }
                                        }}
                                        className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors"
                                    >
                                        + {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea rows={4} value={amenitiesText} onChange={e => setAmenitiesText(e.target.value)} className="w-full p-3 border rounded-xl mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                    </div>
                    <button onClick={onSubmit} disabled={busy} className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2">
                        {busy ? <Loader2 className="animate-spin" /> : <Save />} บันทึกการแก้ไขข้อมูล
                    </button>
                </div>
            </div>
        </div>
    );
}
