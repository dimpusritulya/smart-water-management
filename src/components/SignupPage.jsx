import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { FaWater, FaLock, FaEnvelope, FaUser, FaBuilding, FaDatabase, FaEye, FaEyeSlash } from 'react-icons/fa';
import { ref, set } from "firebase/database";
import { db } from "../firebaseConfig"; // Make sure this path is correct!

function SignupPage({ onSwitchView }) {
  // 1. Account States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 2. Profile Data States
  const [name, setName] = useState('');
  const [apartment, setApartment] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  
  // 3. UI States
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Controls the Eye Icon

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      // Step 1: Create the secure login credentials
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Step 2: Push the profile data to the Realtime Database!
      await set(ref(db, 'users/' + user.uid + '/profile'), {
        name: name,
        apartment: apartment,
        tankCapacity: tankCapacity,
        plumberContact: "Not provided yet", // Default placeholder
        buildingManager: "Not provided yet" // Default placeholder
      });

      console.log("Success! Account and Profile created.");

    } catch (err) {
      // Make Firebase errors slightly more user-friendly
      if (err.code === 'auth/email-already-in-use') setError('This email is already registered.');
      else if (err.code === 'auth/weak-password') setError('Password should be at least 6 characters.');
      else setError('Failed to create account. Please try again.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f4f8', padding: '20px' }}>
      <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '40px 30px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#e0f2fe', padding: '15px', borderRadius: '50%' }}>
            <FaWater size={40} color="#3b82f6" />
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
          
          {/* PROFILE DATA SECTIONS */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <FaUser style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
              <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
            </div>
            <div style={{ position: 'relative', flex: 1 }}>
              <FaBuilding style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
              <input type="text" placeholder="Apt No." value={apartment} onChange={(e) => setApartment(e.target.value)} style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <FaDatabase style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
            <input type="number" placeholder="Tank Capacity (in Liters)" value={tankCapacity} onChange={(e) => setTankCapacity(e.target.value)} style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '5px 0' }} />

          {/* ACCOUNT CREDENTIALS */}
          <div style={{ position: 'relative' }}>
            <FaEnvelope style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
          </div>
          
          <div style={{ position: 'relative' }}>
            <FaLock style={{ position: 'absolute', top: '14px', left: '15px', color: '#94a3b8' }} />
            
            {/* The type dynamically switches based on showPassword state */}
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Create Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 45px 12px 45px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              required 
            />
            
            {/* The Eye Icon Button */}
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', top: '12px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
            >
              {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
            </button>
          </div>

          <button type="submit" style={{ backgroundColor: '#10b981', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
            Complete Setup
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: '#64748b' }}>
             Already have an account? <span onClick={onSwitchView} style={{ color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}>Sign In</span>
        </p>

      </div>
    </div>
  );
}

export default SignupPage;