import React, { useEffect, useRef, useCallback } from 'react';
import { Track } from '../types';

interface WaveformClipProps {
    track: Track;
    pixelsPerSecond: number;
    onDrag: (newStartTime: number) => void;
    updateTrack: (track: Track) => void;
    isSelected: boolean;
    onSelect: () => void;
    onRightClick: (e: React.MouseEvent) => void;
}

const drawWaveform = (
    canvas: HTMLCanvasElement, 
    buffer: AudioBuffer,
    trimStart: number,
    trimEnd: number
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const fullDuration = buffer.duration;
    const sampleRate = buffer.sampleRate;
    
    const startSample = Math.floor(trimStart * sampleRate);
    const endSample = Math.floor(trimEnd * sampleRate);
    const visibleSamples = endSample - startSample;
    
    const data = buffer.getChannelData(0);
    const step = Math.ceil(visibleSamples / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    
    // Draw the dimmed, full waveform
    ctx.strokeStyle = 'rgba(60, 80, 120, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const fullStep = Math.ceil(data.length / width);
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < fullStep; j++) {
            const datum = data[(i * fullStep) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        const x = i;
        const yMin = (1 + min) * amp;
        const yMax = (1 + max) * amp;
        ctx.moveTo(x, yMin);
        ctx.lineTo(x, yMax);
    }
    ctx.stroke();

    // Draw the active, trimmed part
    ctx.strokeStyle = '#a5b4fc'; // indigo-300
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    const visibleWidth = width;
    
    for (let i = 0; i < visibleWidth; i++) {
        const sampleIndex = startSample + Math.floor((i / visibleWidth) * visibleSamples);
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = data[sampleIndex + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        const x = i;
        const yMin = (1 + min) * amp;
        const yMax = (1 + max) * amp;
        ctx.moveTo(x, yMin);
        ctx.lineTo(x, yMax);
    }
    ctx.stroke();
};


export const WaveformClip: React.FC<WaveformClipProps> = ({ 
    track, 
    pixelsPerSecond, 
    onDrag, 
    updateTrack,
    isSelected,
    onSelect,
    onRightClick
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const clipRef = useRef<HTMLDivElement>(null);
    
    const { 
        startTime = 0, 
        duration = 0, 
        trimStartTime = 0, 
        trimEndTime = duration 
    } = track;

    const clipDuration = trimEndTime - trimStartTime;
    const left = startTime * pixelsPerSecond;
    const width = clipDuration * pixelsPerSecond;

    useEffect(() => {
        if (canvasRef.current && track.audioBuffer) {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            drawWaveform(canvas, track.audioBuffer, 0, track.audioBuffer.duration);
        }
    }, [track.audioBuffer, width]);

    const handleMainDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        if (pixelsPerSecond === 0) return;
        const dragData = e.dataTransfer.getData('text/plain');
        if (!dragData) return;
        const { initialTime, startX } = JSON.parse(dragData);
        const deltaX = e.clientX - startX;
        const deltaTime = deltaX / pixelsPerSecond;
        const newTime = Math.max(0, initialTime + deltaTime);
        onDrag(newTime);
    }, [pixelsPerSecond, onDrag]);

    const handleTrim = (
        e: React.MouseEvent<HTMLDivElement>, 
        handle: 'start' | 'end'
    ) => {
        e.stopPropagation();
        e.preventDefault();

        const moveHandler = (moveEvent: MouseEvent) => {
            if (!clipRef.current || pixelsPerSecond === 0) return;
            const rect = clipRef.current.parentElement!.getBoundingClientRect();
            const mouseX = moveEvent.clientX - rect.left;
            
            if (handle === 'start') {
                const newTrimStart = (mouseX / pixelsPerSecond) - startTime;
                const clampedTrimStart = Math.max(0, Math.min(newTrimStart, trimEndTime - 0.1));
                const trimDiff = clampedTrimStart - trimStartTime;
                
                updateTrack({
                    ...track,
                    startTime: startTime + trimDiff,
                    trimStartTime: clampedTrimStart,
                });
            } else { // 'end'
                const newTrimEnd = (mouseX / pixelsPerSecond) - startTime;
                const clampedTrimEnd = Math.min(duration, Math.max(newTrimEnd, trimStartTime + 0.1));
                updateTrack({
                    ...track,
                    trimEndTime: clampedTrimEnd
                });
            }
        };

        const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };

        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRightClick(e);
    }

    return (
        <div
            ref={clipRef}
            draggable
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ initialTime: startTime, startX: e.clientX }));
                e.dataTransfer.effectAllowed = 'move';
                const img = new Image();
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                e.dataTransfer.setDragImage(img, 0, 0);
            }}
            onDragEnd={handleMainDrag}
            className={`absolute top-2 h-20 rounded-md cursor-grab active:cursor-grabbing bg-teal-800/50 border border-teal-500 overflow-hidden group transition-all duration-100 ease-in-out
                ${isSelected ? 'ring-2 ring-yellow-400 shadow-lg' : ''}
            `}
            style={{ left: `${left}px`, width: `${width}px` }}
        >
            <div className="relative w-full h-full">
                 <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                 <div 
                    className="absolute inset-0 bg-black/30"
                    style={{
                       clipPath: `polygon(0% 0%, calc(${(trimStartTime / duration) * 100}% - 1px) 0%, calc(${(trimStartTime / duration) * 100}% - 1px) 100%, 0% 100%)`
                    }}
                 />
                 <div 
                    className="absolute inset-0 bg-black/30"
                     style={{
                       clipPath: `polygon(calc(${(trimEndTime / duration) * 100}% + 1px) 0%, 100% 0%, 100% 100%, calc(${(trimEndTime / duration) * 100}% + 1px) 100%)`
                    }}
                 />
            </div>
           
            <span className="absolute top-1 left-2 text-xs text-white truncate pointer-events-none">{track.name}</span>
            
            {/* Trim Handles */}
            <div 
                onMouseDown={(e) => handleTrim(e, 'start')}
                className="absolute left-0 top-0 h-full w-2 bg-indigo-300/50 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <div 
                onMouseDown={(e) => handleTrim(e, 'end')}
                className="absolute right-0 top-0 h-full w-2 bg-indigo-300/50 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
            />
        </div>
    );
};