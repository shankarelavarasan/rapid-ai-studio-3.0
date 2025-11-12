
import React from 'react';

interface TransportControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    onStop: () => void;
    bpm: number;
    setBpm: (bpm: number) => void;
}

const PlayIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>);
const PauseIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 100-2H9V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 100-2h-1V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>);
const StopIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 00-1 1v1a1 1 0 001 1h4a1 1 0 001-1v-1a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>);

export const TransportControls: React.FC<TransportControlsProps> = ({ isPlaying, onPlayPause, onStop, bpm, setBpm }) => {
    return (
        <div className="bg-gray-800 p-2 flex items-center justify-center space-x-6 border-t border-gray-700">
            <button onClick={onPlayPause} className="text-gray-200 hover:text-white transition-colors">
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button onClick={onStop} className="text-gray-200 hover:text-white transition-colors">
                <StopIcon />
            </button>
            <div className="flex items-center space-x-2">
                <label htmlFor="bpm" className="text-sm font-medium">BPM</label>
                <input
                    type="number"
                    id="bpm"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="bg-gray-700 w-20 text-center rounded-md border border-gray-600 p-1"
                />
            </div>
        </div>
    );
};
