import { useEffect, useRef, useState } from 'react';
import { getMapStyle } from '../utils/api';

/* Inject the Google Maps script once, using the key from .env */
let _gmapsPromise = null;
function loadGoogleMaps() {
  if (_gmapsPromise) return _gmapsPromise;
  _gmapsPromise = new Promise((resolve) => {
    if (window.google?.maps) { resolve(true); return; }
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!key || key === 'YOUR_GOOGLE_MAPS_KEY_HERE') { resolve(false); return; }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
    s.async = true; s.defer = true;
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return _gmapsPromise;
}

export default function BusMap({
  stops = [],
  busLat, busLng,
  userLat, userLng,
  height = 260,
  highlightStopIdx  = null,
  highlightStopName = null,
  showNumbers = true,
}) {
  const mapRef       = useRef(null);
  const mapObjRef    = useRef(null);
  const markersRef   = useRef([]);
  const polyRef      = useRef(null);
  const busMarker    = useRef(null);
  const userMarker   = useRef(null);
  const [ready, setReady] = useState(false);
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    loadGoogleMaps().then(ok => {
      setHasKey(ok);
      setReady(ok);
    });
  }, []);

  /* Build / rebuild map when stops or highlights change */
  useEffect(() => {
    if (!ready || !mapRef.current || stops.length === 0) return;

    const center = stops[Math.floor(stops.length / 2)];
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: center.lat, lng: center.lng },
      zoom: 13,
      mapTypeId: 'roadmap',
      styles: getMapStyle(),
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });
    mapObjRef.current = map;

    /* Polyline */
    polyRef.current = new window.google.maps.Polyline({
      path: stops.map(s => ({ lat: s.lat, lng: s.lng })),
      geodesic: true,
      strokeColor: '#15a8cd',
      strokeOpacity: 0.88,
      strokeWeight: 4,
      map,
    });

    /* Stop markers */
    stops.forEach((stop, idx) => {
      const isFirst = idx === 0;
      const isLast  = idx === stops.length - 1;
      const byIdx   = idx === highlightStopIdx;
      const byName  = highlightStopName &&
        stop.name.toLowerCase().includes(highlightStopName.toLowerCase());
      const isHl    = byIdx || byName;

      const color = isHl    ? '#f59e0b'
                  : isFirst ? '#15a8cd'
                  : isLast  ? '#ef4444'
                  :           '#036ea7';

      const m = new window.google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map,
        title: stop.name,
        label: showNumbers
          ? { text: String(stop.order || idx + 1), color: '#fff', fontSize: '10px', fontWeight: 'bold' }
          : undefined,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: color, fillOpacity: 1,
          strokeColor: '#fff', strokeWeight: 2,
          scale: isHl ? 13 : 9,
        },
      });
      markersRef.current.push(m);

      if (byName) { map.panTo({ lat: stop.lat, lng: stop.lng }); map.setZoom(15); }
    });

    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      polyRef.current?.setMap(null);
      busMarker.current?.setMap(null);
      userMarker.current?.setMap(null);
      mapObjRef.current = null;
    };
  }, [stops.length, ready, highlightStopName, highlightStopIdx]);

  /* Live bus position */
  useEffect(() => {
    if (!ready || !mapObjRef.current || !busLat || !busLng) return;
    busMarker.current?.setMap(null);
    busMarker.current = new window.google.maps.Marker({
      position: { lat: busLat, lng: busLng },
      map: mapObjRef.current,
      title: 'Bus',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#22c55e" width="36" height="36"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>'),
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 16),
      },
    });
    mapObjRef.current.panTo({ lat: busLat, lng: busLng });
  }, [busLat, busLng, ready]);

  /* User position */
  useEffect(() => {
    if (!ready || !mapObjRef.current || !userLat || !userLng) return;
    userMarker.current?.setMap(null);
    userMarker.current = new window.google.maps.Marker({
      position: { lat: userLat, lng: userLng },
      map: mapObjRef.current,
      title: 'You',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#3b82f6', fillOpacity: 1,
        strokeColor: '#fff', strokeWeight: 3, scale: 8,
      },
    });
  }, [userLat, userLng, ready]);

  /* Placeholder when no key is provided */
  if (!hasKey) {
    return (
      <div className="map-container map-placeholder" style={{ height }}>
        <span>🗺️</span>
        <p style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: 13 }}>Map Preview</p>
        <p style={{ fontSize: 11 }}>
          Add your key to{' '}
          <code style={{ background: 'rgba(0,0,0,0.08)', padding: '2px 6px', borderRadius: 4 }}>
            frontend/.env
          </code>
        </p>
      </div>
    );
  }

  return <div ref={mapRef} className="map-container" style={{ height }} />;
}
