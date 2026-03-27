import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

/* Shared input style — 16px prevents iOS auto-zoom */
const inp = {
  width: '100%', padding: '13px 16px', fontSize: 16,
  fontFamily: 'Poppins, sans-serif',
  border: '1.5px solid var(--input-border)', borderRadius: 12,
  background: 'var(--card-bg)', color: 'var(--text-dark)',
  outline: 'none', WebkitAppearance: 'none', appearance: 'none',
  boxSizing: 'border-box',
};

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const { login, locationGranted, showToast } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) { setError('Please enter both username and password'); return; }
    setLoading(true);
    try {
      const data = await api.login(u, p);
      login(data.user);
      showToast(`Welcome, ${data.user.username}! 🚌`);
      if (!locationGranted) navigate('/location-permission');
      else navigate(data.user.role === 'driver' ? '/driver' : '/home');
    } catch (e) {
      setError(e.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-blob" style={{ width:200, height:200, top:-60, left:-60 }}/>
      <div className="auth-blob" style={{ width:150, height:150, bottom:-40, right:-40 }}/>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
              <rect x="8" y="10" width="48" height="38" rx="7" fill="#1a607a"/>
              <rect x="8" y="10" width="48" height="11" rx="7" fill="#134e64"/>
              <rect x="8" y="17" width="48" height="4" fill="#134e64"/>
              <rect x="13" y="13" width="38" height="11" rx="3" fill="#a8d8e8"/>
              <rect x="8" y="34" width="48" height="8" rx="2" fill="#134e64" opacity="0.5"/>
              <circle cx="18" cy="43" r="5" fill="#134e64"/>
              <circle cx="18" cy="43" r="3.2" fill="#fde68a"/>
              <circle cx="18" cy="43" r="1.5" fill="#fbbf24"/>
              <circle cx="46" cy="43" r="5" fill="#134e64"/>
              <circle cx="46" cy="43" r="3.2" fill="#fde68a"/>
              <circle cx="46" cy="43" r="1.5" fill="#fbbf24"/>
            </svg>
          </div>
          <h2>NavBus</h2>
        </div>

        <h3>Welcome Back</h3>
        <p className="subtitle">Sign in to track your bus</p>

        <div className="input-group">
          <label>Username</label>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inp}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inp}
          />
        </div>

        {error && (
          <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                        borderRadius:10, padding:'10px 14px', marginBottom:14,
                        fontSize:13, color:'var(--danger)', lineHeight:1.5 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? (
            <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.4)',
                             borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite',
                             display:'inline-block' }}/>
              Signing in...
            </span>
          ) : 'Sign In'}
        </button>

        <div style={{ textAlign:'center', marginTop:12, fontSize:12, color:'var(--text-muted)',
                      background:'rgba(21,168,205,0.07)', borderRadius:8, padding:'8px 12px' }}>
          Demo — Passenger: <strong>passenger / pass123</strong><br/>
          Demo — Driver: <strong>driver / driver123</strong>
        </div>

        <div className="or-divider"><span>or</span></div>
        <div style={{ textAlign:'center' }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>New here? </span>
          <Link to="/register" style={{ color:'var(--primary)', fontWeight:600, fontSize:13 }}>
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('passenger');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const { login, locationGranted } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    const u = username.trim();
    const p = password.trim();
    if (!u)        { setError('Please enter a username'); return; }
    if (u.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!p)        { setError('Please enter a password'); return; }
    if (p.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const data = await api.register(u, p, role);
      login(data.user);
      if (!locationGranted) navigate('/location-permission');
      else navigate(role === 'driver' ? '/driver' : '/home');
    } catch (e) {
      setError(e.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-blob" style={{ width:180, height:180, top:-50, right:-50 }}/>
      <div className="auth-blob" style={{ width:130, height:130, bottom:-30, left:-30 }}/>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🚌</div>
          <h2>NavBus</h2>
        </div>
        <div></div>

        <h3>Create Account</h3>
        <p className="subtitle">Join NavBus to track buses in Vellore</p>

        <div style={{ marginBottom:16 }}>
          <div className="step-label">I am a</div>
          <div className="role-toggle">
            <button className={`role-btn ${role==='passenger'?'active':''}`} onClick={() => setRole('passenger')}>🧑 Passenger</button>
            <button className={`role-btn ${role==='driver'?'active':''}`}    onClick={() => setRole('driver')}>🚌 Driver</button>
          </div>
        </div>

        <div className="input-group">
          <label>Username</label>
          <input
            type="text"
            placeholder="Choose a username (min 3 chars)"
            value={username}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            onChange={e => setUsername(e.target.value)}
            style={inp}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="At least 6 characters"
            value={password}
            autoComplete="new-password"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inp}
          />
        </div>

        {error && (
          <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                        borderRadius:10, padding:'10px 14px', marginBottom:14,
                        fontSize:13, color:'var(--danger)', lineHeight:1.5 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <div className="or-divider"><span>or</span></div>
        <div style={{ textAlign:'center' }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>Already have an account? </span>
          <Link to="/login" style={{ color:'var(--primary)', fontWeight:600, fontSize:13 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
