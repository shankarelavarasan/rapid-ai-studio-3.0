import { GoogleGenAI, Type } from "@google/genai";
import { Event, InstrumentType } from '../types';
import { DRUM_SAMPLE_KEYS, PIANO_NOTES } from "./sampleService";

interface AiTrackResponse {
    events: Event[];
}

// Ensure the API_KEY is available in your environment variables
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;

// Lazily initialize the AI client to prevent app crash on load
const getAiClient = () => {
    if (ai) {
        return ai;
    }
    if (!API_KEY) {
        console.warn("Gemini API key not found. AI features will be disabled. Please set process.env.API_KEY.");
        throw new Error("Gemini API key is not configured.");
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
    return ai;
};

const beatSchema = {
    type: Type.OBJECT,
    properties: {
        events: {
            type: Type.ARRAY,
            description: 'An array of drum hit events.',
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: 'A unique ID for the event.' },
                    time: { type: Type.NUMBER, description: 'The start time of the drum hit in seconds, relative to the start of the measure.' },
                    duration: { type: Type.NUMBER, description: 'The duration of the hit in seconds (e.g., 0.1 for a short hit).' },
                    note: { 
                        type: Type.STRING, 
                        description: `The drum sample to play. Must be one of: '${DRUM_SAMPLE_KEYS.join("', '")}'.`
                    },
                    velocity: { type: Type.NUMBER, description: 'The velocity of the hit, from 0.0 to 1.0.' },
                },
                required: ['id', 'time', 'duration', 'note', 'velocity'],
            },
        },
    },
    required: ['events'],
};

const instrumentSchema = {
    type: Type.OBJECT,
    properties: {
        events: {
            type: Type.ARRAY,
            description: 'An array of musical note events.',
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: 'A unique ID for the event.' },
                    time: { type: Type.NUMBER, description: 'The start time of the note in seconds, relative to the start of the measure.' },
                    duration: { type: Type.NUMBER, description: 'The duration of the note in seconds.' },
                    note: { 
                        type: Type.STRING, 
                        description: `The musical note to play, e.g., 'C4', 'G5'. Use notes from this list: ${PIANO_NOTES.join(', ')}.`
                    },
                    velocity: { type: Type.NUMBER, description: 'The velocity of the note, from 0.0 to 1.0.' },
                },
                required: ['id', 'time', 'duration', 'note', 'velocity'],
            },
        },
    },
    required: ['events'],
};


export const generateAiTrack = async (
    trackType: 'beat' | 'instrument',
    bpm: number,
    instrument: InstrumentType,
): Promise<AiTrackResponse> => {
    
    // Generate 2 measures of music
    const totalDuration = (8 * 60) / bpm; 

    const beatPrompt = `You are a professional beat-making AI. Your task is to generate a creative and catchy 2-measure drum pattern at ${bpm} BPM.

    Follow these rules precisely:
    1.  **Sound Palette**: Use only these drum sounds: '${DRUM_SAMPLE_KEYS.join("', '")}'.
    2.  **Structure**: The 'bass' and 'kick' should form the core rhythmic foundation. The 'snare' should typically land on beats 2 and 4 of each measure. The 'hihat' should provide a steady rhythm (e.g., 8th or 16th notes). Use 'clap' sparingly for accents.
    3.  **Rhythm**: Create a syncopated, professional rhythm. Do not just place all hits on the downbeat. The final pattern must be exactly ${totalDuration.toFixed(2)} seconds long.
    4.  **Output Format**: Provide the output as a JSON object matching the required schema. Ensure every event has a unique ID, a precise time, a short duration (e.g., 0.1s), a valid note, and a velocity between 0.7 and 1.0.`;

    const instrumentPrompt = `Create a simple, creative, and catchy 2-measure ${instrument} melody at ${bpm} BPM. The melody should be musically expressive and memorable, using notes from the C3 to C6 range. The total duration must be exactly ${totalDuration.toFixed(2)} seconds. Generate unique IDs for each event. The available notes are ${PIANO_NOTES.join(', ')}.`;

    const prompt = trackType === 'beat' ? beatPrompt : instrumentPrompt;

    try {
        const geminiClient = getAiClient();
        const response = await geminiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: trackType === 'beat' ? beatSchema : instrumentSchema,
                temperature: 0.9
            }
        });
        
        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText) as AiTrackResponse;
        
        if (!parsedResponse.events || !Array.isArray(parsedResponse.events)) {
             throw new Error("AI response did not contain a valid 'events' array.");
        }

        return parsedResponse;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error && error.message.includes("API key")) {
            throw error;
        }
        throw new Error("Failed to generate AI track. The model may have returned an invalid format.");
    }
};