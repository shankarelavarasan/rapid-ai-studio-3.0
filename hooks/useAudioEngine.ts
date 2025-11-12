import { useState, useRef, useEffect, useCallback } from 'react';
import { Track, Event, TrackType, InstrumentType } from '../types';
import { DRUM_SAMPLES, INSTRUMENT_SAMPLES } from '../constants';

const LOOKAHEAD_TIME = 0.1; // seconds
const SCHEDULE_INTERVAL = 25; // ms

const getEventTrackDuration = (track: Track): number => {
    if (track.events.length === 0) {
        return 0;
    }
    return Math.max(...track.events.map(e => e.time + e.duration));
};

export const useAudioEngine = (tracks: Track[], bpm: number) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playheadPosition, setPlayheadPosition] = useState(0);
    const [isLoadingSamples, setIsLoadingSamples] = useState(true);

    const audioContextRef = useRef<AudioContext | null>(null);
    const scheduledSources = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sampleCache = useRef<Map<string, AudioBuffer>>(new Map());
    const nextEventTime = useRef<number>(0);
    const schedulerTimer = useRef<number | null>(null);
    const playheadTimer = useRef<number | null>(null);
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
            if (schedulerTimer.current) clearInterval(schedulerTimer.current);
            if (playheadTimer.current) cancelAnimationFrame(playheadTimer.current);
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
    
    const scheduleEvents = useCallback(() => {
        if (!audioContextRef.current) return;
        
        const currentTime = audioContextRef.current.currentTime;
        const scheduleUntil = currentTime + LOOKAHEAD_TIME;

        while (nextEventTime.current < scheduleUntil) {
            tracks.forEach(track => {
                if (track.isMuted) return;

                if(track.type === TrackType.Audio && track.audioBuffer) {
                    const clipStartTimeOnTimeline = track.startTime ?? 0;
                    const trimStart = track.trimStartTime ?? 0;
                    const trimEnd = track.trimEndTime ?? track.duration ?? 0;
                    const clipDuration = trimEnd - trimStart;

                    if (track.isLooped && clipDuration > 0) {
                        const timeSincePlaybackStart = nextEventTime.current - startTime.current;
                        if (timeSincePlaybackStart >= clipStartTimeOnTimeline) {
                           const timeIntoLoopedSection = timeSincePlaybackStart - clipStartTimeOnTimeline;
                           const loopCount = Math.floor(timeIntoLoopedSection / clipDuration);
                           const eventAbsTime = startTime.current + clipStartTimeOnTimeline + (loopCount * clipDuration);

                           if(eventAbsTime >= nextEventTime.current && eventAbsTime < scheduleUntil) {
                              scheduleAudioTrack(track, eventAbsTime);
                           }
                        }
                    } else {
                        const eventTime = startTime.current + clipStartTimeOnTimeline;
                         if (eventTime >= nextEventTime.current && eventTime < scheduleUntil) {
                            scheduleAudioTrack(track, eventTime);
                        }
                    }
                } else { // Event-based tracks
                    const trackDuration = track.isLooped ? getEventTrackDuration(track) : 0;
                    track.events.forEach(event => {
                        if (track.isLooped && trackDuration > 0) {
                            const timeSincePlaybackStart = nextEventTime.current - startTime.current;
                            const loopCount = Math.max(0, Math.floor(timeSincePlaybackStart / trackDuration));
                            const eventTimeInLoop = event.time + (loopCount * trackDuration);
                            const eventAbsTime = startTime.current + eventTimeInLoop;
    
                            if (eventAbsTime >= nextEventTime.current && eventAbsTime < scheduleUntil) {
                                scheduleEvent(event, track, eventAbsTime);
                            }
                        } else {
                            const eventTime = startTime.current + event.time;
                            if (eventTime >= nextEventTime.current && eventTime < scheduleUntil) {
                                scheduleEvent(event, track, eventTime);
                            }
                        }
                    });
                }
            });
            nextEventTime.current += 0.01;
        }
    }, [tracks]);

    const updatePlayhead = useCallback(() => {
        if (!isPlaying || !audioContextRef.current) return;
        const newPlayheadPosition = audioContextRef.current.currentTime - startTime.current;
        setPlayheadPosition(newPlayheadPosition);
        playheadTimer.current = requestAnimationFrame(updatePlayhead);
    }, [isPlaying]);

    const start = useCallback(() => {
        if (!audioContextRef.current) return;
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        setIsPlaying(true);
        startTime.current = audioContextRef.current.currentTime - playheadPosition;
        nextEventTime.current = audioContextRef.current.currentTime;
        
        if(schedulerTimer.current) clearInterval(schedulerTimer.current);
        scheduleEvents();
        schedulerTimer.current = window.setInterval(() => scheduleEvents(), SCHEDULE_INTERVAL);
        
        if(playheadTimer.current) cancelAnimationFrame(playheadTimer.current);
        playheadTimer.current = requestAnimationFrame(updatePlayhead);
    }, [playheadPosition, scheduleEvents, updatePlayhead]);
    
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
        if (schedulerTimer.current) {
            clearInterval(schedulerTimer.current);
            schedulerTimer.current = null;
        }
        if (playheadTimer.current) {
            cancelAnimationFrame(playheadTimer.current);
            playheadTimer.current = null;
        }
        setPlayheadPosition(0);
    }, []);

    const pause = () => {
        setIsPlaying(false);
        stopAllSources();
        if (schedulerTimer.current) clearInterval(schedulerTimer.current);
        if (playheadTimer.current) cancelAnimationFrame(playheadTimer.current);
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