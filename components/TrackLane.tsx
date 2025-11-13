import React from 'react';
import { Track } from '../types';
import { AudioClip } from './AudioClip';
import { WaveformClip } from './WaveformClip';

type SelectedClip = {
    trackId: string;
    eventId?: string;
} | null;

interface TrackLaneProps {
    track: Track;
    updateTrack: (track: Track) => void;
    deleteTrack: (trackId: string) => void;
    pixelsPerSecond: number;
    selectedClip: SelectedClip;
    setSelectedClip: (clip: SelectedClip) => void;
    onRightClick: (e: React.MouseEvent, trackId: string, time: number, eventId?: string) => void;
}

const MuteIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" /></svg>);
const SoloIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>);
const DeleteIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>);
const LoopIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v2.101a7.002 7.002 0 0011.601 2.966 1 1 0 10-1.202-1.604A5.002 5.002 0 014 7.101V5a1 1 0 00-2 0v5a1 1 0 001 1h5a1 1 0 100-2H5.899A5.002 5.002 0 0113 10a5.002 5.002 0 01-4 4.9V17a1 1 0 102 0v-2.101a7.002 7.002 0 00-11.601-2.966 1 1 0 101.202 1.604A5.002 5.002 0 0116 12.899V15a1 1 0 102 0v-5a1 1 0 00-1-1h-5a1 1 0 100 2h4.101A5.002 5.002 0 017 10a5.002 5.002 0 014-4.9V3a1 1 0 00-2 0v2.101z" clipRule="evenodd" /></svg>);

export const TrackLane: React.FC<TrackLaneProps> = ({ 
    track, 
    updateTrack, 
    deleteTrack, 
    pixelsPerSecond,
    selectedClip,
    setSelectedClip,
    onRightClick
}) => {
    const handleMute = () => updateTrack({ ...track, isMuted: !track.isMuted });
    const handleSolo = () => updateTrack({ ...track, isSolo: !track.isSolo });
    const handleLoop = () => updateTrack({ ...track, isLooped: !track.isLooped });

    const handleEventDrag = (eventId: string, newTime: number) => {
        const updatedEvents = track.events.map(event =>
            event.id === eventId ? { ...event, time: newTime } : event
        );
        updateTrack({ ...track, events: updatedEvents });
    };
    
    const handleClipDrag = (newStartTime: number) => {
        updateTrack({ ...track, startTime: newStartTime });
    };

    const handleLaneRightClick = (e: React.MouseEvent) => {
        if (pixelsPerSecond === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = x / pixelsPerSecond;
        onRightClick(e, track.id, time);
    };

    return (
        <div className="flex items-stretch h-24 bg-gray-700/50 rounded-lg shadow-md">
            <div className="w-48 p-2 flex flex-col justify-between border-r border-gray-600">
                <span className="font-bold text-sm truncate">{track.name}</span>
                <div className="flex space-x-1">
                    <button onClick={handleMute} className={`p-1.5 rounded-md transition-colors ${track.isMuted ? 'bg-yellow-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`} title="Mute"><MuteIcon/></button>
                    <button onClick={handleSolo} className={`p-1.5 rounded-md transition-colors ${track.isSolo ? 'bg-blue-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`} title="Solo"><SoloIcon/></button>
                    <button onClick={handleLoop} className={`p-1.5 rounded-md transition-colors ${track.isLooped ? 'bg-green-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`} title="Loop"><LoopIcon/></button>
                    <input type="range" min="0" max="1" step="0.01" value={track.volume} onChange={(e) => updateTrack({...track, volume: parseFloat(e.target.value)})} className="w-full" title="Volume"/>
                    <button onClick={() => deleteTrack(track.id)} className="p-1.5 rounded-md bg-gray-600 hover:bg-red-500 text-gray-300 hover:text-white transition-colors" title="Delete"><DeleteIcon/></button>
                </div>
            </div>
            <div className="flex-1 relative" onContextMenu={handleLaneRightClick}>
                {track.type === 'audio' && track.audioBuffer && track.duration !== undefined && track.startTime !== undefined ? (
                    <WaveformClip 
                        track={track}
                        updateTrack={updateTrack}
                        pixelsPerSecond={pixelsPerSecond} 
                        onDrag={handleClipDrag}
                        isSelected={selectedClip?.trackId === track.id && !selectedClip.eventId}
                        onSelect={() => setSelectedClip({ trackId: track.id })}
                        onRightClick={(e) => onRightClick(e, track.id, 0)}
                    />
                ) : (
                    track.events.map(event => (
                        <AudioClip 
                            key={event.id} 
                            event={event} 
                            track={track} 
                            pixelsPerSecond={pixelsPerSecond} 
                            onDrag={handleEventDrag}
                            isSelected={selectedClip?.eventId === event.id}
                            onSelect={() => setSelectedClip({ trackId: track.id, eventId: event.id })}
                            onRightClick={(e) => onRightClick(e, track.id, event.time, event.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};