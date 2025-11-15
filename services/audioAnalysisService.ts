import { Event, InstrumentType } from '../types';
import { getPlayableNotesForInstrument } from './sampleService';

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function frequencyToMidi(frequency: number): number {
    if (frequency <= 0) return 0;
    return Math.round(69 + 12 * Math.log2(frequency / 440.0));
}

function midiToNoteName(midi: number): string {
    if (midi <= 0) return '';
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return NOTE_NAMES[noteIndex] + octave;
}

function noteNameToMidi(noteName: string): number {
    const match = noteName.match(/^([A-G]#?)([0-9])$/);
    if (!match) return 0;
    const note = match[1];
    const octave = parseInt(match[2], 10);
    const noteIndex = NOTE_NAMES.indexOf(note);
    if (noteIndex === -1) return 0;
    return (octave + 1) * 12 + noteIndex;
}


// A robust autocorrelation function to find the fundamental frequency.
function getFundamentalFrequency(buffer: Float32Array, sampleRate: number): number {
    const MIN_SAMPLES = 4;
    const MAX_SAMPLES = Math.floor(buffer.length / 2);
    const THRESHOLD = 0.1;
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;

    if (buffer.length < MAX_SAMPLES) return 0;

    for (let i = 0; i < buffer.length; i++) {
        rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);
    if (rms < 0.01) return 0; // Not enough signal

    let lastCorrelation = 1;
    for (let offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
        let correlation = 0;
        for (let i = 0; i < MAX_SAMPLES; i++) {
            correlation += Math.abs(buffer[i] - buffer[i + offset]);
        }
        correlation = 1 - (correlation / MAX_SAMPLES);
        if (correlation > THRESHOLD && correlation > lastCorrelation) {
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        } else if (bestOffset !== -1) {
            return sampleRate / bestOffset;
        }
        lastCorrelation = correlation;
    }
    if (bestCorrelation > 0.01) {
        return sampleRate / bestOffset;
    }
    return 0;
}

// Determines the most likely musical key from a list of notes
function determineKey(notes: string[]): { root: number; isMajor: boolean } {
    if (notes.length < 3) return { root: 0, isMajor: true }; // Default to C Major

    const noteCounts = new Array(12).fill(0);
    notes.forEach(noteName => {
        if (!noteName) return;
        const notePart = noteName.slice(0, -1);
        const noteIndex = NOTE_NAMES.indexOf(notePart);
        if (noteIndex !== -1) {
            noteCounts[noteIndex]++;
        }
    });

    let bestKey = { root: 0, isMajor: true, score: 0 };
    const majorScale = [0, 2, 4, 5, 7, 9, 11];
    const minorScale = [0, 2, 3, 5, 7, 8, 10];

    for (let i = 0; i < 12; i++) {
        let majorScore = 0;
        let minorScore = 0;
        for (let j = 0; j < 12; j++) {
            if (majorScale.includes((j - i + 12) % 12)) majorScore += noteCounts[j];
            if (minorScale.includes((j - i + 12) % 12)) minorScore += noteCounts[j];
        }
        if (majorScore > bestKey.score) bestKey = { root: i, isMajor: true, score: majorScore };
        if (minorScore > bestKey.score) bestKey = { root: i, isMajor: false, score: minorScore };
    }
    return { root: bestKey.root, isMajor: bestKey.isMajor };
}

function snapToKey(midiNote: number, key: { root: number; isMajor: boolean }): number {
    const scale = key.isMajor ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
    const scaleNotesInOctave = scale.map(interval => (key.root + interval) % 12);
    
    const noteInOctave = midiNote % 12;
    let minDistance = Infinity;
    let snappedNoteInOctave = noteInOctave;

    for (const scaleNote of scaleNotesInOctave) {
        let distance = Math.abs(noteInOctave - scaleNote);
        if (distance > 6) distance = 12 - distance; // Handle wrapping
        if (distance < minDistance) {
            minDistance = distance;
            snappedNoteInOctave = scaleNote;
        }
    }
    
    const octave = Math.floor(midiNote / 12);
    return octave * 12 + snappedNoteInOctave;
}

export const transcribeAudioToEvents = async (
    audioBuffer: AudioBuffer,
    bpm: number,
    quantization: number,
    instrument: InstrumentType
): Promise<{ events: Event[], duration: number }> => {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const hopSize = 512;
    const frameSize = 2048;
    const onsets: { time: number; velocity: number }[] = [];
    
    // 1. Onset Detection using RMS energy
    let lastRms = 0;
    for (let i = 0; i + frameSize < channelData.length; i += hopSize) {
        let sum = 0;
        for (let j = 0; j < frameSize; j++) {
            sum += Math.pow(channelData[i + j], 2);
        }
        const rms = Math.sqrt(sum / frameSize);
        const flux = rms - lastRms;
        if (flux > 0.02) { // Onset threshold
            const time = i / sampleRate;
            if (onsets.length === 0 || time - onsets[onsets.length - 1].time > 0.1) {
                onsets.push({ time, velocity: Math.min(1, rms * 10) });
            }
        }
        lastRms = rms;
    }

    if (onsets.length === 0) return { events: [], duration: audioBuffer.duration };
    
    // 2. Pitch Detection at each onset
    const detectedNotes = onsets.map(onset => {
        const startSample = Math.floor(onset.time * sampleRate);
        const slice = channelData.subarray(startSample, startSample + frameSize);
        const freq = getFundamentalFrequency(slice, sampleRate);
        return { onset, freq };
    }).filter(d => d.freq > 0);

    if (detectedNotes.length < 2) return { events: [], duration: audioBuffer.duration };

    // 3. Musical Correction
    const key = determineKey(detectedNotes.map(d => midiToNoteName(frequencyToMidi(d.freq))));
    const playableNotes = getPlayableNotesForInstrument(instrument);
    const playableMidiNotes = playableNotes.map(noteNameToMidi).sort((a,b) => a-b);
    
    const events: Event[] = detectedNotes.map((detected, i) => {
        const nextOnset = onsets[i + 1];
        const duration = nextOnset ? nextOnset.time - detected.onset.time : (60 / bpm) / 2;
        
        const midiNote = frequencyToMidi(detected.freq);
        const snappedMidi = snapToKey(midiNote, key);
        
        // Clamp to the playable range of the instrument
        const closestMidi = playableMidiNotes.reduce((prev, curr) => 
            Math.abs(curr - snappedMidi) < Math.abs(prev - snappedMidi) ? curr : prev
        );
        const finalNote = midiToNoteName(closestMidi);
        
        const beatDuration = 60 / bpm;
        const subdivision = quantization / 4;
        const subdivisionDuration = beatDuration / subdivision;
        const quantizedTime = Math.round(detected.onset.time / subdivisionDuration) * subdivisionDuration;
        
        return {
            id: `event_${Date.now()}_${i}`,
            time: quantizedTime,
            duration: Math.max(subdivisionDuration, duration),
            note: finalNote,
            velocity: detected.onset.velocity,
        };
    });

    const uniqueEvents = new Map<number, Event>();
    for (const event of events) {
        if (!uniqueEvents.has(event.time) || uniqueEvents.get(event.time)!.velocity < event.velocity) {
            uniqueEvents.set(event.time, event);
        }
    }
    
    const finalEvents = Array.from(uniqueEvents.values()).sort((a, b) => a.time - b.time);
    return { events: finalEvents, duration: audioBuffer.duration };
};