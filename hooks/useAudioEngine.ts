import { useState, useRef, useEffect, useCallback } from 'react';
import { Track, Event, TrackType, InstrumentType } from '../types';
import { DRUM_SAMPLES, INSTRUMENT_SAMPLES } from '../constants';

const LOOKAHEAD_TIME = 0.1; // seconds

const getEventTrackDuration = (track: Track): number => {
    if (track.events.length === 0) {
        return track.duration ?? 0;
    }
    return Math.max(track.duration ?? 0, ...track.events.map(e => e.time + e.duration));
};

export const useAudioEngine = (tracks: Track[], bpm: number) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playheadPosition, setPlayheadPosition] = useState(0);
    const [isLoadingSamples, setIsLoadingSamples] = useState(true);

    const audioContextRef = useRef<AudioContext | null>(null);
    const scheduledSources = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sampleCache = useRef<Map<string, AudioBuffer>>(new Map());
    const nextEventTime = useRef<number>(0);
    const schedulerTimerId = useRef<number | null>(null);
    const playheadTimerId = useRef<number | null>(null);
    const startTime = useRef<number>(0);
    
    const loadSample = useCallback(async (url: string) => {
        if (sampleCache.current.has(url)) {
            return sampleCache.current.get(url);
        }
        if (!audioContextRef.current) return;

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            sampleCache.current.set(url, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error(`Failed to load sample: ${url}`, error);
            return undefined;
        }
    }, []);

    const loadAllSamples = useCallback(async () => {
        setIsLoadingSamples(true);
        const allSampleUrls = new Set<string>();
        Object.values(DRUM_SAMPLES).forEach(url => allSampleUrls.add(url));
        Object.values(INSTRUMENT_SAMPLES).forEach(instrument => {
            if(instrument) Object.values(instrument).forEach(url => allSampleUrls.add(url));
        });
        
        await Promise.all(Array.from(allSampleUrls).map(url => loadSample(url)));
        setIsLoadingSamples(false);
    }, [loadSample]);
    
    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        loadAllSamples();

        return () => {
            audioContextRef.current?.close();
            if (schedulerTimerId.current) cancelAnimationFrame(schedulerTimerId.current);
            if (playheadTimerId.current) cancelAnimationFrame(playheadTimerId.current);
        };
    }, [loadAllSamples]);

    const proactivelyLoadTrackSamples = useCallback(async (track: Track) => {
        if (track.events.length > 0) {
            const sampleUrls = new Set<string>();
            track.events.forEach(event => {
                if (track.type === TrackType.Beat && event.note) {
                    const url = DRUM_SAMPLES[event.note];
                    if (url) sampleUrls.add(url);
                } else if (track.type === TrackType.Instrument && track.instrument && event.note) {
                    const instrumentSamples = INSTRUMENT_SAMPLES[track.instrument];
                    const url = instrumentSamples?.[event.note];
                    if (url) sampleUrls.add(url);
                }
            });
    
            const samplesToLoad = Array.from(sampleUrls).filter(url => !sampleCache.current.has(url));
            if (samplesToLoad.length > 0) {
                await Promise.all(samplesToLoad.map(url => loadSample(url)));
            }
        }
    }, [loadSample]);

    const getSampleForEvent = (event: Event, track: Track): AudioBuffer | undefined => {
        if (track.type === TrackType.Beat && event.note) {
            return sampleCache.current.get(DRUM_SAMPLES[event.note]);
        }
        if (track.type === TrackType.Instrument && track.instrument && event.note) {
            const instrumentSamples = INSTRUMENT_SAMPLES[track.instrument];
            if (instrumentSamples && instrumentSamples[event.note]) {
                return sampleCache.current.get(instrumentSamples[event.note]);
            }
        }
        return undefined;
    };
    
    const playNode = (
        buffer: AudioBuffer, 
        time: number, 
        track: Track, 
        velocity: number,
        offset: number = 0,
        duration?: number
    ) => {
        if (!audioContextRef.current) return;
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.setValueAtTime(velocity * track.volume, time);
        
        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        source.start(time, offset, duration);
        scheduledSources.current.add(source);
        source.onended = () => scheduledSources.current.delete(source);
    };

    const scheduleEvent = (event: Event, track: Track, time: number) => {
        const buffer = getSampleForEvent(event, track);
        if (buffer) {
            playNode(buffer, time, track, event.velocity, 0, event.duration);
        }
    };
    
    const scheduleAudioTrack = (track: Track, time: number) => {
        if (track.audioBuffer) {
            const offset = track.trimStartTime ?? 0;
            const duration = (track.trimEndTime ?? track.duration ?? 0) - offset;
            if (duration > 0) {
                playNode(track.audioBuffer, time, track, 1.0, offset, duration);
            }
        }
    }
    
    const playSampleNow = useCallback((note: string, velocity: number, type: TrackType, instrument?: InstrumentType) => {
        if (!audioContextRef.current) return;
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        let buffer: AudioBuffer | undefined;
        if (type === TrackType.Beat) {
            buffer = sampleCache.current.get(DRUM_SAMPLES[note]);
        } else if (type === TrackType.Instrument && instrument) {
            const instrumentSamples = INSTRUMENT_SAMPLES[instrument];
            if (instrumentSamples && instrumentSamples[note]) {
                buffer = sampleCache.current.get(instrumentSamples[note]);
            }
        }

        if (buffer) {
            playNode(buffer, audioContextRef.current.currentTime, { volume: 1 } as Track, velocity);
        }
    }, []);
    
    const scheduler = useCallback(() => {
        if (!isPlaying || !audioContextRef.current) {
            return;
        }

        const currentTime = audioContextRef.current.currentTime;
        const scheduleUntil = currentTime + LOOKAHEAD_TIME;

        // --- Professional Solo/Mute Logic ---
        const soloedTracks = tracks.filter(t => t.isSolo && !t.isMuted);
        const tracksToPlay = soloedTracks.length > 0 ? soloedTracks : tracks.filter(t => !t.isMuted);

        while (nextEventTime.current < scheduleUntil) {
            tracksToPlay.forEach(track => {
                if(track.type === TrackType.Audio && track.audioBuffer) {
                    const clipStartTimeOnTimeline = track.startTime ?? 0;
                    const trimStart = track.trimStartTime ?? 0;
                    const trimEnd = track.trimEndTime ?? track.duration ?? 0;
                    const clipDuration = trimEnd - trimStart;
                    const playbackStartTime = startTime.current;

                    if (track.isLooped && clipDuration > 0) {
                        const timeSincePlaybackStart = nextEventTime.current - playbackStartTime;
                        if (timeSincePlaybackStart >= clipStartTimeOnTimeline) {
                           const timeIntoLoopedSection = timeSincePlaybackStart - clipStartTimeOnTimeline;
                           const loopCount = Math.floor(timeIntoLoopedSection / clipDuration);
                           const eventAbsTime = playbackStartTime + clipStartTimeOnTimeline + (loopCount * clipDuration);

                           if(eventAbsTime >= nextEventTime.current) {
                              scheduleAudioTrack(track, eventAbsTime);
                           }
                        }
                    } else {
                        const eventTime = playbackStartTime + clipStartTimeOnTimeline;
                         if (eventTime >= nextEventTime.current) {
                            scheduleAudioTrack(track, eventTime);
                        }
                    }
                } else { // Event-based tracks
                    const trackDuration = getEventTrackDuration(track);
                    track.events.forEach(event => {
                        const playbackStartTime = startTime.current;
                        if (track.isLooped && trackDuration > 0) {
                            const timeSincePlaybackStart = nextEventTime.current - playbackStartTime;
                            const loopCount = Math.max(0, Math.floor(timeSincePlaybackStart / trackDuration));
                            const eventTimeInLoop = event.time + (loopCount * trackDuration);
                            const eventAbsTime = playbackStartTime + eventTimeInLoop;
    
                            if (eventAbsTime >= nextEventTime.current) {
                                scheduleEvent(event, track, eventAbsTime);
                            }
                        } else {
                            const eventTime = playbackStartTime + event.time;
                            if (eventTime >= nextEventTime.current) {
                                scheduleEvent(event, track, eventTime);
                            }
                        }
                    });
                }
            });
            nextEventTime.current += (scheduleUntil - nextEventTime.current) / 2; // Advance time
        }
        
        schedulerTimerId.current = requestAnimationFrame(scheduler);

    }, [isPlaying, tracks]);

    const updatePlayhead = useCallback(() => {
        if (!isPlaying || !audioContextRef.current) return;
        const newPlayheadPosition = audioContextRef.current.currentTime - startTime.current;
        setPlayheadPosition(newPlayheadPosition);
        playheadTimerId.current = requestAnimationFrame(updatePlayhead);
    }, [isPlaying]);

    const start = useCallback(() => {
        if (!audioContextRef.current) return;
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        setIsPlaying(true);
        startTime.current = audioContextRef.current.currentTime - playheadPosition;
        nextEventTime.current = audioContextRef.current.currentTime;
        
        if (schedulerTimerId.current) cancelAnimationFrame(schedulerTimerId.current);
        schedulerTimerId.current = requestAnimationFrame(scheduler);
        
        if(playheadTimerId.current) cancelAnimationFrame(playheadTimerId.current);
        playheadTimerId.current = requestAnimationFrame(updatePlayhead);
    }, [playheadPosition, scheduler, updatePlayhead]);
    
    const stopAllSources = () => {
        scheduledSources.current.forEach(source => {
            try {
              source.stop();
              source.disconnect();
            } catch(e) {
                // Ignore errors from stopping already-stopped sources
            }
        });
        scheduledSources.current.clear();
    };

    const stop = useCallback(() => {
        setIsPlaying(false);
        stopAllSources();
        if (schedulerTimerId.current) {
            cancelAnimationFrame(schedulerTimerId.current);
            schedulerTimerId.current = null;
        }
        if (playheadTimerId.current) {
            cancelAnimationFrame(playheadTimerId.current);
            playheadTimerId.current = null;
        }
        setPlayheadPosition(0);
    }, []);

    const pause = () => {
        setIsPlaying(false);
        stopAllSources();
        if (schedulerTimerId.current) cancelAnimationFrame(schedulerTimerId.current);
        if (playheadTimerId.current) cancelAnimationFrame(playheadTimerId.current);
    };

    const togglePlay = () => {
        if (isPlaying) {
            pause();
        } else {
            start();
        }
    };

    return { isPlaying, playheadPosition, setPlayheadPosition, togglePlay, stop, proactivelyLoadTrackSamples, isLoadingSamples, playSampleNow };
};