import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, getEtaLabel, getSourceBadge } from '../utils/api';
import BusMap from '../components/BusMap';

export default function SearchResults() {
  const [params] = useSearchParams();
  const from = params.get('from');
  const to   = params.get('to');
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (from && to) api.searchStops(from, to).then(setResults).finally(() => setLoading(false));
  }, [from, to]);

  const totalBuses   = results.reduce((a, r) => a + r.buses.length, 0);
  /* Full-route stops for the polyline; segment stops for context */
  const mapStops     = results[0]?.all_stops || results[0]?.stops || [];

  /* Tap a bus → go to BusTracking and highlight the TO stop */
  const goToBus = (busId) =>
    navigate(`/bus/${busId}?highlight=${encodeURIComponent(to)}`);

  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div className="back-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:15 }}>{from} → {to}</h2>
          <p>{totalBuses} bus{totalBuses !== 1 ? 'es' : ''} found</p>
        </div>
      </div>

      <div className="scroll-content" style={{ flex:1, overflowY:'auto' }}>

        {/* Map — full route polyline, FROM stop highlighted amber */}
        <BusMap
          stops={mapStops}
          height={260}
          showNumbers={true}
          highlightStopName={from}
        />

        {loading ? (
          <div className="loading"><div className="spinner"/></div>

        ) : results.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🚍</div>
            <p style={{ fontWeight:600, color:'var(--text-dark)' }}>No buses found</p>
            <p style={{ fontSize:12, marginTop:6 }}>Try selecting different stops</p>
          </div>

        ) : (
          <>
            {/* ── Buses on this route ── */}
            <div className="section-title">🚌 Buses on this route</div>

            {results.map(result => result.buses.map(bus => {
              const eta = getEtaLabel(bus.eta);
              const src = getSourceBadge(bus.source_type);
              return (
                <div className="card" key={bus.id} onClick={() => goToBus(bus.id)}
                     style={{ cursor:'pointer' }}>
                  <div className="card-row">
                    <div>
                      <div className="bus-name">{bus.name}</div>
                      <div style={{ marginTop:4 }}>
                        <span className={`source-badge ${src.cls}`}>
                          {bus.is_active && <span className="live-dot"/>} {src.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                      <span className="bus-num-badge">{bus.bus_number}</span>
                      <span className={`eta-badge ${eta.cls}`}>{eta.label}</span>
                    </div>
                  </div>

                  {bus.next_departure && (
                    <div style={{ marginTop:8, fontSize:12, color:'var(--text-muted)' }}>
                      Next departure:{' '}
                      <span style={{ color:'var(--primary)', fontWeight:600 }}>{bus.next_departure}</span>
                    </div>
                  )}

                  {/* Hint that tapping reveals the highlighted stop */}
                  <div style={{ marginTop:6, fontSize:11, color:'var(--text-muted)',
                                display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'var(--warning)' }}>📍</span>
                    <span>Tap to see <strong style={{ color:'var(--warning)' }}>{to}</strong> highlighted in ETA &amp; Stops</span>
                  </div>
                </div>
              );
            }))}
          </>
        )}
      </div>
    </div>
  );
}
