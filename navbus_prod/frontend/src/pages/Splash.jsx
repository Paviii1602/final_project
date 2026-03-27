import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Splash() {
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();
  const { user, locationGranted } = useApp();

  useEffect(() => {
    const t = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        if (!user) navigate('/login');
        else if (!locationGranted) navigate('/location-permission');
        else navigate(user.role === 'driver' ? '/driver' : '/home');
      }, 700);
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`splash ${fadeOut ? 'fade-out' : ''}`}>
      {/* White rounded-square card — exactly like Image 5 */}
      <div style={{
        width: 110,
        height: 110,
        background: '#ffffff',
        borderRadius: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 40px rgba(0,0,0,0.20)',
        animation: 'bounce 1.6s ease infinite',
        marginBottom: 12,
      }}>
        {/*
          Front-facing bus icon — matches Image 5 exactly:
          dark teal (#1e5f74 / #1a5e72) simple front-view bus
          with two round headlights, flat windscreen, flat roof
        */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Bus body — main rectangle */}
          <rect x="8" y="10" width="48" height="38" rx="7" fill="#1a607a"/>

          {/* Roof / top strip — slightly darker */}
          <rect x="8" y="10" width="48" height="11" rx="7" fill="#134e64"/>
          {/* Cover the bottom corners of roof strip */}
          <rect x="8" y="17" width="48" height="4" fill="#134e64"/>

          {/* Windscreen — large light rectangle */}
          <rect x="13" y="13" width="38" height="11" rx="3" fill="#a8d8e8"/>

          {/* Body lower panel */}
          <rect x="8" y="34" width="48" height="8" rx="2" fill="#134e64" opacity="0.5"/>

          {/* Front grille — horizontal slats */}
          <rect x="20" y="36" width="24" height="2.5" rx="1.25" fill="#0d3e50"/>
          <rect x="24" y="39.5" width="16" height="2" rx="1" fill="#0d3e50"/>

          {/* Left headlight */}
          <circle cx="18" cy="43" r="5" fill="#134e64"/>
          <circle cx="18" cy="43" r="3.2" fill="#fde68a"/>
          <circle cx="18" cy="43" r="1.5" fill="#fbbf24"/>

          {/* Right headlight */}
          <circle cx="46" cy="43" r="5" fill="#134e64"/>
          <circle cx="46" cy="43" r="3.2" fill="#fde68a"/>
          <circle cx="46" cy="43" r="1.5" fill="#fbbf24"/>

          {/* Side mirrors */}
          <rect x="3" y="22" width="5" height="7" rx="2" fill="#134e64"/>
          <rect x="56" y="22" width="5" height="7" rx="2" fill="#134e64"/>

          {/* Door outline in centre */}
          <rect x="27" y="26" width="10" height="13" rx="2" fill="#0d3e50" opacity="0.45"/>

          {/* Bottom bumper */}
          <rect x="10" y="47" width="44" height="3" rx="1.5" fill="#0d3e50"/>
        </svg>
      </div>

      <h1 style={{
        color: '#ffffff',
        fontSize: 40,
        fontWeight: 800,
        letterSpacing: -1,
        margin: 0,
      }}>
        NavBus
      </h1>

      <p style={{
        color: 'rgba(255,255,255,0.72)',
        fontSize: 12,
        fontWeight: 400,
        letterSpacing: 3.5,
        textTransform: 'uppercase',
        marginTop: 6,
      }}>
        Track Your Bus
      </p>
    </div>
  );
}
