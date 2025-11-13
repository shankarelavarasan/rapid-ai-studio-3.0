import { Event } from '../types';

const FFT_SIZE = 2048;
const ONSET_THRESHOLD = 0.1; // Adjust this sensitivity for onset detection
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Converts a frequency in Hz to a MIDI note number.
 */
function frequencyToMidi(frequency: number): number {
    if (frequency <= 0) return 0;
    return Math.round(69 + 12 * Math.log2(frequency / 440.0));
}

/**
 * Converts a MIDI note number to its note name (e.g., "C4").
 */
function midiToNoteName(midi: number): string {
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return NOTE_NAMES[noteIndex] + octave;
}

/**
 * Finds the frequency with the highest magnitude from FFT data.
 */
function getPeakFrequency(data: Float32Array, sampleRate: number): number {
    let maxVal = -Infinity;
    let maxIndex = -1;

    for (let i = 0; i < data.length; i++) {
        if (data[i] > maxVal) {
            maxVal = data[i];
            maxIndex = i;
        }
    }
    // The frequency is the index times the frequency resolution (sampleRate/fftSize).
    // The AnalyserNode gives us frequencyBinCount which is fftSize/2.
    // So the frequency resolution is (sampleRate/2) / frequencyBinCount.
    return maxIndex * (sampleRate / 2) / data.length;
}

/**
 * A simplified pitch detection for a slice of audio data.
 * In a real-world app, a more robust library (e.g., WASM-based) would be used.
 */
async function detectPitch(audioSlice: AudioBuffer): Promise<number> {
    // We must use a real AudioContext to get AnalyserNode to process data.
    const tempCtx = new AudioContext();
    const source = tempCtx.createBufferSource();
    source.buffer = audioSlice;

    const analyser = tempCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    const freqData = new Float32Array(analyser.frequencyBinCount);

    source.connect(analyser);
    source.start(0);

    return new Promise((resolve) => {
        // Give it a moment to process. This is a hacky part of using AnalyserNode offline.
        setTimeout(() => {
            analyser.getFloatFrequencyData(freqData);
            const peakFreq = getPeakFrequency(freqData, tempCtx.sampleRate);
            tempCtx.close(); // Clean up the temporary context
            resolve(peakFreq);
        }, 50); // 50ms should be enough for a small slice
    });
}


/**
 * Analyzes an AudioBuffer to detect note onsets and their corresponding pitches.
 * @param audioBuffer The audio data to analyze.
 * @param bpm The project's beats per minute for quantization.
 * @param quantization The quantization subdivision (e.g., 16 for 16th notes).
 * @returns A promise that resolves to an array of detected musical events.
 */
export const analyzeAudioToEvents = async (
    audioBuffer: AudioBuffer,
    bpm: number,
    quantization: number
): Promise<Event[]> => {

    // --- 1. Onset Detection (Energy-based) ---
    const channelData = audioBuffer.getChannelData(0);
    const frameSize = 1024;
    let onsets: { time: number; velocity: number }[] = [];
    let lastEnergy = 0;
    for (let i = 0; i < channelData.length; i += frameSize) {
        let sum = 0;
        for (let j = 0; j < frameSize; j++) {
            const sample = channelData[i + j];
            if (sample) {
                sum += Math.pow(sample, 2);
            }
        }
        const energy = Math.sqrt(sum / frameSize);
        if (energy - lastEnergy > ONSET_THRESHOLD) {
            const time = i / audioBuffer.sampleRate;
            onsets.push({ time, velocity: Math.min(1, (energy - lastEnergy) / ONSET_THRESHOLD) });
        }
        lastEnergy = energy;
    }
    
    // Debounce onsets that are too close together
    onsets = onsets.filter((onset, index, arr) => {
         if(index === 0) return true;
         return onset.time - arr[index - 1].time > 0.1; // min 100ms between notes
    });

    if (onsets.length === 0) {
        return [];
    }

    // --- 2. Pitch Detection at each onset ---
    const events: Event[] = [];
    for (let i = 0; i < onsets.length; i++) {
        const onset = onsets[i];
        const nextOnset = onsets[i + 1];
        const duration = nextOnset ? nextOnset.time - onset.time : 0.2; // Default duration for last note

        // Create a small AudioBuffer slice for pitch analysis
        const sliceStartSample = Math.floor(onset.time * audioBuffer.sampleRate);
        const sliceEndSample = Math.min(sliceStartSample + FFT_SIZE, audioBuffer.length);
        
        const tempCtxForSlice = new AudioContext();
        const sliceBuffer = tempCtxForSlice.createBuffer(1, sliceEndSample - sliceStartSample, audioBuffer.sampleRate);
        const sliceData = sliceBuffer.getChannelData(0);
        
        const originalData = audioBuffer.getChannelData(0);
        for(let k = 0; k < sliceData.length; k++) {
            sliceData[k] = originalData[sliceStartSample + k];
        }

        const peakFreq = await detectPitch(sliceBuffer);
        await tempCtxForSlice.close();

        if (peakFreq > 50) { // Ignore very low frequencies (noise)
            const midiNote = frequencyToMidi(peakFreq);
            const noteName = midiToNoteName(midiNote);
            
            // --- 3. Quantization ---
            const beatDuration = 60 / bpm;
            const subdivision = quantization / 4; // 16th notes for q=16
            const subdivisionDuration = beatDuration / subdivision;
            const quantizedTime = Math.round(onset.time / subdivisionDuration) * subdivisionDuration;

            events.push({
                id: `event_${Date.now()}_${events.length}`,
                time: quantizedTime,
                duration: Math.max(subdivisionDuration, duration),
                note: noteName,
                velocity: onset.velocity,
            });
        }
    }

    // Remove duplicate quantized events, keeping the one with higher velocity
    const uniqueEvents = new Map<number, Event>();
    for (const event of events) {
        if (!uniqueEvents.has(event.time) || uniqueEvents.get(event.time)!.velocity < event.velocity) {
            uniqueEvents.set(event.time, event);
        }
    }
    return Array.from(uniqueEvents.values()).sort((a,b) => a.time - b.time);
};