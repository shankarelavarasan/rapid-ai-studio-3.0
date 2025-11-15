
import { useState, useRef, useEffect, useCallback } from 'react';
import * as Tone from 'tone';
import { Track, Event, TrackType, InstrumentType } from '../types';
import { getSamplesAsUrlMap } from '../services/sampleService';

const getEventTrackDuration = (track: Track): number => {
    if (track.events.length === 0) {
        return track.duration ?? 4 * (60 / 120); // Default to 2 measures at 120 bpm
    }
    const lastEvent = track.events.reduce((last, event) => (event.time > last.time ? event : last), track.events[0]);
    return Math.max(track.duration ?? 0, lastEvent.time + lastEvent.duration);
};

export const useAudioEngine = (tracks: Track[], bpm: number, playbackRate: number) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playheadPosition, setPlayheadPosition] = useState(0);
    const [isLoadingSamples, setIsLoadingSamples] = useState(true);
    const [initializationError, setInitializationError] = useState<string | null>(null);

    const samplerRef = useRef<Tone.Sampler | null>(null);
    const drumPlayersRef = useRef<Tone.Players | null>(null);
    const audioTrackPlayersRef = useRef<Map<string, Tone.Player>>(new Map());
    const audioTrackPannersRef = useRef<Map<string, Tone.Panner>>(new Map());
    const scheduledEventIds = useRef<Set<number>>(new Set());

    // Initialize Tone.js and load all samples from URLs
    useEffect(() => {
        const initTone = async () => {
            try {
                // await Tone.start(); // REMOVED: This must be called on user interaction to comply with browser autoplay policies.
                setInitializationError(null);
                
                const samplesUrlMap = getSamplesAsUrlMap();
                const pianoSamples: { [note: string]: string } = {};
                const drumSamples: { [note: string]: string } = {};

                Object.entries(samplesUrlMap).forEach(([key, url]) => {
                    if (['kick', 'snare', 'hihat', 'clap', 'bass'].includes(key)) {
                        drumSamples[key] = url;
                    } else {
                        pianoSamples[key] = url;
                    }
                });

                samplerRef.current = new Tone.Sampler({ urls: pianoSamples }).toDestination();
                drumPlayersRef.current = new Tone.Players({ urls: drumSamples }).toDestination();
                
                await Tone.loaded(); // Wait for all samples to be fetched and decoded by Tone.js
                setIsLoadingSamples(false);
            } catch (error) {
                console.error("Failed to initialize audio engine:", error);
                setInitializationError("Error: Could not load audio samples. Please check the network connection and refresh.");
                setIsLoadingSamples(false);
            }
        };

        initTone();

        const animationFrameId = requestAnimationFrame(function updatePlayhead() {
            setPlayheadPosition(Tone.Transport.seconds);
            requestAnimationFrame(updatePlayhead);
        });

        return () => {
            cancelAnimationFrame(animationFrameId);
            Tone.Transport.stop();
            Tone.Transport.cancel();
            samplerRef.current?.dispose();
            drumPlayersRef.current?.dispose();
            audioTrackPlayersRef.current.forEach(player => player.dispose());
            audioTrackPannersRef.current.forEach(panner => panner.dispose());
        };
    }, []);

    // Update transport when tracks or BPM change
    useEffect(() => {
        if (isLoadingSamples || initializationError) return;
        
        Tone.Transport.bpm.value = bpm;

        scheduledEventIds.current.forEach(id => Tone.Transport.clear(id));
        scheduledEventIds.current.clear();
        
        audioTrackPlayersRef.current.forEach(player => player.dispose());
        audioTrackPlayersRef.current.clear();
        audioTrackPannersRef.current.forEach(panner => panner.dispose());
        audioTrackPannersRef.current.clear();

        const soloedTracks = tracks.filter(t => t.isSolo && !t.isMuted);
        const tracksToPlay = soloedTracks.length > 0 ? soloedTracks : tracks.filter(t => !t.isMuted);

        tracksToPlay.forEach(track => {
             if (track.type === TrackType.Audio && track.audioBuffer) {
                const panner = new Tone.Panner(track.pan).toDestination();
                const player = new Tone.Player(track.audioBuffer).connect(panner);
                player.loop = track.isLooped;
                player.volume.value = Tone.gainToDb(track.volume);
                
                audioTrackPannersRef.current.set(track.id, panner);

                const trimDuration = (track.trimEndTime ?? track.duration ?? 0) - (track.trimStartTime ?? 0);
                
                const id = Tone.Transport.schedule(time => {
                    player.start(time, track.trimStartTime, trimDuration);
                }, track.startTime ?? 0);

                scheduledEventIds.current.add(id);
                audioTrackPlayersRef.current.set(track.id, player);

            } else {
                const trackDuration = getEventTrackDuration(track);

                track.events.forEach(event => {
                    const callback = (time: number) => {
                        try {
                            if (track.type === TrackType.Beat && drumPlayersRef.current?.has(event.note!) && event.note) {
                                const player = drumPlayersRef.current.player(event.note);
                                player.volume.value = Tone.gainToDb(event.velocity * track.volume);
                                player.start(time);
                            } else if (track.type === TrackType.Instrument && samplerRef.current && event.note) {
                                samplerRef.current.triggerAttackRelease(event.note, event.duration, time, event.velocity * track.volume);
                            }
                        } catch (e) {
                            console.warn(`Could not play note "${event.note}" for track "${track.name}".`, e);
                        }
                    };

                    if (track.isLooped && trackDuration > 0) {
                        const id = Tone.Transport.scheduleRepeat(callback, trackDuration, event.time);
                        scheduledEventIds.current.add(id);
                    } else {
                        const id = Tone.Transport.schedule(callback, event.time);
                        scheduledEventIds.current.add(id);
                    }
                });
            }
        });
    }, [tracks, bpm, isLoadingSamples, initializationError]);
    
    const togglePlay = useCallback(async () => {
        if (isLoadingSamples || initializationError) return;
        
        await Tone.start(); // Start audio context on first user gesture. It's safe to call multiple times.

        if (Tone.Transport.state === 'started') {
            Tone.Transport.pause();
            setIsPlaying(false);
        } else {
            Tone.Transport.start();
            setIsPlaying(true);
        }
    }, [isLoadingSamples, initializationError]);

    const stop = useCallback(() => {
        Tone.Transport.stop();
        Tone.Transport.seconds = 0;
        setPlayheadPosition(0);
        setIsPlaying(false);
    }, []);

    const manuallySetPlayhead = useCallback((pos: number) => {
        Tone.Transport.seconds = pos;
        setPlayheadPosition(pos);
    }, []);
    
    const playSampleNow = useCallback(async (note: string, velocity: number, type: TrackType, instrument?: InstrumentType) => {
        if (isLoadingSamples || initializationError) return;
        
        await Tone.start(); // Start audio context on first user gesture.

        try {
            if (type === TrackType.Beat && drumPlayersRef.current?.has(note)) {
                const player = drumPlayersRef.current.player(note);
                player.volume.value = Tone.gainToDb(velocity);
                player.start(Tone.now());
            } else if (samplerRef.current) {
                samplerRef.current.triggerAttackRelease(note, '8n', Tone.now(), velocity);
            }
        } catch (e) {
            console.warn(`Could not play sample "${note}" immediately.`, e);
        }
    }, [isLoadingSamples, initializationError]);

    return { 
        isPlaying, 
        playheadPosition, 
        setPlayheadPosition: manuallySetPlayhead, 
        togglePlay, 
        stop, 
        isLoadingSamples, 
        playSampleNow,
        initializationError,
    };
};
