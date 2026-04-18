import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'toast-custom',
          duration: 4000,
          style: {
            background: '#161616',
            color: '#f0f0f0',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            fontFamily: "'Space Mono', monospace",
            fontSize: '13px',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
