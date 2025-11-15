import { Event, InstrumentType, Track } from '../types';

export type ClipboardItem = 
    | { type: 'event'; event: Event; originalInstrument?: InstrumentType }
    | { type: 'audio'; track: Track };
