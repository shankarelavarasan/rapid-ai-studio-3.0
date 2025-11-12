import React, { useState, useRef } from 'react';
import { Track, Event, TrackType, InstrumentType } from '../types';
import { PIANO_NOTES } from '../constants';

interface TapPadProps {
    addTrack: (track: Omit<Track, 'id'>) => void;
    trackType: TrackType;
    instrument: InstrumentType;
    bpm: number;
    quantization: number;
    playSampleNow: (note: string, velocity: number, type: TrackType, instrument?: InstrumentType) => void;
}

interface QuantizedTap {
    note: string;
    velocity: number;
}

interface FeedbackPulse {
    id: number;
    x: number;
    y: number;
}

export const TapPad: React.FC<TapPadProps> = ({ addTrack, trackType, instrument, bpm, quantization, playSampleNow }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [feedbacks, setFeedbacks] = useState<FeedbackPulse[]>([]);
    const recordedTaps = useRef<Map<number, QuantizedTap>>(new Map());
    const startTime = useRef<number>(0);
    const padRef = useRef<HTMLDivElement>(null);

    const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isRecording) {
            setIsRecording(true);
            recordedTaps.current.clear();
            startTime.current = Date.now();
        }

        const pad = padRef.current;
        if (!pad) return;

        // --- Positional Note & Velocity Logic ---
        const rect = pad.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        let note: string;
        const velocity = Math.max(0.1, Math.min(1, 1 - (y / rect.height)));

        if (trackType === TrackType.Beat) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            const relativeDistance = distance / (rect.width / 2); // Normalize by radius

            // Check for FX in top-right corner first
            if (x > rect.width * 0.85 && y < rect.height * 0.15) {
                note = 'fx';
            } else if (relativeDistance < 0.25) { // Center zone for Bass
                note = 'bass';
            } else if (relativeDistance < 0.5) { // Inner ring for Kick
                note = 'kick';
            } else if (relativeDistance < 0.75) { // Middle ring for Snare
                note = 'snare';
            } else { // Outer ring for Hi-hat
                note = 'hihat';
            }
        } else {
            const noteIndex = Math.floor((x / rect.width) * PIANO_NOTES.length);
            note = PIANO_NOTES[noteIndex % PIANO_NOTES.length];
        }

        // --- 1. Play sound immediately for instant feedback ---
        playSampleNow(note, velocity, trackType, instrument);
        
        // --- 2. Quantize and Record Logic ---
        const beatDuration = 60 / bpm;
        const subdivision = quantization / 4;
        const subdivisionDuration = beatDuration / subdivision;
        const tapTime = (Date.now() - startTime.current) / 1000;
        const quantizedTime = Math.round(tapTime / subdivisionDuration) * subdivisionDuration;

        recordedTaps.current.set(quantizedTime, { note, velocity });

        // --- 3. Visual Feedback ---
        const feedbackId = Date.now() + Math.random();
        setFeedbacks(current => [...current, { id: feedbackId, x, y }]);
        setTimeout(() => {
            setFeedbacks(current => current.filter(f => f.id !== feedbackId));
        }, 1000);
    };
    
    const finishRecording = () => {
        if (recordedTaps.current.size === 0) {
            setIsRecording(false);
            return;
        }

        const recordingDuration = (Date.now() - startTime.current) / 1000;
        const noteDuration = (60 / bpm) / 4; // 16th note default duration
        
        let events: Event[] = Array.from(recordedTaps.current.entries()).map(([time, tap], i) => ({
            id: `event_${Date.now()}_${i}`,
            time: time,
            duration: noteDuration,
            note: tap.note,
            velocity: tap.velocity,
        }));
        
        events.sort((a, b) => a.time - b.time);

        // To preserve rests, we add a placeholder final event to mark the end time.
        const lastEventTime = events.length > 0 ? events[events.length - 1].time + events[events.length - 1].duration : 0;
        if (recordingDuration > lastEventTime) {
             events.push({
                 id: `event_end_${Date.now()}`,
                 time: recordingDuration,
                 duration: 0,
                 velocity: 0,
             });
        }
        
        const finalEvents = events.filter(e => e.duration > 0);

        const newTrack: Omit<Track, 'id'> = {
            name: `${instrument} Taps`,
            type: trackType,
            instrument,
            events: finalEvents,
            volume: 1,
            pan: 0,
            isMuted: false,
            isSolo: false,
            isLooped: trackType === TrackType.Beat, // Beats loop by default
        };

        addTrack(newTrack);
        setIsRecording(false);
        recordedTaps.current.clear();
    };

    return (
        <div className="flex flex-col h-full space-y-2">
            <div
                ref={padRef}
                onMouseDown={handleTap}
                className="relative flex-grow bg-gray-700 rounded-lg cursor-pointer flex items-center justify-center text-gray-400 select-none overflow-hidden"
            >
                <span className="z-10 pointer-events-none">
                    {isRecording ? 'Recording... Tap in rhythm!' : 'Click to start tapping'}
                </span>
                {feedbacks.map(fb => (
                    <div
                        key={fb.id}
                        className="absolute w-8 h-8 bg-indigo-400 rounded-full opacity-70 animate-ping pointer-events-none"
                        style={{
                            left: `${fb.x}px`,
                            top: `${fb.y}px`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    />
                ))}
            </div>
            {isRecording && (
                <button onClick={finishRecording} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors">
                    Finish & Add Track
                </button>
            )}
        </div>
    );
};