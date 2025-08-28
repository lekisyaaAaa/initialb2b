import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useDarkMode } from '../contexts/DarkModeContext';

const DarkModeToggle: React.FC = () => {
  const { isDarkMode, toggleDarkMode, setDarkMode } = useDarkMode();

  const ensureToggle = () => {
    try {
      const html = document.documentElement;
      if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('darkMode', JSON.stringify(false));
      } else {
        html.classList.add('dark');
        localStorage.setItem('darkMode', JSON.stringify(true));
      }
    } catch (e) {
      // swallow errors
      // eslint-disable-next-line no-console
      console.warn('fallback dark toggle failed', e);
    }
  };

  return (
    <button
  type="button"
  onClickCapture={(e) => { e.stopPropagation(); try { setDarkMode(!isDarkMode); } catch (err) { console.warn('setDarkMode error', err); try { toggleDarkMode(); } catch (err2) { console.warn('toggleDarkMode error', err2); } } ensureToggle(); }}
  onPointerDownCapture={(e) => { e.stopPropagation(); }}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); try { setDarkMode(!isDarkMode); } catch (err) { console.warn('setDarkMode error', err); try { toggleDarkMode(); } catch (err2) { console.warn('toggleDarkMode error', err2); } } ensureToggle(); } }}
  className="relative p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors duration-200 z-[9999] pointer-events-auto"
  aria-label="Toggle dark mode"
    >
      <div className="relative w-6 h-6">
        <Sun 
          className={`absolute inset-0 h-6 w-6 text-yellow-500 transition-transform duration-300 ${
            isDarkMode ? 'rotate-90 scale-0' : 'rotate-0 scale-100'
          }`}
        />
        <Moon 
          className={`absolute inset-0 h-6 w-6 text-blue-400 transition-transform duration-300 ${
            isDarkMode ? 'rotate-0 scale-100' : '-rotate-90 scale-0'
          }`}
        />
      </div>
    </button>
  );
};

export default DarkModeToggle;
