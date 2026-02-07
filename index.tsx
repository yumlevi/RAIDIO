import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { RadioProvider } from './context/RadioContext';
import { ThemeProvider } from './context/ThemeContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <RadioProvider>
        <App />
      </RadioProvider>
    </ThemeProvider>
  </React.StrictMode>
);
