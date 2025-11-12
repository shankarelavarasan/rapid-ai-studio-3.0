export enum InstrumentType {
    Violin = 'Violin',
    Guitar = 'Guitar',
    Piano = 'Piano',
    Flute = 'Flute',
    Saxophone = 'Saxophone',
    Bass = 'Bass',
    Synth = 'Synth',
    ElectricGuitar = 'Electric Guitar',
    Drums = 'Drums'
}

export enum TrackType {
    Main = 'main',
    Beat = 'beat',
    Instrument = 'instrument',
    Audio = 'audio',
}

export interface Event {
    id: string;
    time: number; // in seconds from track start
    duration: number; // in seconds
    note?: string; // e.g., "C4", for instruments
    velocity: number; // 0 to 1
}

export interface Track {
    id: string;
    name: string;
    type: TrackType;
    instrument?: InstrumentType;
    events: Event[];
    volume: number; // 0 to 1
    pan: number; // -1 (left) to 1 (right)
    isMuted: boolean;
    isSolo: boolean;
    isLooped: boolean;
    // For uploaded audio files
    audioBuffer?: AudioBuffer;
    filePath?: string;
    startTime?: number; // The start time of the entire audio clip on the timeline
    duration?: number; // The duration of the original audio file
    trimStartTime?: number; // The start point of the trimmed clip, relative to the start of the audioBuffer
    trimEndTime?: number; // The end point of the trimmed clip, relative to the start of the audioBuffer
}