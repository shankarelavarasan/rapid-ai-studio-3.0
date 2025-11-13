import { InstrumentType } from './types';

export const AVAILABLE_INSTRUMENTS: InstrumentType[] = [
    InstrumentType.Piano,
    InstrumentType.Guitar,
    InstrumentType.Violin,
    InstrumentType.Flute,
    InstrumentType.Saxophone,
    InstrumentType.Bass,
    InstrumentType.Synth,
    InstrumentType.ElectricGuitar,
];

// Using a mix of reliable CDNs for audio samples.
export const DRUM_SAMPLES: { [key: string]: string } = {
    bass: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_bass-mp3/A1.mp3',
    kick: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3',
    snare: 'https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3',
    hihat: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3',
    fx: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/hand_clap-mp3/C5.mp3'
};

// A multi-octave range of piano notes for the TapPad
export const PIANO_NOTES = [
    'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2',
    'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5',
    'C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6',
];

const generateInstrumentSamples = (instrumentName: string, notes: string[]) => {
    const samples: { [note: string]: string } = {};
    notes.forEach(note => {
        samples[note] = `https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/${instrumentName}-mp3/${note}.mp3`;
    });
    return samples;
};

export const INSTRUMENT_SAMPLES: { [key in InstrumentType]?: { [note: string]: string } } = {
    [InstrumentType.Piano]: generateInstrumentSamples('acoustic_grand_piano', PIANO_NOTES),
    [InstrumentType.Guitar]: generateInstrumentSamples('acoustic_guitar_nylon', PIANO_NOTES),
    [InstrumentType.Violin]: generateInstrumentSamples('violin', PIANO_NOTES),
    [InstrumentType.Flute]: generateInstrumentSamples('flute', PIANO_NOTES),
    [InstrumentType.Saxophone]: generateInstrumentSamples('alto_sax', PIANO_NOTES),
    [InstrumentType.Bass]: generateInstrumentSamples('acoustic_bass', PIANO_NOTES),
    [InstrumentType.Synth]: generateInstrumentSamples('synth_brass_1', PIANO_NOTES),
    [InstrumentType.ElectricGuitar]: generateInstrumentSamples('electric_guitar_clean', PIANO_NOTES),
};