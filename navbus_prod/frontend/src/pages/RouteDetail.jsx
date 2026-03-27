import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../utils/api';
import BusMap from '../components/BusMap';

export default function RouteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoute(id).then(setRoute).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="loading" style={{ minHeight: '100dvh' }}>
      <div className="spinner" />
    </div>
  );

  if (!route) return (
    <div className="empty-state" style={{ minHeight: '100dvh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="icon">🗺️</div>
      <p>Route not found</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="back-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <div style={{ flex: 1 }}>
          <h2>Route {route.id}</h2>
          <p>{route.route_name}</p>
        </div>
        <span style={{
          background: 'rgba(255,255,255,0.2)', color: '#fff',
          padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        }}>
          {route.stops.length} stops
        </span>
      </div>

      {/* Full-route map — no buses shown here */}
      <BusMap stops={route.stops} height={260} showNumbers />

      {/* Route endpoints summary card */}
      <div style={{
        background: 'var(--card-bg)', margin: '12px 16px 0',
        borderRadius: 14, padding: '12px 16px',
        boxShadow: 'var(--card-shadow)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Start</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
            🟢 {route.start_point}
          </div>
        </div>
        <div style={{ fontSize: 22, color: 'var(--text-muted)', padding: '0 8px' }}>→</div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>End</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>
            🔴 {route.end_point}
          </div>
        </div>
      </div>

      {/* Stops timeline only — no buses section */}
      <div className="scroll-content" style={{ flex: 1, overflowY: 'auto', paddingBottom: 28 }}>
        <div className="section-title">📍 All Stops ({route.stops.length})</div>

        <div style={{
          background: 'var(--card-bg)',
          margin: '0 16px 24px',
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: 'var(--card-shadow)',
        }}>
          {route.stops.map((stop, idx) => {
            const isFirst = idx === 0;
            const isLast  = idx === route.stops.length - 1;
            return (
              <div className="timeline-stop" key={stop.id}>
                <div className="timeline-left">
                  {idx > 0 && <div className="timeline-line" />}
                  <div className={`timeline-dot ${isFirst ? 'start' : isLast ? 'end' : ''}`} />
                  {!isLast && <div className="timeline-line" />}
                </div>
                <div className="timeline-content" style={{
                  paddingBottom: isLast ? 0 : 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {isFirst && <span className="stop-badge badge-start">START</span>}
                    {isLast  && <span className="stop-badge badge-end">END</span>}
                    <span className="stop-name">{stop.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
                                 flexShrink: 0, marginLeft: 8 }}>
                    #{stop.order}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
