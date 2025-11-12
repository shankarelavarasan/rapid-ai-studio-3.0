import React, { useCallback } from 'react';
import { Header } from './components/Header';
import { Timeline } from './components/Timeline';
import { ControlPanel } from './components/ControlPanel';
import { TransportControls } from './components/TransportControls';
import { Track, InstrumentType } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { AiComposeModal } from './components/AiComposeModal';
import { AVAILABLE_INSTRUMENTS } from './constants';
import { useHistory } from './hooks/useHistory';

const App: React.FC = () => {
    const { 
        state: tracks, 
        setState: setTracks, 
        undo, 
        redo, 
        canUndo, 
        canRedo 
    } = useHistory<Track[]>([]);
    
    const [bpm, setBpm] = React.useState<number>(120);
    const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
    const [aiTrackType, setAiTrackType] = React.useState<'beat' | 'instrument'>('beat');
    const [aiInstrument, setAiInstrument] = React.useState<InstrumentType>(AVAILABLE_INSTRUMENTS[0]);


    const {
        isPlaying,
        playheadPosition,
        togglePlay,
        stop,
        setPlayheadPosition,
        proactivelyLoadTrackSamples,
        isLoadingSamples,
        playSampleNow
    } = useAudioEngine(tracks, bpm);

    const addTrack = useCallback((newTrack: Omit<Track, 'id'>) => {
        const trackWithId: Track = { ...newTrack, id: `track_${Date.now()}_${Math.random()}` };
        setTracks(prev => [...prev, trackWithId]);
        proactivelyLoadTrackSamples(trackWithId);
    }, [proactivelyLoadTrackSamples, setTracks]);

    const updateTrack = useCallback((updatedTrack: Track) => {
        setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
    }, [setTracks]);
    
    const deleteTrack = useCallback((trackId: string) => {
        setTracks(prev => prev.filter(t => t.id !== trackId));
    }, [setTracks]);

    const reorderTracks = useCallback((dragIndex: number, hoverIndex: number) => {
        setTracks(prevTracks => {
            const newTracks = Array.from(prevTracks);
            const [reorderedItem] = newTracks.splice(dragIndex, 1);
            newTracks.splice(hoverIndex, 0, reorderedItem);
            return newTracks;
        });
    }, [setTracks]);

    const handleAiCompose = (type: 'beat' | 'instrument', instrument?: InstrumentType) => {
        setAiTrackType(type);
        if (type === 'instrument' && instrument) {
            setAiInstrument(instrument);
        }
        setIsAiModalOpen(true);
    };

    const handleAiTrackGenerated = useCallback((newTrack: Omit<Track, 'id'>) => {
        addTrack(newTrack);
        setIsAiModalOpen(false);
    }, [addTrack]);

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-200 font-sans">
            <Header onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
            <main className="flex flex-1 overflow-hidden">
                <div className="flex flex-col flex-1">
                    <Timeline
                        tracks={tracks}
                        playheadPosition={playheadPosition}
                        setPlayheadPosition={setPlayheadPosition}
                        updateTrack={updateTrack}
                        deleteTrack={deleteTrack}
                        bpm={bpm}
                        reorderTracks={reorderTracks}
                    />
                    <TransportControls
                        isPlaying={isPlaying}
                        onPlayPause={togglePlay}
                        onStop={stop}
                        bpm={bpm}
                        setBpm={setBpm}
                    />
                </div>
                <ControlPanel 
                    addTrack={addTrack} 
                    onAiCompose={handleAiCompose} 
                    isLoading={isLoadingSamples} 
                    bpm={bpm}
                    playSampleNow={playSampleNow}
                />
            </main>
            {isAiModalOpen && (
                <AiComposeModal
                    trackType={aiTrackType}
                    instrument={aiInstrument}
                    bpm={bpm}
                    onClose={() => setIsAiModalOpen(false)}
                    onTrackGenerated={handleAiTrackGenerated}
                />
            )}
        </div>
    );
};

export default App;
