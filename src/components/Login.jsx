import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { FaWater, FaLock, FaEnvelope, FaEye, FaEyeSlash } from 'react-icons/fa';

function Login({ onSwitchView })  {
  // --- STATE ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- FIREBASE AUTH SUBMISSION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    }
  };

  return (
    // Fixed the background color to respect Dark Mode
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '40px 30px', background: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#e0f2fe', padding: '15px', borderRadius: '50%' }}>
            <FaWater size={40} color="#3b82f6" />
          </div>
        </div>
        
        <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '5px', textAlign: 'center' }}>Welcome Back</h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '30px', fontSize: '0.9rem' }}>Enter your credentials to access the dashboard</p>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '20px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* EMAIL INPUT */}
          <div style={{ position: 'relative' }}>
            <FaEnvelope style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '1rem' }} required />
          </div>
          
          {/* PASSWORD INPUT */}
          <div style={{ position: 'relative' }}>
            <FaLock style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px 45px 12px 45px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '1rem' }} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', top: '14px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
              {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
            </button>
          </div>
          
          <button type="submit" style={{ backgroundColor: '#3b82f6', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: '0.2s' }}>
            Sign In to Dashboard
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
             Don't have an account? <span onClick={onSwitchView} style={{ color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}>Sign Up</span>
        </p>

      </div>
    </div>
  );
}

export default Login;