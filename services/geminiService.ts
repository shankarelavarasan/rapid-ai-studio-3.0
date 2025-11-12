import { GoogleGenAI, Type } from "@google/genai";
import { Event, InstrumentType } from '../types';

interface AiTrackResponse {
    events: Event[];
}

// Ensure the API_KEY is available in your environment variables
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.warn("Gemini API key not found. AI features will be disabled. Please set process.env.API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

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
                    note: { type: Type.STRING, description: "The drum sample to play. Must be one of: 'kick', 'snare', 'hihat'." },
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
                    note: { type: Type.STRING, description: "The musical note to play, e.g., 'C4', 'G5'. Use notes from the C2 to B6 range." },
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
    instrument: InstrumentType
): Promise<AiTrackResponse> => {
    if (!API_KEY) {
        throw new Error("Gemini API key is not configured.");
    }
    
    const prompt =
        trackType === 'beat'
            ? `Create a compelling 2-measure (8 beats) drum pattern at ${bpm} BPM. The pattern should have a solid groove suitable for a pop song. Use only 'kick', 'snare', and 'hihat' samples. The total duration should be (8 * 60 / ${bpm}) seconds. Generate unique IDs for each event.`
            : `Create a simple and catchy 2-measure (8 beats) ${instrument} melody at ${bpm} BPM in the key of C Major. Use a variety of notes from C3 to C6 to create an interesting melodic contour. Make it memorable and musically expressive. The total duration should be (8 * 60 / ${bpm}) seconds. Generate unique IDs for each event.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: trackType === 'beat' ? beatSchema : instrumentSchema,
                temperature: 0.8
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
        throw new Error("Failed to generate AI track. The model may have returned an invalid format.");
    }
};