import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function LocationPermission() {
  const { grantLocation, user } = useApp();
  const navigate = useNavigate();

  const handleAllow = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          grantLocation();
          navigate(user?.role === 'driver' ? '/driver' : '/home');
        },
        () => {
          grantLocation();
          navigate(user?.role === 'driver' ? '/driver' : '/home');
        }
      );
    } else {
      grantLocation();
      navigate(user?.role === 'driver' ? '/driver' : '/home');
    }
  };

  const handleSkip = () => {
    navigate(user?.role === 'driver' ? '/driver' : '/home');
  };

  return (
    <div className="perm-screen">
      <div className="perm-icon">📍</div>
      <h2>Enable Location</h2>
      <p>NavBus uses your location to show nearby buses, calculate ETAs, and share your position when you're on a bus.</p>
      <button className="btn-primary" style={{ maxWidth: 300, marginTop: 8 }} onClick={handleAllow}>
        Allow Location Access
      </button>
      <button className="text-link" style={{ marginTop: 8 }} onClick={handleSkip}>
        Skip for now
      </button>
    </div>
  );
}
