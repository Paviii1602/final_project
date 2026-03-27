import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import ProfileDrawer from '../components/ProfileDrawer';
import { api, getEtaLabel } from '../utils/api';

/* ─────────────────────────────────────────────────────────
   Reverse-geocode lat/lng → human-readable city name.
   Uses the browser's free Nominatim (OpenStreetMap) API —
   no API key required, works everywhere.
   Returns something like "Vellore, Tamil Nadu" or just the
   raw coords as fallback.
   ───────────────────────────────────────────────────────── */
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    const addr = data.address || {};

    /* Build a short, readable string from whichever fields are present */
    const city   = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
    const state  = addr.state || '';

    if (city && state) return `${city}, ${state}`;
    if (city)          return city;
    if (state)         return state;
    return data.display_name?.split(',')[0] || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  } catch {
    return null;   // silently fall back to default
  }
}

export default function Home() {
  const { user, addSearch, showToast } = useApp();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab,  setActiveTab]  = useState('buses');
  const [buses,   setBuses]   = useState([]);
  const [routes,  setRoutes]  = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [fromStop, setFromStop] = useState('');
  const [toStop,   setToStop]   = useState('');
  const [loading,  setLoading]  = useState(true);

  /* City name — starts null (shows spinner dot) until GPS resolves */
  const [cityName, setCityName] = useState(null);

  /* ── Load buses / routes / stops ── */
  useEffect(() => {
    Promise.all([api.getBuses(), api.getRoutes(), api.getAllStops()])
      .then(([b, r, s]) => { setBuses(b); setRoutes(r); setAllStops(s); })
      .catch(() => showToast('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  /* ── Live location → reverse geocode → city name ── */
  useEffect(() => {
    if (!navigator.geolocation) {
      setCityName('Vellore, Tamil Nadu');   // graceful fallback
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const name = await reverseGeocode(latitude, longitude);
        setCityName(name || 'Vellore, Tamil Nadu');
      },
      (err) => {
        /* Permission denied or timeout — use default */
        console.warn('Geolocation error:', err.message);
        setCityName('Vellore, Tamil Nadu');
      },
      {
        enableHighAccuracy: false,   // faster fix, good enough for city name
        timeout: 8000,
        maximumAge: 60000,           // reuse a cached position up to 1 min old
      }
    );
  }, []);

  const handleSearch = () => {
    if (!fromStop || !toStop)      { showToast('Please select both stops'); return; }
    if (fromStop === toStop)        { showToast('From and To stops cannot be the same'); return; }
    addSearch(fromStop, toStop);
    navigate(`/search?from=${encodeURIComponent(fromStop)}&to=${encodeURIComponent(toStop)}`);
  };

  const handleSwap = () => { setFromStop(toStop); setToStop(fromStop); };

  const handleNearby = () => {
    if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
    showToast('Finding buses near you...');
    navigator.geolocation.getCurrentPosition(
      (pos) => navigate(`/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
      ()    => showToast('Could not get your location')
    );
  };

  const uniqueBuses = buses.filter((b, i, arr) => arr.findIndex(x => x.name === b.name) === i);

  const selectStyle = {
    width: '100%',
    padding: '13px 14px',
    fontSize: 15,
    fontFamily: 'Poppins, sans-serif',
    border: 'none',
    borderRadius: 11,
    background: 'rgba(255,255,255,0.97)',
    color: '#0f2030',
    appearance: 'none',
    WebkitAppearance: 'none',
    outline: 'none',
    boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div className="app-header">
        <div className="header-left">
          <div className="header-logo">
            <span className="header-logo-icon">🚌</span>
            <h1>NavBus</h1>
          </div>

          {/* City name: pulsing dot while resolving, real name once ready */}
          <div className="header-city">
            📍{' '}
            {cityName === null ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.6)',
                  display: 'inline-block',
                  animation: 'blink 1s infinite',
                }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Locating…</span>
              </span>
            ) : cityName}
          </div>
        </div>

        <button className="profile-btn" onClick={() => setDrawerOpen(true)}>
          {user?.username?.[0]?.toUpperCase()}
        </button>
      </div>

      {/* ── Search Panel ── */}
      <div className="search-panel">
        <div className="search-inner">

          {/* Row 1 — FROM */}
          <div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: 700,
                          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
              FROM
            </div>
            <select value={fromStop} onChange={e => setFromStop(e.target.value)} style={selectStyle}>
              <option value="">Select start stop</option>
              {allStops.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Swap button between rows */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
            <button
              onClick={handleSwap}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                border: '1.5px solid rgba(255,255,255,0.4)',
                color: '#fff', fontSize: 17, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'manipulation', transition: 'transform 0.3s',
              }}
              title="Swap stops"
            >⇅</button>
          </div>

          {/* Row 2 — TO */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: 700,
                          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
              TO
            </div>
            <select value={toStop} onChange={e => setToStop(e.target.value)} style={selectStyle}>
              <option value="">Select destination</option>
              {allStops.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Find My Bus */}
          <button className="search-btn" onClick={handleSearch} style={{ marginBottom: 10 }}>
            🔍 Find My Bus
          </button>

          {/* Find Buses Near Me — directly below */}
          <button
            onClick={handleNearby}
            style={{
              width: '100%', padding: '11px',
              border: '1.5px dashed rgba(255,255,255,0.55)',
              borderRadius: 11,
              background: 'rgba(255,255,255,0.10)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              fontFamily: 'Poppins, sans-serif',
              cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            📍 Find Buses Near Me
          </button>
        </div>
      </div>

      {/* ── Tabs: All Buses | Routes ── */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'buses' ? 'active' : ''}`}
          onClick={() => setActiveTab('buses')}
        >All Buses</button>
        <button
          className={`tab ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >Routes</button>
      </div>

      {/* ── Content ── */}
      <div className="scroll-content" style={{ flex: 1, overflowY: 'auto', paddingBottom: 28 }}>

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading buses…</span>
          </div>

        ) : activeTab === 'buses' ? (
          <>
            <div className="section-title">🚌 All Buses ({uniqueBuses.length})</div>
            {uniqueBuses.map(bus => {
              const etaInfo = getEtaLabel(bus.eta);
              return (
                <div
                  className="card"
                  key={bus.id}
                  onClick={() => navigate(`/bus/${bus.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-row">
                    <div>
                      <div className="bus-name">{bus.name}</div>
                      <div className="bus-hours">⏰ {bus.operating_hours}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span className="bus-num-badge">{bus.bus_number}</span>
                      <span className={`eta-badge ${bus.is_active ? etaInfo.cls : 'eta-grey'}`}>
                        {bus.is_active ? etaInfo.label : 'Schedule only'}
                      </span>
                    </div>
                  </div>
                  {bus.next_departure && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      Next:{' '}
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {bus.next_departure}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </>

        ) : (
          <>
            <div className="section-title">🗺️ Routes ({routes.length})</div>
            {routes.map(route => (
              <div
                className="route-card"
                key={route.id}
                onClick={() => navigate(`/route/${route.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="route-num">Route {route.id} · {route.stop_count} stops</div>
                <div className="route-name">{route.route_name}</div>
                <div className="route-endpoints">
                  <span>🟢 {route.start_point}</span>
                  <span className="route-arrow">→</span>
                  <span>🔴 {route.end_point}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
