import React from 'react';
import { createRoot } from 'react-dom/client';
// Fix: Changed default import to named import to match the export from App.tsx.
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);