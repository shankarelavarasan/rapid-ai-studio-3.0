import React from 'react';
import { Event, Track } from '../types';

interface AudioClipProps {
    event: Event;
    track: Track;
    pixelsPerSecond: number;
    onDrag: (eventId: string, newTime: number) => void;
}

export const AudioClip: React.FC<AudioClipProps> = ({ event, track, pixelsPerSecond, onDrag }) => {
    const left = event.time * pixelsPerSecond;
    const width = event.duration * pixelsPerSecond;

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ eventId: event.id, initialTime: event.time, startX: e.clientX }));
        e.dataTransfer.effectAllowed = 'move';
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        const dragData = e.dataTransfer.getData('text/plain');
        if (!dragData) return;
        const { eventId, initialTime, startX } = JSON.parse(dragData);
        const deltaX = e.clientX - startX;
        const deltaTime = deltaX / pixelsPerSecond;
        const newTime = Math.max(0, initialTime + deltaTime);

        // A more robust implementation would snap to a grid here
        onDrag(eventId, newTime);
    };

    const getBackgroundColor = () => {
        switch (track.type) {
            case 'beat': return 'bg-indigo-500';
            case 'instrument': return 'bg-purple-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div 
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            // Add an onDragOver to the parent container in TrackLane to get continuous updates
            className={`absolute top-2 h-20 rounded-md cursor-grab active:cursor-grabbing text-white text-xs p-1 flex items-start ${getBackgroundColor()} hover:opacity-80 transition-opacity`}
            style={{ left: `${left}px`, width: `${Math.max(1, width)}px` }} // Ensure min width for visibility
        >
            <span className="truncate pointer-events-none">{event.note || track.name}</span>
        </div>
    );
};