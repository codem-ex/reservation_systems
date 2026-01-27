import React, { useState } from 'react';
import { Users, Monitor, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MapPin, Info, ZoomIn } from 'lucide-react';
import type { Room } from '../types';
import ImageLightbox from './ImageLightbox';

interface RoomCardProps {
    room: Room;
    onBook: (room: Room) => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onBook }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);

    const images = room.images || [room.image || ''];

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const openLightbox = () => {
        setShowLightbox(true);
    };

    return (
        <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                <div
                    className="h-48 overflow-hidden relative group cursor-pointer"
                    onClick={openLightbox}
                >
                    <img
                        src={images[currentImageIndex]}
                        alt={room.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <ZoomIn className="text-white w-8 h-8 drop-shadow-lg" />
                    </div>

                    {images.length > 1 && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={nextImage}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full pointer-events-none">
                                {currentImageIndex + 1}/{images.length}
                            </div>
                        </>
                    )}

                    <div className="absolute top-3 right-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide
                    ${room.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {room.status}
                        </span>
                    </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 line-clamp-1" title={room.name}>{room.name}</h3>
                            <p className="text-sm text-gray-500">{room.type}</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 my-3 text-sm text-gray-600">
                        <div className="flex items-center" title="Capacity">
                            <Users className="w-4 h-4 mr-1.5" />
                            {room.capacity}
                        </div>
                        {room.location && (
                            <div className="flex items-center" title="Location">
                                <MapPin className="w-4 h-4 mr-1.5" />
                                <span className="truncate max-w-[100px]">{room.location.split(',')[0]}</span>
                            </div>
                        )}
                        {room.equipment.length > 0 && (
                            <div className="flex items-center" title="Equipment">
                                <Monitor className="w-4 h-4 mr-1.5" />
                                {room.equipment.length} items
                            </div>
                        )}
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && (
                        <div className="mb-4 pt-3 border-t border-gray-100 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                            {room.description && (
                                <div className="mb-3">
                                    <div className="flex items-center text-gray-700 font-medium mb-1">
                                        <Info className="w-3.5 h-3.5 mr-1.5" />
                                        Description
                                    </div>
                                    <p className="text-gray-600 leading-relaxed">{room.description}</p>
                                </div>
                            )}
                            {room.location && (
                                <div className="mb-3">
                                    <span className="text-gray-700 font-medium block mb-1">Full Location:</span>
                                    <p className="text-gray-600">{room.location}</p>
                                </div>
                            )}
                            <div>
                                <span className="text-gray-700 font-medium block mb-1">Equipment:</span>
                                <ul className="list-disc list-inside text-gray-600 grid grid-cols-2 gap-1">
                                    {room.equipment.map((item, i) => (
                                        <li key={i}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    <div className="mt-auto space-y-3">
                        {!isExpanded && (
                            <div className="flex flex-wrap gap-1 mb-1">
                                {room.equipment.slice(0, 3).map((eq, i) => (
                                    <span key={i} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                        {eq}
                                    </span>
                                ))}
                                {room.equipment.length > 3 && (
                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">+{room.equipment.length - 3}</span>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-slate-50 flex items-center justify-center transition-colors"
                                title={isExpanded ? "Show Less" : "Show Details"}
                            >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => onBook(room)}
                                disabled={room.status !== 'available'}
                                className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                {room.status === 'available' ? 'Book Room' : 'Unavailable'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox
                images={images}
                isOpen={showLightbox}
                onClose={() => setShowLightbox(false)}
                initialIndex={currentImageIndex}
            />
        </>
    );
};

export default RoomCard;
