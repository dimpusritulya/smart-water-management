import React, { useState } from 'react';
import { auth, database } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { FaWater, FaLock, FaEnvelope } from 'react-icons/fa';

function Signup({ onSwitchView }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      // 1. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // 2. Automatically build their starter database folder
      const userRef = ref(database, `users/${newUser.uid}`);
      await set(userRef, {
        controls: { valveOpen: true },
        sensorData: { flowRate: 0, phLevel: 7.0, tankLevel: 100 },
        alerts: { leakDetected: false }
      });

    } catch (err) {
      if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '40px 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#dcfce3', padding: '15px', borderRadius: '50%' }}>
            <FaWater size={40} color="#10b981" />
          </div>
        </div>
        
        <h2 style={{ fontSize: '1.8rem', color: '#1e293b', marginBottom: '5px', textAlign: 'center' }}>Create Account</h2>
        <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '30px', fontSize: '0.9rem' }}>Set up your smart water dashboard</p>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '20px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ position: 'relative' }}>
            <FaEnvelope style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }}
              required 
            />
          </div>
          
          <div style={{ position: 'relative' }}>
            <FaLock style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
            <input 
              type="password" 
              placeholder="Create Password (Min 6 chars)" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }}
              required 
            />
          </div>

          <button type="submit" style={{ backgroundColor: '#10b981', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: '0.2s' }}>
            Create Account
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: '#64748b' }}>
          Already have an account? <span onClick={onSwitchView} style={{ color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}>Log In</span>
        </p>
      </div>
    </div>
  );
}

export default Signup;