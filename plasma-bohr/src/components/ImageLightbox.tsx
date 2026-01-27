import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
    images: string[];
    initialIndex?: number;
    isOpen: boolean;
    onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ images, initialIndex = 0, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

    useEffect(() => {
        setCurrentIndex(initialIndex);
    }, [initialIndex, isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') showPrev();
            if (e.key === 'ArrowRight') showNext();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex]);

    if (!isOpen) return null;

    const showPrev = () => {
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const showNext = () => {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-[110]"
            >
                <X className="w-8 h-8" />
            </button>

            <div className="relative w-full h-full flex items-center justify-center p-4 md:p-10" onClick={e => e.stopPropagation()}>

                {/* Image */}
                <div className="relative max-w-full max-h-full flex flex-col items-center">
                    <img
                        src={images[currentIndex]}
                        alt={`View ${currentIndex + 1}`}
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    />
                    <div className="absolute bottom-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm backdrop-blur-md">
                        {currentIndex + 1} / {images.length}
                    </div>
                </div>

                {/* Navigation Buttons */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); showPrev(); }}
                            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 md:p-3 rounded-full bg-black/50 hover:bg-black/70 transition-all"
                        >
                            <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); showNext(); }}
                            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 md:p-3 rounded-full bg-black/50 hover:bg-black/70 transition-all"
                        >
                            <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ImageLightbox;
