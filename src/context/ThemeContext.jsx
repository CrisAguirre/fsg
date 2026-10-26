import { useEffect, useState } from 'react';
import logoWhite from '../assets/logowhite.png';
import logoBlack from '../assets/logoblack.png';
import { ThemeContext } from './themeContextValue.js';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('fsg_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch {
      /* ignore */
    }
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem('fsg_theme', theme);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    if (document.body) {
      document.body.className = `theme-${theme}`;
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0a0b0e' : '#f8fafc');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isDark = theme === 'dark';
  const logo = isDark ? logoWhite : logoBlack;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark,
        logo,
        logoWhite,
        logoBlack,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
