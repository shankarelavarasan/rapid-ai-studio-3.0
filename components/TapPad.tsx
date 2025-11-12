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
        if (trackType === TrackType.Beat) {
            const drumSounds = ['kick', 'snare', 'hihat'];
            const soundIndex = Math.floor((x / rect.width) * drumSounds.length);
            note = drumSounds[soundIndex % drumSounds.length];
        } else {
            const noteIndex = Math.floor((x / rect.width) * PIANO_NOTES.length);
            note = PIANO_NOTES[noteIndex % PIANO_NOTES.length];
        }
        
        const velocity = Math.max(0.1, Math.min(1, 1 - (y / rect.height)));

        // --- 1. Play sound immediately for instant feedback ---
        playSampleNow(note, velocity, trackType, instrument);
        
        // --- 2. Quantize and Record Logic ---
        const beatDuration = 60 / bpm;
        const subdivision = quantization / 4; // 16th notes -> 16/4=4. 8th -> 8/4=2.
        const subdivisionDuration = beatDuration / subdivision;
        const tapTime = (Date.now() - startTime.current) / 1000;
        const quantizedTime = Math.round(tapTime / subdivisionDuration) * subdivisionDuration;

        // Store the quantized tap, overwriting if one already exists at this time slot
        recordedTaps.current.set(quantizedTime, { note, velocity });

        // --- 3. Visual Feedback ---
        const feedbackId = Date.now() + Math.random();
        setFeedbacks(current => [...current, { id: feedbackId, x, y }]);
        setTimeout(() => {
            setFeedbacks(current => current.filter(f => f.id !== feedbackId));
        }, 1000); // Tailwind's animate-ping duration is 1s
    };
    
    const finishRecording = () => {
        if (recordedTaps.current.size === 0) {
            setIsRecording(false);
            return;
        }

        const recordingDuration = (Date.now() - startTime.current) / 1000;
        const beatDuration = 60 / bpm;
        const noteDuration = beatDuration / 4; // 16th note default duration
        
        let events: Event[] = Array.from(recordedTaps.current.entries()).map(([time, tap], i) => ({
            id: `event_${Date.now()}_${i}`,
            time: time,
            duration: noteDuration,
            note: tap.note,
            velocity: tap.velocity,
        }));
        
        // Sort events by time just in case
        events.sort((a, b) => a.time - b.time);

        // Ensure the full recording duration is captured by adding a final event if needed
        const lastEventTime = events.length > 0 ? events[events.length - 1].time + events[events.length - 1].duration : 0;
        if (recordingDuration > lastEventTime) {
             // We can represent the full duration by adjusting the duration of the last note,
             // or by ensuring the rendering logic knows the total clip length.
             // For simplicity, we'll let the event list define the length.
             // To preserve rests, we add a placeholder final event if there's silence at the end.
             if (events.length > 0) {
                 const lastEvent = events[events.length - 1];
                 const timeSinceLastEvent = recordingDuration - lastEvent.time;
                 // A more robust system would have a "clip duration" property.
                 // For now, extending the last note can be a visual cue.
                 // Let's just create an empty event to mark the end time.
                 events.push({
                     id: `event_end_${Date.now()}`,
                     time: recordingDuration,
                     duration: 0,
                     velocity: 0,
                 });
             }
        }
        
        // Filter out the placeholder event before adding the track
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