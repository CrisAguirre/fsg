import { createContext } from 'react';

// Contexto puro en su propio módulo para que ThemeContext.jsx solo exporte
// componentes (regla react-refresh/only-export-components).
export const ThemeContext = createContext(null);
