import React from 'react';

export interface ContextMenuItem {
    label: string;
    onClick: () => void;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    return (
        <div 
            className="fixed z-50 w-32 bg-gray-700 border border-gray-600 rounded-md shadow-lg"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing it via the App-level handler
        >
            <ul className="py-1">
                {items.map((item, index) => (
                    <li key={index}>
                        <button
                            onClick={() => {
                                item.onClick();
                                onClose();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white"
                        >
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
