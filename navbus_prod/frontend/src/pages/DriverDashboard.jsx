import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import ProfileDrawer from '../components/ProfileDrawer';
import BusMap from '../components/BusMap';
import { api } from '../utils/api';
import { useSocket } from '../hooks/useSocket';

export default function DriverDashboard() {
  const { user, showToast } = useApp();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [routes, setRoutes]           = useState([]);
  const [buses,  setBuses]            = useState([]);
  const [selRoute, setSelRoute]       = useState('');
  const [selBus,   setSelBus]         = useState('');
  const [activeTab, setActiveTab]     = useState('info');
  const [tripActive, setTripActive]   = useState(false);
  const [tripId,     setTripId]       = useState(null);
  const [currentBus, setCurrentBus]   = useState(null);
  const [driverLat,  setDriverLat]    = useState(null);
  const [driverLng,  setDriverLng]    = useState(null);
  const [speed,      setSpeed]        = useState(0);
  const watchRef  = useRef(null);
  const restTimer = useRef(null);

  // WebSocket hook — driver sends GPS via WS when trip is active
  const driverBusId = tripActive ? selBus : null;
  const { connected, sendDriverLocation } = useSocket({ driverBusId });

  useEffect(() => {
    api.getRoutes().then(setRoutes).catch(() => showToast('Failed to load routes'));
  }, []);

  useEffect(() => {
    if (selRoute) api.getBuses().then(b => setBuses(b.filter(x => String(x.route_id) === String(selRoute))));
  }, [selRoute]);

  const handleStart = async () => {
    if (!selRoute || !selBus) { showToast('Select route and bus first'); return; }
    if (!navigator.geolocation) { showToast('GPS not available on this device'); return; }
    try {
      const trip = await api.startTrip(user.id, selBus, selRoute);
      const busData = await api.getBus(selBus);
      setTripId(trip.trip_id);
      setCurrentBus(busData);
      setTripActive(true);
      showToast('🟢 Trip started — GPS active');
      startGPS(trip.trip_id);
    } catch (e) { showToast('Failed to start: ' + e.message); }
  };

  const startGPS = (tId) => {
    // Use watchPosition for continuous stream
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat   = pos.coords.latitude;
        const lng   = pos.coords.longitude;
        const spd   = Math.round((pos.coords.speed || 0) * 3.6); // m/s → km/h
        setDriverLat(lat); setDriverLng(lng); setSpeed(spd);

        // 1. Send via WebSocket (instant)
        sendDriverLocation(lat, lng, spd);
        // 2. Also send via REST as backup every 10 s
        api.updateDriverLocation(tId, lat, lng, spd).catch(() => {});
      },
      (err) => showToast('GPS error: ' + err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 }
    );
  };

  const handleEnd = async () => {
    if (!tripId) return;
    try {
      await api.endTrip(tripId);
      if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
      clearInterval(restTimer.current);
      setTripActive(false); setTripId(null); setCurrentBus(null);
      setDriverLat(null); setDriverLng(null); setSpeed(0);
      showToast('Trip ended. Thanks for driving! 🙏');
    } catch { showToast('Failed to end trip'); }
  };

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    clearInterval(restTimer.current);
  }, []);

  const nextStop = currentBus?.stops?.[2];
  const nextDep  = currentBus?.schedule?.find(s => s.status === 'next')?.time;

  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div className="app-header">
        <div className="header-left">
          <div className="header-logo">
            <span className="header-logo-icon">🚌</span>
            <h1>Driver Mode</h1>
          </div>
          <div className="header-city" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background: connected?'#22c55e':'#f59e0b', display:'inline-block' }}/>
            <span>{connected ? 'Live connected' : 'Reconnecting...'}</span>
          </div>
        </div>
        <button className="profile-btn" onClick={() => setDrawerOpen(true)}>{user?.username?.[0]?.toUpperCase()}</button>
      </div>

      <div className="scroll-content" style={{ flex:1, overflowY:'auto', paddingBottom:24 }}>
        {!tripActive ? (
          <div style={{ padding:16 }}>
            <div className="card" style={{ margin:0 }}>
              <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text-dark)', marginBottom:16 }}>Start Your Trip</h3>
              <div style={{ marginBottom:16 }}>
                <div className="step-label">Step 1 — Select Route</div>
                <select style={{ width:'100%', padding:'12px 14px', border:'1.5px solid var(--input-border)', borderRadius:12, fontSize:15, fontFamily:'Poppins', background:'var(--card-bg)', color:'var(--text-dark)', marginTop:6 }}
                  value={selRoute} onChange={e => { setSelRoute(e.target.value); setSelBus(''); }}>
                  <option value="">Choose a route...</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
                </select>
              </div>
              {selRoute && (
                <div style={{ marginBottom:16 }}>
                  <div className="step-label">Step 2 — Select Bus</div>
                  <select style={{ width:'100%', padding:'12px 14px', border:'1.5px solid var(--input-border)', borderRadius:12, fontSize:15, fontFamily:'Poppins', background:'var(--card-bg)', color:'var(--text-dark)', marginTop:6 }}
                    value={selBus} onChange={e => setSelBus(e.target.value)}>
                    <option value="">Choose a bus...</option>
                    {buses.map(b => <option key={b.id} value={b.id}>{b.name} ({b.bus_number})</option>)}
                  </select>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>{buses.length} bus{buses.length!==1?'es':''} on this route</div>
                </div>
              )}
              <button className="btn-primary" style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)' }} onClick={handleStart}>
                🟢 Start Trip
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Trip bar */}
            <div className="trip-bar">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <span className="bus-num-badge">{currentBus?.bus_number}</span>
                  <div style={{ fontSize:13, color:'var(--text-body)', marginTop:4, fontWeight:500 }}>{currentBus?.route_name}</div>
                </div>
                <button className="btn-danger" style={{ padding:'8px 16px', fontSize:13 }} onClick={handleEnd}>⏹ End Trip</button>
              </div>
              <div className="trip-stats">
                <div className="trip-stat"><div className="val">{speed}</div><div className="lbl">km/h</div></div>
                <div className="trip-stat"><div className="val" style={{ fontSize:13, fontWeight:700, color:'var(--warning)' }}>{nextStop?.name||'—'}</div><div className="lbl">Next Stop</div></div>
                <div className="trip-stat"><div className="val" style={{ fontSize:14 }}>{nextDep||'—'}</div><div className="lbl">Next Dep.</div></div>
              </div>
              {driverLat && <div style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center', marginTop:4 }}>📍 {driverLat.toFixed(5)}, {driverLng.toFixed(5)}</div>}
            </div>

            <BusMap stops={currentBus?.stops||[]} busLat={driverLat} busLng={driverLng} height={240} highlightStopIdx={2} showNumbers/>

            <div className="tabs">
              <button className={`tab ${activeTab==='info'?'active':''}`} onClick={() => setActiveTab('info')}>Info</button>
              <button className={`tab ${activeTab==='stops'?'active':''}`} onClick={() => setActiveTab('stops')}>Stops</button>
              <button className={`tab ${activeTab==='schedule'?'active':''}`} onClick={() => setActiveTab('schedule')}>Schedule</button>
            </div>

            {activeTab==='info' && currentBus && (
              <div style={{ padding:16 }}>
                <div className="card" style={{ margin:0 }}>
                  {[['Bus','name'],['Number','bus_number'],['Route','route_name'],['Hours','operating_hours']].map(([k,v])=>(
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize:13, color:'var(--text-muted)' }}>{k}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text-dark)' }}>{currentBus[v]}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
                    <span style={{ fontSize:13, color:'var(--text-muted)' }}>GPS Source</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>Driver Live ✅</span>
                  </div>
                </div>
              </div>
            )}
            {activeTab==='stops' && currentBus && (
              <div className="timeline" style={{ paddingBottom:24 }}>
                {currentBus.stops.map((stop, idx) => {
                  const isNext   = idx === 2;
                  const isPassed = idx < 2;
                  const isFirst  = idx === 0;
                  const isLast   = idx === currentBus.stops.length-1;
                  return (
                    <div className="timeline-stop" key={stop.id}>
                      <div className="timeline-left">
                        {idx>0 && <div className={`timeline-line ${isPassed?'passed':''}`}/>}
                        <div className={`timeline-dot ${isPassed?'passed':isNext?'next-stop':isFirst?'start':isLast?'end':''}`}/>
                        {idx<currentBus.stops.length-1 && <div className={`timeline-line ${isPassed?'passed':''}`}/>}
                      </div>
                      <div className="timeline-content">
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            {isFirst && <span className="stop-badge badge-start">START</span>}
                            {isLast  && <span className="stop-badge badge-end">END</span>}
                            {isNext  && <span className="stop-badge badge-next">NEXT</span>}
                            <span className={`stop-name ${isPassed?'passed':''}`}>{stop.name}</span>
                          </div>
                          {isPassed && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Passed</span>}
                          {isNext   && <span className="eta-badge eta-teal">~3 min</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {activeTab==='schedule' && currentBus && (
              <>
                <div style={{ padding:'14px 16px 4px', fontSize:13, color:'var(--text-muted)', fontWeight:500 }}>
                  Departures from <span style={{ color:'var(--text-dark)', fontWeight:700 }}>{currentBus.start_point}</span>
                </div>
                <div className="schedule-grid">
                  {currentBus.schedule.map((s,i) => <div key={i} className={`sched-chip ${s.status}`}>{s.time}</div>)}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}/>
    </div>
  );
}
