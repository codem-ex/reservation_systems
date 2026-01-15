import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const BUCKET = 'meeting-room-images'; // ✅ ชื่อ bucket ที่สร้างใน Supabase Storage

const AddMeetingRoomPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);
    const [session, setSession] = useState(null);

    const [form, setForm] = useState({
        room_name: '',
        room_cap: '',
        room_prop: '',
        room_status: 'พร้อมใช้งาน',
        room_free: true,
    });

    const [imageFiles, setImageFiles] = useState([]); // ✅ เก็บไฟล์ที่เลือก
    const [uploadNote, setUploadNote] = useState(''); // แสดงสถานะเล็กน้อย

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }
            setSession(session);

            // ✅ เช็กสิทธิ์แอดมินจาก user_info.is_admin
            const { data: ui, error: uiErr } = await supabase
                .from('user_info')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();

            if (uiErr) {
                alert(`ตรวจสอบสิทธิ์ไม่สำเร็จ: ${uiErr.message}`);
                navigate('/edit-profile');
                return;
            }

            if (!ui?.is_admin) {
                alert('หน้านี้สำหรับผู้ดูแลระบบเท่านั้น');
                navigate('/edit-profile');
                return;
            }

            setIsAdmin(true);
            setLoading(false);
        };

        init();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleFilesChange = (e) => {
        const files = Array.from(e.target.files || []);
        setImageFiles(files);
    };

    const uploadImagesAndGetUrls = async (files) => {
        // ✅ อัปโหลดทีละรูป แล้วคืน array ของ public URLs
        if (!files?.length) return [];

        setUploadNote(`กำลังอัปโหลดรูป ${files.length} ไฟล์...`);

        const urls = [];

        for (const file of files) {
            // ตั้งชื่อไฟล์ไม่ให้ชนกัน (ใส่ user id + เวลา)
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
            const path = `rooms/${Date.now()}_${Math.random().toString(16).slice(2)}_${session.user.id}.${safeExt}`;

            const { error: uploadErr } = await supabase
                .storage
                .from(BUCKET)
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type || undefined,
                });

            if (uploadErr) {
                // ถ้าไฟล์ใดไฟล์หนึ่งพัง ให้หยุดและแจ้งเลย (กันข้อมูลครึ่งๆกลางๆ)
                throw new Error(`อัปโหลดรูปไม่สำเร็จ (${file.name}): ${uploadErr.message}`);
            }

            // ได้ public URL
            const { data: pub } = supabase
                .storage
                .from(BUCKET)
                .getPublicUrl(path);

            urls.push(pub.publicUrl);
        }

        setUploadNote('');
        return urls;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isAdmin || !session) return;

        if (!form.room_name.trim()) {
            alert('กรุณากรอกชื่อห้อง');
            return;
        }

        const capNum = Number(form.room_cap);
        if (!Number.isFinite(capNum) || capNum <= 0) {
            alert('กรุณากรอกความจุห้องเป็นตัวเลขมากกว่า 0');
            return;
        }

        setSaving(true);

        try {
            // 1) อัปโหลดรูป → ได้ URL list
            const imageUrls = await uploadImagesAndGetUrls(imageFiles);

            // 2) insert ห้อง + images ลง DB
            const payload = {
                room_name: form.room_name.trim(),
                room_cap: capNum,
                room_prop: form.room_prop.trim(),
                room_status: form.room_status.trim(),
                room_free: form.room_free,
                images: imageUrls, // ✅ เก็บเป็น array ของ URL
            };

            const { error } = await supabase
                .from('meeting_rooms')
                .insert(payload);

            if (error) {
                alert(error.message);
            } else {
                alert('เพิ่มห้องประชุมเรียบร้อย');
                setForm({
                    room_name: '',
                    room_cap: '',
                    room_prop: '',
                    room_status: 'พร้อมใช้งาน',
                    room_free: true,
                });
                setImageFiles([]);
                // reset input file ทำได้ด้วย key ถ้าต้องการ (เวอร์ชันนี้ปล่อยไว้ได้)
            }
        } catch (err) {
            alert(err.message || String(err));
        }

        setSaving(false);
    };

    if (loading) return <p>กำลังโหลด...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">เพิ่มห้องประชุม (แอดมิน)</h2>

                <form onSubmit={handleSubmit}>
                    <label>ชื่อห้อง</label>
                    <input
                        className="input"
                        name="room_name"
                        value={form.room_name}
                        onChange={handleChange}
                        required
                    />

                    <label>ความจุห้อง</label>
                    <input
                        className="input"
                        name="room_cap"
                        type="number"
                        min="1"
                        value={form.room_cap}
                        onChange={handleChange}
                        required
                    />

                    <label>อุปกรณ์ภายในห้อง</label>
                    <textarea
                        className="input"
                        name="room_prop"
                        rows={3}
                        value={form.room_prop}
                        onChange={handleChange}
                        placeholder="เช่น โปรเจคเตอร์, ไมค์, กระดานไวท์บอร์ด"
                    />

                    <label>สถานะของห้อง</label>
                    <input
                        className="input"
                        name="room_status"
                        value={form.room_status}
                        onChange={handleChange}
                        placeholder="เช่น พร้อมใช้งาน / ปิดปรับปรุง"
                    />

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            name="room_free"
                            checked={form.room_free}
                            onChange={handleChange}
                        />
                        สถานะห้องว่าง (room_free)
                    </label>

                    <div style={{ marginTop: 12 }}>
                        <label>รูปภาพห้อง (อัปโหลดไฟล์)</label>
                        <input
                            className="input"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFilesChange}
                        />

                        {imageFiles.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                                เลือกแล้ว {imageFiles.length} ไฟล์: {imageFiles.map(f => f.name).join(', ')}
                            </div>
                        )}

                        {uploadNote && (
                            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                                {uploadNote}
                            </div>
                        )}
                    </div>

                    <button className="auth-btn" type="submit" disabled={saving} style={{ marginTop: 16 }}>
                        {saving ? 'กำลังบันทึก...' : 'บันทึกห้องประชุม'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddMeetingRoomPage;
