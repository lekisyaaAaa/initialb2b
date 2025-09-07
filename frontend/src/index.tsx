import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
// Apply dark mode class synchronously before React mounts to avoid a flash
try {
  const saved = localStorage.getItem('darkMode');
  const prefersDark = saved !== null
    ? JSON.parse(saved)
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (prefersDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch (e) {
  // ignore - accessing localStorage can fail in some environments
}

root.render(
  <App />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
