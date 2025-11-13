import React, { useState, useRef } from 'react';
import { InstrumentType, Track, TrackType } from '../types';
import { AVAILABLE_INSTRUMENTS } from '../constants';
import { TapPad } from './TapPad';
import { analyzeAudioToEvents } from '../services/audioAnalysisService';

interface ControlPanelProps {
    addTrack: (track: Omit<Track, 'id'>) => void;
    onAiCompose: (type: 'beat' | 'instrument', instrument?: InstrumentType) => void;
    isLoading: boolean;
    bpm: number;
    playSampleNow: (note: string, velocity: number, type: TrackType, instrument?: InstrumentType) => void;
}

const UploadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>);
const TapIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1.065a3.501 3.501 0 01-3.35 2.834V15.5a1.5 1.5 0 01-3 0v-2.166A3.501 3.501 0 016.065 10H5a1 1 0 01-1-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" /></svg>);
const SparklesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0V6h-1a1 1 0 110-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" /></svg>);

export const ControlPanel: React.FC<ControlPanelProps> = ({ addTrack, onAiCompose, isLoading, bpm, playSampleNow }) => {
    const [mode, setMode] = useState<'beat' | 'instrument'>('beat');
    const [subMode, setSubMode] = useState<'tap' | 'upload'>('tap');
    const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>(AVAILABLE_INSTRUMENTS[0]);
    const [quantization, setQuantization] = useState(16);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (mode === 'instrument' && subMode === 'upload') {
            setIsAnalyzing(true);
            try {
                const events = await analyzeAudioToEvents(audioBuffer, bpm, quantization);
                if (events.length === 0) {
                    alert("Could not detect any notes in the audio file. Please try a clearer recording.");
                    return;
                }
                const newTrack: Omit<Track, 'id'> = {
                    name: `${selectedInstrument} from ${file.name}`,
                    type: TrackType.Instrument,
                    instrument: selectedInstrument,
                    events: events,
                    volume: 1,
                    pan: 0,
                    isMuted: false,
                    isSolo: false,
                    isLooped: false,
                };
                addTrack(newTrack);
            } catch (err) {
                console.error("Audio analysis error:", err);
                alert("Failed to analyze audio. Please ensure it's a clear, monophonic recording.");
            } finally {
                setIsAnalyzing(false);
            }
        } else {
             const newTrack: Omit<Track, 'id'> = {
                name: file.name,
                type: TrackType.Audio,
                events: [],
                volume: 1,
                pan: 0,
                isMuted: false,
                isSolo: false,
                isLooped: false,
                audioBuffer: audioBuffer,
                startTime: 0,
                duration: audioBuffer.duration,
                trimStartTime: 0,
                trimEndTime: audioBuffer.duration,
            };
            addTrack(newTrack);
        }
       
        // Reset file input
        event.target.value = '';
    };

    if (isLoading) {
        return (
            <div className="w-80 bg-gray-800 p-4 border-l border-gray-700 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Loading Samples...</p>
                </div>
            </div>
        );
    }

    return (
        <aside className="w-80 bg-gray-800 p-4 border-l border-gray-700 flex flex-col space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode('beat')} className={`py-3 text-center font-bold rounded-lg transition-all ${mode === 'beat' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>BEAT</button>
                <button onClick={() => setMode('instrument')} className={`py-3 text-center font-bold rounded-lg transition-all ${mode === 'instrument' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>INSTRUMENT</button>
            </div>

            {mode === 'instrument' && (
                <div className="flex flex-col">
                    <label htmlFor="instrument-select" className="text-sm font-medium text-gray-400 mb-1">Instrument</label>
                    <select
                        id="instrument-select"
                        value={selectedInstrument}
                        onChange={(e) => setSelectedInstrument(e.target.value as InstrumentType)}
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5"
                    >
                        {AVAILABLE_INSTRUMENTS.map(inst => <option key={inst} value={inst}>{inst}</option>)}
                    </select>
                </div>
            )}
            
            <div className="bg-gray-900/50 p-3 rounded-lg flex-grow flex flex-col">
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button onClick={() => setSubMode('tap')} className={`flex items-center justify-center py-2 text-sm rounded-md transition-colors ${subMode === 'tap' ? 'bg-gray-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}><TapIcon /> Manual Tap</button>
                    <button onClick={() => setSubMode('upload')} className={`flex items-center justify-center py-2 text-sm rounded-md transition-colors ${subMode === 'upload' ? 'bg-gray-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}><UploadIcon /> Record/Upload</button>
                </div>

                {subMode === 'tap' && (
                     <div className="flex flex-col mb-2">
                        <label className="text-sm font-medium text-gray-400 mb-1">Quantize</label>
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-700 p-1">
                            {[8, 16, 32].map(q => (
                                <button
                                    key={q}
                                    onClick={() => setQuantization(q)}
                                    className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        quantization === q
                                            ? 'bg-indigo-500 text-white shadow-sm'
                                            : 'bg-transparent text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    1/{q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-grow">
                    {subMode === 'tap' ? (
                        <TapPad 
                            addTrack={addTrack} 
                            trackType={mode === 'beat' ? TrackType.Beat : TrackType.Instrument}
                            instrument={mode === 'instrument' ? selectedInstrument : InstrumentType.Drums}
                            bpm={bpm}
                            quantization={quantization}
                            playSampleNow={playSampleNow}
                        />
                    ) : (
                        <div 
                            className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-600 rounded-lg p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
                            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                        >
                             {isAnalyzing ? (
                                <>
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
                                    <p className="mt-3 text-sm text-gray-400">Analyzing Audio...</p>
                                </>
                             ) : (
                                <>
                                    <UploadIcon />
                                    <p className="mt-2 text-sm text-gray-400 text-center">
                                        {mode === 'instrument' 
                                            ? `Upload vocal or instrument melody to convert to ${selectedInstrument}`
                                            : 'Upload audio file (MP3, WAV)'
                                        }
                                    </p>
                                </>
                             )}
                             <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".mp3,.wav,.aiff"
                                onChange={handleFileUpload}
                                disabled={isAnalyzing}
                             />
                        </div>
                    )}
                </div>
            </div>

            <button onClick={() => onAiCompose(mode, selectedInstrument)} className="w-full flex items-center justify-center py-3 font-bold rounded-lg transition-all bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white shadow-lg">
                <SparklesIcon /> AI Compose (Pro)
            </button>
        </aside>
    );
};