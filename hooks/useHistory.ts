import { useState, useCallback, useRef } from 'react';

export const useHistory = <T,>(initialState: T) => {
    const history = useRef<T[]>([initialState]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const state = history.current[historyIndex];

    const setState = useCallback((action: T | ((prevState: T) => T)) => {
        const newState = typeof action === 'function' 
            ? (action as (prevState: T) => T)(history.current[historyIndex]) 
            : action;

        // Truncate any 'redo' history when a new state is set
        const newHistory = history.current.slice(0, historyIndex + 1);
        newHistory.push(newState);
        
        history.current = newHistory;
        setHistoryIndex(newHistory.length - 1);
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        }
    }, [historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.current.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    }, [historyIndex]);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.current.length - 1;

    return {
        state,
        setState,
        undo,
        redo,
        canUndo,
        canRedo,
    };
};
