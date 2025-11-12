import React, { useState } from 'react';
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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const aiResponse = await generateAiTrack(trackType, bpm, instrument);

            const newTrack: Omit<Track, 'id'> = {
                name: `AI ${instrument}`,
                type: trackType === 'beat' ? TrackType.Beat : TrackType.Instrument,
                instrument: trackType === 'beat' ? InstrumentType.Drums : instrument,
                events: aiResponse.events,
                volume: 1,
                pan: 0,
                isMuted: false,
                isSolo: false,
                isLooped: true, // AI tracks loop by default
            };
            onTrackGenerated(newTrack);
        } catch (err) {
            console.error('AI Composition Error:', err);
            setError('Failed to generate track. The AI may be unavailable. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md text-left">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">AI Composition</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <p className="text-gray-400 mb-6">
                    The AI will generate a unique, professional {trackType} track for you at {bpm} BPM.
                </p>

                {error && (
                    <div className="text-red-400 bg-red-900/50 p-3 rounded-md mb-4 text-sm">
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex justify-end space-x-4">
                     <button
                        onClick={onClose}
                        className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="py-2 px-6 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Generating...
                            </>
                        ) : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
};
