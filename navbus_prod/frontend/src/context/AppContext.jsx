import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('navbus_user')); } catch { return null; }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('navbus_theme') || 'light');
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('navbus_searches')) || []; } catch { return []; }
  });
  const [locationGranted, setLocationGranted] = useState(() => localStorage.getItem('navbus_location') === 'true');
  const [toast, setToast] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('navbus_theme', theme);
  }, [theme]);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('navbus_user', JSON.stringify(userData));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('navbus_user');
  };
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const addSearch = (from, to) => {
    const search = `${from} → ${to}`;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== search);
      const updated = [search, ...filtered].slice(0, 5);
      localStorage.setItem('navbus_searches', JSON.stringify(updated));
      return updated;
    });
  };
  const showToast = (msg, duration = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  };
  const clearSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('navbus_searches');
  };
  const grantLocation = () => {
    setLocationGranted(true);
    localStorage.setItem('navbus_location', 'true');
  };

  return (
    <AppContext.Provider value={{ user, login, logout, theme, toggleTheme, recentSearches, addSearch, clearSearches, locationGranted, grantLocation, toast, showToast, activeTrip, setActiveTrip }}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
