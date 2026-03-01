
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// --- IMAGE VIEWER COMPONENT (GESTURE BASED ZOOM & PAN) ---
const ImageViewer = ({ src, onClose }: { src: string, onClose: () => void }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    
    // Mouse Drag State
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Touch Gesture State
    const lastTouchDistance = useRef<number | null>(null);

    // --- MOUSE EVENTS ---
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const newScale = scale + (e.deltaY < 0 ? 0.1 : -0.1);
        setScale(Math.min(Math.max(0.5, newScale), 5));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        e.stopPropagation();
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    // --- TOUCH EVENTS (MOBILE) ---
    const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
        return Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // Pinch Start
            const dist = getDistance(e.touches[0], e.touches[1]);
            lastTouchDistance.current = dist;
        } else if (e.touches.length === 1) {
            // Pan Start
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.stopPropagation();
        // Prevent default only if zoomed in or interacting to avoid blocking native page scroll excessively,
        // though in a full screen modal we usually want to block all background scroll.
        if (scale > 1 || isDragging) {
           // e.preventDefault(); // Optional: might block browser navigation gestures
        }

        if (e.touches.length === 2 && lastTouchDistance.current) {
            // Pinch Zooming
            const dist = getDistance(e.touches[0], e.touches[1]);
            const delta = dist - lastTouchDistance.current;
            
            // Adjust sensitivity
            const zoomFactor = delta * 0.005; 
            const newScale = Math.min(Math.max(0.5, scale + zoomFactor), 5);
            
            setScale(newScale);
            lastTouchDistance.current = dist;
        } else if (e.touches.length === 1 && isDragging) {
            // Panning
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
            });
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        lastTouchDistance.current = null;
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = src;
        link.download = `image_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Reset when src changes
    useEffect(() => {
        setScale(1);
        setPosition({x: 0, y: 0});
    }, [src]);

    return createPortal(
        <div 
            className="fixed inset-0 z-[20000] bg-black/95 backdrop-blur-xl flex flex-col animate-fade-in select-none touch-none"
            onClick={onClose}
            onWheel={handleWheel}
            
            // Mouse
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            
            // Touch
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* Controls */}
            <div className="absolute top-6 right-6 z-50 flex gap-4">
                <button 
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 shadow-xl"
                    onClick={handleDownload}
                    title="Baixar Imagem"
                >
                    <i className="fas fa-download text-xl"></i>
                </button>
                <button 
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-red-500 text-white flex items-center justify-center transition-all border border-white/10 shadow-xl"
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                >
                    <i className="fas fa-times text-xl"></i>
                </button>
            </div>

            {/* Viewport */}
            <div 
                className="flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                <img 
                    src={src} 
                    className="transition-transform duration-75 ease-out shadow-2xl rounded-sm object-contain pointer-events-none" 
                    style={{ 
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        maxHeight: '90vh',
                        maxWidth: '90vw',
                    }}
                    alt="Full Screen" 
                />
            </div>

            {/* Footer Tip */}
            <div className="absolute bottom-8 left-0 w-full text-center pointer-events-none opacity-50">
                <p className="text-[10px] text-white font-bold uppercase tracking-widest bg-black/50 inline-block px-4 py-2 rounded-full backdrop-blur-md">
                    <i className="fas fa-expand mr-2"></i> Pinça para Zoom • Arraste para mover
                </p>
            </div>
        </div>,
        document.body
    );
};

export default ImageViewer;