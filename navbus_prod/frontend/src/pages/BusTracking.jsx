import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api, getSourceBadge } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import BusMap from '../components/BusMap';

function BusHereCircle() {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: 'var(--primary)',
      boxShadow: '0 0 0 5px rgba(21,168,205,0.20)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, animation: 'busGlow 2s ease infinite',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="13" rx="3" fill="white"/>
        <rect x="3" y="4" width="18" height="4"  rx="3" fill="rgba(255,255,255,0.55)"/>
        <rect x="5" y="5" width="14" height="4"  rx="1.5" fill="rgba(21,168,205,0.75)"/>
        <rect x="3" y="15" width="18" height="2" rx="1" fill="rgba(255,255,255,0.55)"/>
        <circle cx="7"  cy="19" r="2.2" fill="white"/>
        <circle cx="7"  cy="19" r="1.1" fill="rgba(21,168,205,0.5)"/>
        <circle cx="17" cy="19" r="2.2" fill="white"/>
        <circle cx="17" cy="19" r="1.1" fill="rgba(21,168,205,0.5)"/>
      </svg>
    </div>
  );
}

export default function BusTracking() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const highlightStop = searchParams.get('highlight') || null;
  const navigate      = useNavigate();
  const { showToast } = useApp();

  const [bus,            setBus]            = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState('eta');
  const [userLat,        setUserLat]        = useState(null);
  const [userLng,        setUserLng]        = useState(null);
  const [liveLat,        setLiveLat]        = useState(null);
  const [liveLng,        setLiveLng]        = useState(null);
  const [liveSpeed,      setLiveSpeed]      = useState(null);
  const [liveSource,     setLiveSource]     = useState('schedule');
  const [lastSeen,       setLastSeen]       = useState(null);
  const [isCrowdsourcing,setIsCrowdsourcing]= useState(false);
  const [notifStop,      setNotifStop]      = useState('');

  const crowdInterval = useRef(null);
  const highlightRef  = useRef(null);
  const pollInterval  = useRef(null);

  // ── WebSocket: join room for this bus, receive live pushes ──────────────
  const { connected, busUpdate } = useSocket({ watchBusId: id });

  // When a live push arrives, update position without re-fetching
  useEffect(() => {
    if (!busUpdate) return;
    if (String(busUpdate.bus_id) !== String(id)) return;
    if (busUpdate.lat && busUpdate.lng) {
      setLiveLat(busUpdate.lat);
      setLiveLng(busUpdate.lng);
      setLiveSpeed(busUpdate.speed);
      setLiveSource(busUpdate.source_type || 'driver_live');
      setLastSeen(new Date(busUpdate.ts || Date.now()));
    } else if (busUpdate.is_active === false) {
      // Driver ended trip
      setLiveLat(null); setLiveLng(null);
      setLiveSource('schedule');
    }
  }, [busUpdate, id]);

  // ── Initial load + REST polling fallback (15 s) ─────────────────────────
  useEffect(() => {
    loadBus();
    pollInterval.current = setInterval(loadBus, 15000);
    return () => clearInterval(pollInterval.current);
  }, [id]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setUserLat(pos.coords.latitude);
      setUserLng(pos.coords.longitude);
    });
    return () => stopCrowdsource();
  }, []);

  useEffect(() => {
    if (highlightStop && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
    }
  }, [bus, highlightStop]);

  const loadBus = async () => {
    try {
      const d = await api.getBus(id);
      setBus(d);
      // Sync REST state if WS hasn't pushed anything yet
      if (d.is_active && d.live_lat && !liveLat) {
        setLiveLat(d.live_lat);
        setLiveLng(d.live_lng);
        setLiveSpeed(d.live_speed);
        setLiveSource(d.source_type);
      }
      if (!d.is_active) {
        setLiveLat(null); setLiveLng(null);
        setLiveSource('schedule');
      }
    } catch { showToast('Failed to load bus'); }
    finally { setLoading(false); }
  };

  const startCrowdsource = () => {
    if (!navigator.geolocation) { showToast('Geolocation not available'); return; }
    setIsCrowdsourcing(true);
    showToast('Sharing your location 🙏');
    const send = () => navigator.geolocation.getCurrentPosition(pos => {
      setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude);
      api.updateBusLocation(id, pos.coords.latitude, pos.coords.longitude,
                            pos.coords.speed || 0, 'crowdsourced');
    });
    send();
    crowdInterval.current = setInterval(send, 30000);
  };

  const stopCrowdsource = () => {
    setIsCrowdsourcing(false);
    if (crowdInterval.current) { clearInterval(crowdInterval.current); crowdInterval.current = null; }
  };

  const handleNotif = () => {
    if (!notifStop) { showToast('Select a stop first'); return; }
    'Notification' in window && Notification.requestPermission().then(p =>
      showToast(p === 'granted'
        ? `🔔 Will notify when bus reaches ${notifStop}`
        : 'Notification permission denied')
    );
  };

  if (loading) return <div className="loading" style={{ minHeight:'100dvh' }}><div className="spinner"/></div>;
  if (!bus)    return <div className="empty-state" style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}><div className="icon">🚍</div><p>Bus not found</p></div>;

  const isLive   = !!(liveLat && liveLng);
  const src      = getSourceBadge(liveSource);

  // Build ETA list from the bus.eta array (pre-computed by backend)
  // When WS pushes a new position, we can re-derive nearest stop client-side
  const etaList  = bus.eta || [];
  const curIdx   = isLive ? etaList.findIndex(e => e.status === 'arriving') : -1;

  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div className="back-header" style={{ flexDirection:'column', alignItems:'flex-start' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, width:'100%' }}>
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h2 style={{ flex:1, textAlign:'center' }}>{bus.name}</h2>
          <span style={{ background:'rgba(255,255,255,0.2)', padding:'4px 12px', borderRadius:20, color:'#fff', fontSize:12, fontWeight:700 }}>{bus.bus_number}</span>
        </div>
      </div>

      {/* Info strip */}
      <div className="info-strip">
        <div className="info-strip-row">
          <span style={{ fontSize:13, color:'var(--text-body)', fontWeight:500 }}>
            🟢 {bus.start_point} <span style={{ color:'var(--primary)' }}>→</span> 🔴 {bus.end_point}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {/* WebSocket connection dot */}
            <span title={connected ? 'Live' : 'Reconnecting'} style={{
              width:7, height:7, borderRadius:'50%', display:'inline-block',
              background: connected ? '#22c55e' : '#f59e0b',
              animation: connected ? 'blink 2s infinite' : 'none',
            }}/>
            <span className={`source-badge ${src.cls}`}>
              {isLive && <span className="live-dot"/>} {src.label}
            </span>
          </div>
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
          {bus.route_name}
          {lastSeen && <span style={{ marginLeft:8 }}>· Updated {Math.round((Date.now()-lastSeen)/1000)}s ago</span>}
        </div>
      </div>

      {/* Map */}
      <BusMap
        stops={bus.stops}
        busLat={liveLat}  busLng={liveLng}
        userLat={userLat} userLng={userLng}
        height={280} showNumbers
        highlightStopName={highlightStop}
      />

      {/* Notification */}
      <div className="notif-bar">
        <span>🔔</span>
        <div className="input-group" style={{ flex:1, margin:0 }}>
          <select value={notifStop} onChange={e => setNotifStop(e.target.value)} style={{ padding:'8px 12px', fontSize:13 }}>
            <option value="">Notify me at a stop...</option>
            {bus.stops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={handleNotif} style={{ background:'var(--primary)', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>Set</button>
      </div>

      {/* Crowdsource */}
      <div className="crowd-bar">
        {isCrowdsourcing ? (
          <div className="crowd-active">
            <span className="live-dot" style={{ width:10, height:10 }}/> Location Sharing 
            <button onClick={stopCrowdsource} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--danger)', fontWeight:700, cursor:'pointer', fontSize:12 }}>Stop</button>
          </div>
        ) : (
          <>
            <p>Help others by sharing your location</p>
            <button className="btn-secondary" style={{ fontSize:13, padding:'10px' }} onClick={startCrowdsource}>🚌 I'm on this bus</button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab==='eta'?'active':''}`} onClick={() => setActiveTab('eta')}>ETA & Stops</button>
        <button className={`tab ${activeTab==='schedule'?'active':''}`} onClick={() => setActiveTab('schedule')}>Schedule</button>
      </div>

      <div className="scroll-content" style={{ flex:1, overflowY:'auto', background:'var(--card-bg)' }}>
        {activeTab === 'eta' ? (
          <>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(0,0,0,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-dark)' }}>{bus.start_point} → {bus.end_point}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{bus.stops.length} stops</span>
            </div>

            {!isLive && (
              <div style={{ margin:'12px 16px', padding:'12px 14px', background:'rgba(148,163,184,0.10)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:10, display:'flex', alignItems:'flex-start', gap:10 }}>
                <span style={{ fontSize:20 }}>🕐</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-dark)', marginBottom:3 }}>No live tracking right now</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.5 }}>Bus position will appear once a driver starts their trip. Check the Schedule tab for departure times.</div>
                </div>
              </div>
            )}

            <div className="timeline" style={{ paddingBottom:24 }}>
              {bus.stops.map((stop, idx) => {
                const etaEntry  = etaList.find(e => e.name === stop.name);
                const isPassed  = etaEntry?.status === 'passed';
                const isCurrent = etaEntry?.status === 'arriving';
                const isFirst   = idx === 0;
                const isLast    = idx === bus.stops.length - 1;
                const isHL      = highlightStop && stop.name.toLowerCase().includes(highlightStop.toLowerCase());

                return (
                  <div key={stop.id} className="timeline-stop"
                       ref={isHL ? highlightRef : null}
                       style={isHL ? { background:'rgba(245,158,11,0.09)', borderRadius:10, padding:'2px 6px 2px 2px', marginRight:-6 } : {}}>
                    <div className="timeline-left">
                      {idx > 0 && <div className={`timeline-line ${(isPassed||isCurrent)?'passed':''}`}/>}
                      {isCurrent
                        ? <BusHereCircle/>
                        : <div className={`timeline-dot ${isPassed?'passed':isFirst?'start':isLast?'end':''}`}/>
                      }
                      {idx < bus.stops.length-1 && <div className={`timeline-line ${isPassed?'passed':''}`}/>}
                    </div>

                    <div className={`timeline-content ${isCurrent?'current-row':''}`}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                          {isFirst && <span className="stop-badge badge-start">START</span>}
                          {isLast  && <span className="stop-badge badge-end">END</span>}
                          <span className={`stop-name ${isPassed?'passed':''}`} style={isHL?{ color:'#92400e', fontWeight:700 }:{}}>
                            {stop.name}
                          </span>
                          {isHL && !isCurrent && (
                            <span style={{ background:'rgba(245,158,11,0.15)', color:'#b45309', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4, border:'1px solid rgba(245,158,11,0.35)', whiteSpace:'nowrap' }}>YOUR STOP</span>
                          )}
                        </div>

                        <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                          {isLive && isPassed  && <span style={{ fontSize:12, color:'var(--text-muted)' }}>Passed</span>}
                          {isLive && isCurrent && <span className="eta-badge eta-arriving">Arriving</span>}
                          {isLive && etaEntry?.status === 'upcoming' && (
                            <div>
                              <div className="stop-eta">{etaEntry.eta_minutes}</div>
                              <div className="stop-dist">min · {etaEntry.distance_km} km</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ): (
          <>
            <div style={{ padding:'14px 16px 4px', fontSize:13, color:'var(--text-muted)', fontWeight:500 }}>
              Departures from <span style={{ color:'var(--text-dark)', fontWeight:700 }}>{bus.start_point}</span>
            </div>
            <div className="schedule-grid">
              {bus.schedule.map((s,i) => <div key={i} className={`sched-chip ${s.status}`}>{s.time}</div>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
