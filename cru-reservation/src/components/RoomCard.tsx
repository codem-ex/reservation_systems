import React, { useMemo, useState, useEffect } from "react";
import {
    Users,
    Monitor,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    MapPin,
    Info,
    ZoomIn,
    ImageOff,
} from "lucide-react";
import type { Room } from "../types";
import ImageLightbox from "./ImageLightbox";
import { supabase } from "../lib/supabaseClient";

interface RoomCardProps {
    room: Room;
    onBook: (room: Room) => void;
}

// ✅ bucket จริงของคุณ
const ROOM_BUCKET = "room-images";

type ImgItem = {
    raw: string; // ค่าดิบจาก DB (path หรือ URL)
    url: string; // URL ที่ใช้กับ <img>
};

function normalizeStatus(s: any) {
    return String(s ?? "").trim().toLowerCase();
}

function isAbsoluteUrl(s: string) {
    return /^https?:\/\//i.test(s);
}

function stripLeadingSlash(s: string) {
    return s.replace(/^\/+/, "");
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onBook }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);

    const roomId = (room as any)?.id ?? "(no-id)";
    const roomName = (room as any)?.name ?? "(no-name)";

    // ✅ เวลารูปเปลี่ยน (เพราะค้นหา/ฟิลเตอร์) ให้ reset index ไม่ให้ชี้เกิน length
    useEffect(() => {
        setCurrentImageIndex(0);
    }, [roomId]);

    /* ============================
       Convert DB value -> usable URL
       - raw can be:
         1) absolute URL
         2) storage path "rooms/.../file.webp"
    ============================ */
    const toPublicUrl = (raw: string): string => {
        const s0 = (raw || "").trim();
        if (!s0) return "";

        // already absolute
        if (isAbsoluteUrl(s0)) return s0;

        // if starts with "/" treat as site path (but usually you don't use this)
        if (s0.startsWith("/")) return s0;

        // storage path -> public url
        const path = stripLeadingSlash(s0);
        const { data } = supabase.storage.from(ROOM_BUCKET).getPublicUrl(path);
        return data?.publicUrl || "";
    };

    /* ============================
       Images (Safe)
       รองรับ rooms.images ที่เป็น:
         - ["rooms/..."]
         - [{url:"https://..."}, {path:"rooms/..."}]
         - [{url:"rooms/..."}] (บางทีคุณอาจเก็บ path ใน url)
    ============================ */
    const images = useMemo<ImgItem[]>(() => {
        const items: ImgItem[] = [];

        const rawArr = (room as any)?.images;

        if (Array.isArray(rawArr)) {
            for (const x of rawArr) {
                // string path/url
                if (typeof x === "string") {
                    const raw = x.trim();
                    if (!raw) continue;
                    const url = toPublicUrl(raw);
                    if (!url) continue;
                    items.push({ raw, url });
                    continue;
                }

                // object { url } or { path }
                if (x && typeof x === "object") {
                    const rawCandidate =
                        (typeof (x as any).url === "string" && (x as any).url) ||
                        (typeof (x as any).path === "string" && (x as any).path) ||
                        (typeof (x as any).key === "string" && (x as any).key) ||
                        "";

                    const raw = String(rawCandidate || "").trim();
                    if (!raw) continue;

                    const url = toPublicUrl(raw);
                    if (!url) continue;

                    items.push({ raw, url });
                    continue;
                }
            }
        }

        // legacy single fields (fallback)
        if (items.length === 0) {
            const candidates = [
                (room as any)?.image_path,
                (room as any)?.image_url,
                (room as any)?.image,
            ].filter((v) => typeof v === "string") as string[];

            for (const c of candidates) {
                const raw = c.trim();
                if (!raw) continue;
                const url = toPublicUrl(raw);
                if (url) {
                    items.push({ raw, url });
                    break;
                }
            }
        }

        return items;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room]);

    /* ============================
       Equipment Safe
       - schema ของคุณใช้ rooms.amenities jsonb (default '{}'::jsonb)
       - สามารถเป็น object เช่น {"Projector":true,"HDMI":true}
       - หรือบางคนเก็บเป็น array string ก็รองรับ
       - และรองรับกรณีเก่า room.equipment
    ============================ */
    const equipment = useMemo<string[]>(() => {
        const a = (room as any)?.amenities;

        // amenities: ["Projector", "HDMI"]
        if (Array.isArray(a)) {
            return a.filter((x) => typeof x === "string" && x.trim().length > 0);
        }

        // amenities: {"Projector": true, "HDMI": true}
        if (a && typeof a === "object") {
            return Object.keys(a).filter((k) => Boolean((a as any)[k]));
        }

        // fallback old field
        const eq = (room as any)?.equipment;
        if (Array.isArray(eq)) {
            return eq.filter((x) => typeof x === "string" && x.trim().length > 0);
        }

        return [];
    }, [room]);

    const status = (room as any)?.status ?? "";
    const isAvailable = normalizeStatus(status) === "available";

    const imgCount = images.length;
    const safeIndex =
        imgCount === 0 ? 0 : Math.min(Math.max(currentImageIndex, 0), imgCount - 1);
    const active = imgCount > 0 ? images[safeIndex] : null;

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (images.length <= 1) return;
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (images.length <= 1) return;
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const openLightbox = () => {
        if (images.length === 0) return;
        setShowLightbox(true);
    };

    return (
        <>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group/card">
                {/* Image / Placeholder */}
                <div
                    className={[
                        "h-48 overflow-hidden relative group",
                        images.length > 0 ? "cursor-pointer" : "cursor-default",
                    ].join(" ")}
                    onClick={openLightbox}
                >
                    {active ? (
                        <>
                            <img
                                src={active.url}
                                alt={roomName}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => {
                                    // ✅ log ชัด ๆ เพื่อ debug
                                    console.error("[RoomCard:image-load-failed]", {
                                        room: { id: roomId, name: roomName },
                                        bucket: ROOM_BUCKET,
                                        raw: active.raw,
                                        resolvedUrl: active.url,
                                        hint: [
                                            "1) Check bucket is PUBLIC or you use signed URL",
                                            "2) Check object path exists exactly",
                                            "3) If bucket is PUBLIC, URL should contain /object/public/room-images/...",
                                            "4) If images stores full URL already, verify it opens in browser",
                                        ].join(" | "),
                                    });

                                    // ซ่อนภาพที่พัง (ไม่ fallback)
                                    const img = e.currentTarget;
                                    img.style.display = "none";
                                }}
                            />

                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <ZoomIn className="text-white w-8 h-8 drop-shadow-lg" />
                            </div>

                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label="Previous image"
                                        type="button"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>

                                    <button
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label="Next image"
                                        type="button"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>

                                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full pointer-events-none">
                                        {safeIndex + 1}/{images.length}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-2">
                            <ImageOff className="w-8 h-8" />
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">ไม่มีรูปภาพ</div>
                        </div>
                    )}

                    <div className="absolute top-3 right-3">
                        <span
                            className={[
                                "px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide shadow-sm",
                                isAvailable
                                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50"
                                    : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50",
                            ].join(" ")}
                        >
                            {isAvailable ? "ว่าง" : status === "maintenance" ? "ซ่อมบำรุง" : status === "occupied" ? "ไม่ว่าง" : status}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3
                                className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1"
                                title={roomName}
                            >
                                {roomName}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                                {(room as any).type ?? ""}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 my-3 text-sm text-gray-600 dark:text-slate-400">
                        <div className="flex items-center" title="Capacity">
                            <Users className="w-4 h-4 mr-1.5 text-slate-400 dark:text-slate-500" />
                            {room.capacity} คน
                        </div>

                        {(room as any).location && (
                            <div className="flex items-center" title="Location">
                                <MapPin className="w-4 h-4 mr-1.5 text-slate-400 dark:text-slate-500" />
                                <span className="truncate max-w-[140px]">
                                    {String((room as any).location).split(",")[0]}
                                </span>
                            </div>
                        )}

                        {equipment.length > 0 && (
                            <div className="flex items-center" title="อุปกรณ์">
                                <Monitor className="w-4 h-4 mr-1.5 text-slate-400 dark:text-slate-500" />
                                {equipment.length} รายการ
                            </div>
                        )}
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && (
                        <div className="mb-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                            {(room as any).description && (
                                <div className="mb-3">
                                    <div className="flex items-center text-gray-700 dark:text-slate-300 font-medium mb-1">
                                        <Info className="w-3.5 h-3.5 mr-1.5" />
                                        รายละเอียด
                                    </div>
                                    <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                                        {String((room as any).description)}
                                    </p>
                                </div>
                            )}

                            {(room as any).location && (
                                <div className="mb-3">
                                    <span className="text-gray-700 dark:text-slate-300 font-medium block mb-1">
                                        สถานที่ตั้ง:
                                    </span>
                                    <p className="text-gray-600 dark:text-slate-400">
                                        {String((room as any).location)}
                                    </p>
                                </div>
                            )}

                            <div>
                                <span className="text-gray-700 dark:text-slate-300 font-medium block mb-1">
                                    อุปกรณ์ที่มีให้:
                                </span>
                                {equipment.length === 0 ? (
                                    <p className="text-gray-500 dark:text-slate-500">-</p>
                                ) : (
                                    <ul className="list-disc list-inside text-gray-600 dark:text-slate-400 grid grid-cols-2 gap-1 text-xs">
                                        {equipment.map((item, i) => (
                                            <li key={i}>{item}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mt-auto space-y-3">
                        {!isExpanded && equipment.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                                {equipment.slice(0, 3).map((eq, i) => (
                                    <span
                                        key={i}
                                        className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs"
                                    >
                                        {eq}
                                    </span>
                                ))}
                                {equipment.length > 3 && (
                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                        +{equipment.length - 3}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shadow-sm"
                                title={isExpanded ? "Show Less" : "Show Details"}
                                type="button"
                            >
                                {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                ) : (
                                    <ChevronDown className="w-4 h-4" />
                                )}
                            </button>

                            <button
                                onClick={() => onBook(room)}
                                disabled={!isAvailable}
                                className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                type="button"
                            >
                                {isAvailable ? "จองห้องนี้" : "ไม่ว่าง"}
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            <ImageLightbox
                images={images.map((x) => x.url)}
                isOpen={showLightbox}
                onClose={() => setShowLightbox(false)}
                initialIndex={safeIndex}
            />
        </>
    );
};

export default RoomCard;
