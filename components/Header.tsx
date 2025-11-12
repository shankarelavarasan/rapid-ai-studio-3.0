import React from 'react';

const MusicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-12c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
);

const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H15a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
);

const RedoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H5a1 1 0 110-2h9.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

interface HeaderProps {
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onUndo, onRedo, canUndo, canRedo }) => {
    return (
        <header className="bg-gray-800 text-white shadow-lg p-3 flex justify-between items-center z-10">
            <div className="flex items-center">
                <MusicIcon />
                <h1 className="text-xl font-bold tracking-wider">Rapid AI Audio Studio</h1>
            </div>
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={onUndo} 
                        disabled={!canUndo} 
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Undo"
                    >
                        <UndoIcon />
                    </button>
                    <button 
                        onClick={onRedo} 
                        disabled={!canRedo} 
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Redo"
                    >
                        <RedoIcon />
                    </button>
                </div>
                <div className="h-6 w-px bg-gray-600"></div>
                <button className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm font-semibold transition-colors">
                    Export
                </button>
                <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-semibold transition-colors">
                    Save
                </button>
            </div>
        </header>
    );
};
