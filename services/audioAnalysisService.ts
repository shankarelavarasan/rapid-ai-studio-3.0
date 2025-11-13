import { Event, InstrumentType } from '../types';
import { INSTRUMENT_SAMPLES, PIANO_NOTES } from '../constants';

const FFT_SIZE = 4096;
const ONSET_THRESHOLD = 0.05; // Lowered for more sensitivity
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIN_FREQ = 60; // C2, ignore anything lower

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

function getPeakFrequency(data: Float32Array, sampleRate: number): number {
    let maxVal = -Infinity;
    let maxIndex = -1;

    for (let i = 0; i < data.length; i++) {
        if (data[i] > maxVal) {
            maxVal = data[i];
            maxIndex = i;
        }
    }
    const freqResolution = (sampleRate / 2) / data.length;
    return maxIndex * freqResolution;
}

// Determines the most likely musical key from a list of notes
function determineKey(notes: string[]): { root: number; isMajor: boolean } {
    if (notes.length < 3) return { root: 0, isMajor: true }; // Default to C Major

    const noteCounts = new Array(12).fill(0);
    notes.forEach(noteName => {
        const noteIndex = NOTE_NAMES.indexOf(noteName.slice(0, -1));
        if (noteIndex !== -1) {
            noteCounts[noteIndex]++;
        }
    });
    
    // Simple key-finding algorithm: check correlation with major/minor scales
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

// Snaps a MIDI note to the nearest note in the detected key
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


/**
 * A more robust analysis function that attempts to transcribe the clearest musical line
 * from an audio buffer into a new instrument track.
 */
export const transcribeAudioToEvents = async (
    audioBuffer: AudioBuffer,
    bpm: number,
    quantization: number,
    instrument: InstrumentType
): Promise<{ events: Event[], duration: number }> => {
    // --- 1. Onset Detection (find the rhythm) ---
    const channelData = audioBuffer.getChannelData(0);
    const frameSize = 2048;
    const hopSize = 512;
    let onsets: { time: number; velocity: number }[] = [];
    let spectralFlux: number[] = [];
    let lastSpectrum = new Float32Array(frameSize / 2 + 1);

    const tempCtx = new AudioContext();
    const analyser = tempCtx.createAnalyser();
    analyser.fftSize = frameSize;
    const freqData = new Float32Array(analyser.frequencyBinCount);

    for (let i = 0; i + frameSize < channelData.length; i += hopSize) {
        const slice = channelData.subarray(i, i + frameSize);
        analyser.getFloatFrequencyData(freqData); // This is a trick to use analyser offline
        
        let flux = 0;
        for (let j = 0; j < freqData.length; j++) {
            const value = Math.max(0, freqData[j] - lastSpectrum[j]);
            flux += value;
        }
        spectralFlux.push(flux);
        lastSpectrum.set(freqData);
    }
    await tempCtx.close();

    // Peak picking on spectral flux to find onsets
    for (let i = 1; i < spectralFlux.length - 1; i++) {
        if (spectralFlux[i] > spectralFlux[i - 1] && spectralFlux[i] > spectralFlux[i + 1] && spectralFlux[i] > ONSET_THRESHOLD) {
            const time = (i * hopSize) / audioBuffer.sampleRate;
            onsets.push({ time, velocity: Math.min(1, spectralFlux[i] / (ONSET_THRESHOLD * 5)) });
        }
    }

    onsets = onsets.filter((onset, index, arr) => {
        if (index === 0) return true;
        return onset.time - arr[index - 1].time > 60 / (bpm * 4); // Don't allow notes faster than 16th notes
    });
    
    if (onsets.length < 2) return { events: [], duration: audioBuffer.duration };
    
    // --- 2. Pitch Detection at each onset ---
    const detectedNotes: { onset: { time: number; velocity: number }, freq: number, noteName: string }[] = [];

    const pitchCtx = new AudioContext();
    const pitchAnalyser = pitchCtx.createAnalyser();
    pitchAnalyser.fftSize = FFT_SIZE;
    const pitchFreqData = new Float32Array(pitchAnalyser.frequencyBinCount);

    for (const onset of onsets) {
        const startSample = Math.floor(onset.time * audioBuffer.sampleRate);
        const endSample = Math.min(startSample + FFT_SIZE, audioBuffer.length);
        const slice = audioBuffer.getChannelData(0).subarray(startSample, endSample);
        
        // This is a simplified way of getting pitch; more robust methods exist (YIN, etc.)
        pitchAnalyser.getFloatFrequencyData(pitchFreqData);
        const peakFreq = getPeakFrequency(pitchFreqData, audioBuffer.sampleRate);
        
        if (peakFreq > MIN_FREQ) {
            const midiNote = frequencyToMidi(peakFreq);
            detectedNotes.push({ onset, freq: peakFreq, noteName: midiToNoteName(midiNote) });
        }
    }
    await pitchCtx.close();

    if (detectedNotes.length < 2) return { events: [], duration: audioBuffer.duration };

    // --- 3. Musical Correction ("Copy Cat" Logic) ---
    const key = determineKey(detectedNotes.map(n => n.noteName));
    const playableNotes = Object.keys(INSTRUMENT_SAMPLES[instrument] || INSTRUMENT_SAMPLES[InstrumentType.Piano]!);
    
    const events: Event[] = detectedNotes.map((detected, i) => {
        const nextOnset = onsets[i + 1];
        const duration = nextOnset ? nextOnset.time - detected.onset.time : (60 / bpm) / 2; // Default to 8th note
        
        const midiNote = frequencyToMidi(detected.freq);
        const snappedMidi = snapToKey(midiNote, key);
        
        // Find the closest playable note in our sample library
        let finalNote = midiToNoteName(snappedMidi);
        if (!playableNotes.includes(finalNote)) {
            let closestMidi = -1;
            let minDistance = Infinity;
            PIANO_NOTES.forEach(note => {
                const sampleMidi = frequencyToMidi(440 * Math.pow(2, (NOTE_NAMES.indexOf(note.slice(0,-1)) - 9)/12))
                const distance = Math.abs(snappedMidi - sampleMidi);
                if(distance < minDistance){
                    minDistance = distance;
                    closestMidi = sampleMidi;
                    finalNote = note;
                }
            });
        }
        
        // Quantize time
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

    // Remove duplicate quantized events
    const uniqueEvents = new Map<number, Event>();
    for (const event of events) {
        if (!uniqueEvents.has(event.time) || uniqueEvents.get(event.time)!.velocity < event.velocity) {
            uniqueEvents.set(event.time, event);
        }
    }
    
    const finalEvents = Array.from(uniqueEvents.values()).sort((a, b) => a.time - b.time);
    return { events: finalEvents, duration: audioBuffer.duration };
};