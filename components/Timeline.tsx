
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Track } from '../types';
import { TrackLane } from './TrackLane';

interface TimelineProps {
    tracks: Track[];
    playheadPosition: number;
    setPlayheadPosition: (pos: number) => void;
    updateTrack: (track: Track) => void;
    deleteTrack: (trackId: string) => void;
    bpm: number;
    reorderTracks: (dragIndex: number, hoverIndex: number) => void;
}

const RULER_HEIGHT = 30;
const SECONDS_PER_VIEW = 10;

export const Timeline: React.FC<TimelineProps> = ({ tracks, playheadPosition, setPlayheadPosition, updateTrack, deleteTrack, bpm, reorderTracks }) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const [timelineWidth, setTimelineWidth] = useState(0);

    // For track reordering D&D
    const draggedItemIndex = useRef<number | null>(null);
    const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);

    const pixelsPerSecond = timelineWidth > 0 ? timelineWidth / SECONDS_PER_VIEW : 0;

    const handlePlayheadInteraction = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const timeline = timelineRef.current;
        if (!timeline) return;

        const moveHandler = (moveEvent: MouseEvent) => {
            const rect = timeline.getBoundingClientRect();
            const newX = moveEvent.clientX - rect.left;
            const newPosition = Math.max(0, newX / pixelsPerSecond);
            setPlayheadPosition(newPosition);
        };

        const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        
        // Initial position set on click
        const rect = timeline.getBoundingClientRect();
        const newX = e.clientX - rect.left;
        const newPosition = Math.max(0, newX / pixelsPerSecond);
        setPlayheadPosition(newPosition);
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    }, [pixelsPerSecond, setPlayheadPosition]);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                setTimelineWidth(entries[0].contentRect.width);
            }
        });
        if (timelineRef.current) {
            observer.observe(timelineRef.current);
        }
        return () => observer.disconnect();
    }, []);

    // Drag and Drop handlers for track reordering
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number, trackId: string) => {
        draggedItemIndex.current = index;
        setDraggingTrackId(trackId);
        e.dataTransfer.effectAllowed = 'move';
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, hoverIndex: number) => {
        e.preventDefault();
        const dragIndex = draggedItemIndex.current;
        if (dragIndex === null || dragIndex === hoverIndex) {
            return;
        }
        reorderTracks(dragIndex, hoverIndex);
        draggedItemIndex.current = hoverIndex;
    };
    
    const handleDragEnd = () => {
        draggedItemIndex.current = null;
        setDraggingTrackId(null);
    };

    const renderRuler = () => {
        const markers = [];
        const totalSeconds = SECONDS_PER_VIEW;
        
        for (let i = 0; i <= totalSeconds; i++) {
            markers.push(
                <div key={`sec-${i}`} className="absolute top-0 h-full text-xs text-gray-500 flex flex-col items-center" style={{ left: `${i * pixelsPerSecond}px` }}>
                    <div className="w-px h-3 bg-gray-500"></div>
                    <span className="mt-1">{i}s</span>
                </div>
            );
        }
        return markers;
    };

    return (
        <div className="flex-1 overflow-x-auto overflow-y-scroll bg-gray-800/50 p-4" ref={timelineRef}>
            <div className="relative w-full min-w-max h-full">
                {/* Ruler */}
                <div
                    className="relative w-full h-8 bg-gray-900/50 rounded-t-lg cursor-pointer"
                    style={{ height: `${RULER_HEIGHT}px` }}
                    onMouseDown={handlePlayheadInteraction}
                >
                    {pixelsPerSecond > 0 && renderRuler()}
                </div>

                {/* Playhead */}
                <div
                    className="absolute top-0 h-full w-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{ left: `${playheadPosition * pixelsPerSecond}px`, top: `${RULER_HEIGHT}px` }}
                >
                    <div className="absolute -top-2.5 -left-1.5 w-4 h-4 border-2 border-gray-900 bg-red-500 rounded-full"></div>
                </div>

                {/* Tracks */}
                <div className="mt-2 space-y-2">
                    {tracks.map((track, index) => (
                        <div
                            key={track.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index, track.id)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`transition-opacity duration-200 cursor-grab active:cursor-grabbing ${draggingTrackId === track.id ? 'opacity-30' : 'opacity-100'}`}
                        >
                            <TrackLane
                                track={track}
                                updateTrack={updateTrack}
                                deleteTrack={deleteTrack}
                                pixelsPerSecond={pixelsPerSecond}
                            />
                        </div>
                    ))}
                    {tracks.length === 0 && (
                        <div className="h-48 flex items-center justify-center text-gray-500 rounded-lg border-2 border-dashed border-gray-700">
                           No tracks yet. Add one from the panel on the right!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
