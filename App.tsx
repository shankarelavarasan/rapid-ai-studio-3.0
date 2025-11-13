import React, { useCallback, useState } from 'react';
import { Header } from './components/Header';
import { Timeline } from './components/Timeline';
import { ControlPanel } from './components/ControlPanel';
import { TransportControls } from './components/TransportControls';
import { Track, InstrumentType, Event, TrackType } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { AiComposeModal } from './components/AiComposeModal';
import { AVAILABLE_INSTRUMENTS } from './constants';
import { useHistory } from './hooks/useHistory';
import { ContextMenu, ContextMenuItem } from './components/ContextMenu';

type SelectedClip = {
    trackId: string;
    eventId?: string; // For event-based clips
};

type ClipboardItem = 
    | { type: 'event'; event: Event; originalInstrument?: InstrumentType }
    | { type: 'audio'; track: Track };


const App: React.FC = () => {
    const { 
        state: tracks, 
        setState: setTracks, 
        undo, 
        redo, 
        canUndo, 
        canRedo 
    } = useHistory<Track[]>([]);
    
    const [bpm, setBpm] = useState<number>(120);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiTrackType, setAiTrackType] = useState<'beat' | 'instrument'>('beat');
    const [aiInstrument, setAiInstrument] = useState<InstrumentType>(AVAILABLE_INSTRUMENTS[0]);
    const [selectedClip, setSelectedClip] = useState<SelectedClip | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
    const [clipboardItem, setClipboardItem] = useState<ClipboardItem | null>(null);

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

    const closeContextMenu = () => setContextMenu(null);

    const handleCopy = useCallback(() => {
        if (!selectedClip) return;
        const track = tracks.find(t => t.id === selectedClip.trackId);
        if (!track) return;

        if (track.type === TrackType.Audio) {
            setClipboardItem({ type: 'audio', track });
        } else if (selectedClip.eventId) {
            const event = track.events.find(e => e.id === selectedClip.eventId);
            if (event) {
                setClipboardItem({ type: 'event', event, originalInstrument: track.instrument });
            }
        }
        closeContextMenu();
    }, [selectedClip, tracks]);

    const handleCut = useCallback(() => {
        if (!selectedClip) return;
        handleCopy(); // First, copy the item to the clipboard
        
        const { trackId, eventId } = selectedClip;
        if (eventId) { // It's an event
            setTracks(prev => prev.map(t => {
                if (t.id === trackId) {
                    return { ...t, events: t.events.filter(e => e.id !== eventId) };
                }
                return t;
            }));
        } else { // It's a whole audio track
            deleteTrack(trackId);
        }
        setSelectedClip(null);
    }, [selectedClip, handleCopy, setTracks, deleteTrack]);

    const handlePaste = useCallback((trackId: string, time: number) => {
        if (!clipboardItem) return;

        if (clipboardItem.type === 'event') {
            setTracks(prev => prev.map(track => {
                if (track.id !== trackId) return track;
                 // Only paste into compatible tracks
                if (track.type !== TrackType.Instrument && track.type !== TrackType.Beat) return track;
                
                const newEvent: Event = {
                    ...clipboardItem.event,
                    id: `event_${Date.now()}_${Math.random()}`,
                    time: time,
                };
                return { ...track, events: [...track.events, newEvent] };
            }));
        } else if (clipboardItem.type === 'audio') {
            const newTrack: Omit<Track, 'id'> = {
                ...clipboardItem.track,
                id: '', // id will be generated by addTrack
                startTime: time,
            };
            addTrack(newTrack);
        }

        closeContextMenu();
    }, [clipboardItem, setTracks, addTrack]);

    const handleTrim = useCallback(async (trackId: string) => {
        const track = tracks.find(t => t.id === trackId);
        if (!track || !track.audioBuffer || track.trimStartTime === undefined || track.trimEndTime === undefined) return;

        const { audioBuffer, trimStartTime, trimEndTime } = track;
        const trimDuration = trimEndTime - trimStartTime;
        if (trimDuration <= 0) return;

        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            trimDuration * audioBuffer.sampleRate,
            audioBuffer.sampleRate
        );

        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(0, trimStartTime, trimDuration);

        const newBuffer = await offlineCtx.startRendering();

        const updatedTrack: Track = {
            ...track,
            audioBuffer: newBuffer,
            duration: newBuffer.duration,
            trimStartTime: 0,
            trimEndTime: newBuffer.duration,
        };
        updateTrack(updatedTrack);
        closeContextMenu();

    }, [tracks, updateTrack]);


    const handleTimelineRightClick = useCallback((e: React.MouseEvent, trackId: string, time: number, eventId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        const track = tracks.find(t => t.id === trackId);
        if (!track) return;

        const isClipClick = eventId || track.type === 'audio';
        
        if (isClipClick) {
             if (selectedClip?.trackId !== trackId || selectedClip?.eventId !== eventId) {
                setSelectedClip({ trackId, eventId });
             }
             const items: ContextMenuItem[] = [
                 { label: 'Copy', onClick: handleCopy },
                 { label: 'Cut', onClick: handleCut },
             ];
             if (track.type === 'audio') {
                 items.push({ label: 'Trim to Selection', onClick: () => handleTrim(trackId) });
             }
             setContextMenu({ x: e.clientX, y: e.clientY, items });
        } else { // Clicked on empty track space
            if (clipboardItem) {
                // Check for compatibility
                let canPaste = false;
                if (clipboardItem.type === 'event' && (track.type === TrackType.Instrument || track.type === TrackType.Beat)) {
                    canPaste = true;
                } else if (clipboardItem.type === 'audio') {
                    // Pasting audio always creates a new track, so it's always possible on the timeline itself
                    // We handle this by adding to a new track, not a specific one, but for UI let's show it.
                    canPaste = true; 
                }

                if(canPaste) {
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [{ label: 'Paste', onClick: () => handlePaste(trackId, time) }]
                    });
                }
            } else {
                setContextMenu(null);
            }
        }
    }, [handleCopy, handleCut, handlePaste, handleTrim, selectedClip, tracks, clipboardItem]);

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-200 font-sans" onClick={() => { closeContextMenu(); setSelectedClip(null); }}>
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
                        selectedClip={selectedClip}
                        setSelectedClip={setSelectedClip}
                        onTimelineRightClick={handleTimelineRightClick}
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
            {contextMenu && <ContextMenu {...contextMenu} onClose={closeContextMenu} />}
        </div>
    );
};

export default App;