import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function ProfileDrawer({ open, onClose }) {
  const { user, logout, theme, toggleTheme, recentSearches, clearSearches } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/login');
  };

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={onClose} style={{ pointerEvents: open ? 'all' : 'none' }} />
      <div className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-avatar">{user?.username?.[0]?.toUpperCase() || 'U'}</div>
        <div className="drawer-username">{user?.username}</div>
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <span className={`role-badge ${user?.role}`}>{user?.role === 'driver' ? '🚌 Driver' : '🧑 Passenger'}</span>
        </div>

        <div className="drawer-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Recent Searches</span>
          {recentSearches.length > 0 && (
            <button
              onClick={clearSearches}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', padding: '0' }}
            >
              Clear
            </button>
          )}
        </div>
        {recentSearches.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recent searches</div>
        ) : recentSearches.map((s, i) => (
          <div className="recent-search" key={i}>{s}</div>
        ))}

        <div className="theme-toggle-row" style={{ marginTop: 'auto' }}>
          <span style={{ fontSize: 14, color: 'var(--text-body)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {theme === 'dark' ? '🌙' : '☀️'} {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <button className={`toggle-switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme} />
        </div>

        <button className="btn-danger" style={{ marginTop: 12 }} onClick={handleLogout}>🚪 Log Out</button>
      </div>
    </>
  );
}
