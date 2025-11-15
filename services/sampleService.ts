import { InstrumentType } from '../types';

const TONE_JS_SAMPLES_BASE_URL = 'https://tonejs.github.io/audio/';

// A map of drum sample names to their public URLs
const DRUM_URL_MAP: { [key: string]: string } = {
    'kick': `${TONE_JS_SAMPLES_BASE_URL}drum-samples/CR78/kick.mp3`,
    'snare': `${TONE_JS_SAMPLES_BASE_URL}drum-samples/CR78/snare.mp3`,
    'hihat': `${TONE_JS_SAMPLES_BASE_URL}drum-samples/CR78/hihat.mp3`,
    'clap': `${TONE_JS_SAMPLES_BASE_URL}drum-samples/handclap.mp3`,
    'bass': `${TONE_JS_SAMPLES_BASE_URL}casio/A1.mp3`, // Using a low casio note as a bass synth
};

// Define the range of piano notes to be loaded
const PIANO_NOTES_TO_LOAD = [
    'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2',
    'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5',
    'C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6',
];

// Generate the URL map for the piano samples
const PIANO_URL_MAP: { [key: string]: string } = PIANO_NOTES_TO_LOAD.reduce((acc, note) => {
    acc[note] = `${TONE_JS_SAMPLES_BASE_URL}salamander/${note}.mp3`;
    return acc;
}, {} as { [key: string]: string });


// Export the keys and note names for other parts of the app (UI, AI)
export const DRUM_SAMPLE_KEYS = Object.keys(DRUM_URL_MAP);
export const PIANO_NOTES = PIANO_NOTES_TO_LOAD;

/**
 * Returns a map of all sample names to their public URLs for Tone.js.
 * This is now the definitive source for all audio samples in the app.
 */
export const getSamplesAsUrlMap = (): { [key: string]: string } => {
    return {
        ...DRUM_URL_MAP,
        ...PIANO_URL_MAP,
    };
};

/**
 * Returns the list of playable notes for a given instrument.
 * For now, all melodic instruments will use the piano samples.
 */
export const getPlayableNotesForInstrument = (instrument: InstrumentType): string[] => {
    switch (instrument) {
        case InstrumentType.Piano:
        case InstrumentType.Synth:
        case InstrumentType.ElectricGuitar:
        // This can be expanded with more instrument samples in the future
        default:
            return PIANO_NOTES;
    }
};
