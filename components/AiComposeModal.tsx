import React, { useState, useEffect } from 'react';
import { generateAiTrack } from '../services/geminiService';
import { Track, InstrumentType, TrackType } from '../types';

interface AiComposeModalProps {
    trackType: 'beat' | 'instrument';
    instrument: InstrumentType;
    bpm: number;
    onClose: () => void;
    onTrackGenerated: (track: Omit<Track, 'id'>) => void;
}

export const AiComposeModal: React.FC<AiComposeModalProps> = ({ trackType, instrument, bpm, onClose, onTrackGenerated }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState('Initializing AI composer...');

    useEffect(() => {
        const compose = async () => {
            try {
                setProgressMessage(`Generating ${trackType} at ${bpm} BPM...`);
                const aiResponse = await generateAiTrack(trackType, bpm, instrument);

                setProgressMessage('Parsing AI response...');
                // The AI response is now an object with events.
                const newTrack: Omit<Track, 'id'> = {
                    name: `AI Generated ${instrument}`,
                    type: trackType === 'beat' ? TrackType.Beat : TrackType.Instrument,
                    instrument: trackType === 'beat' ? InstrumentType.Drums : instrument,
                    events: aiResponse.events,
                    volume: 1,
                    pan: 0,
                    isMuted: false,
                    isSolo: false,
                    isLooped: trackType === 'beat', // Beats loop by default
                };
                onTrackGenerated(newTrack);
            } catch (err) {
                console.error('AI Composition Error:', err);
                setError('Failed to generate track. Please try again.');
                setIsLoading(false);
            }
        };

        compose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trackType, bpm, onTrackGenerated, instrument]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md text-center">
                <h2 className="text-2xl font-bold text-white mb-4">AI Composing...</h2>
                <p className="text-gray-400 mb-6">Your premium AI assistant is crafting a new track.</p>
                
                {isLoading && !error && (
                    <div className="space-y-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-400 mx-auto"></div>
                        <p className="text-indigo-300">{progressMessage}</p>
                    </div>
                )}

                {error && (
                    <div className="text-red-400 bg-red-900/50 p-4 rounded-md">
                        <p className="font-bold">An Error Occurred</p>
                        <p>{error}</p>
                    </div>
                )}
                
                <button 
                    onClick={onClose} 
                    className="mt-8 w-full py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
                    disabled={isLoading}
                >
                    {isLoading ? 'Please wait...' : 'Close'}
                </button>
            </div>
        </div>
    );
};