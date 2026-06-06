import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig"; // This links your specific database keys!
import { ref, get } from "firebase/database";
import { db } from "./firebaseConfig";
import Login from "./components/Login";
import SignupPage from './components/SignupPage';
import UsageGraph from './components/UsageGraph';
import AlertHistory from './components/AlertHistory';
import './App.css';

export default function App() {

  // --- AUTHENTICATION STATE ---
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showLogin, setShowLogin] = useState(true); 


  // --- THE UPGRADED BOUNCER (Auth Guard & Data Fetcher) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser); 
      
      if (currentUser) {
        // The user logged in! Let's fetch their specific profile data.
        const profileRef = ref(db, 'users/' + currentUser.uid + '/profile');
        const snapshot = await get(profileRef);
        
        if (snapshot.exists()) {
          // Overwrite the hardcoded state with their real database info!
          setProfileData(snapshot.val());
        } else {
          console.log("No profile data found in database for this user.");
        }
      }
      
      setIsCheckingAuth(false); // Stop the loading screen
    });
    return () => unsubscribe();
  }, []);
  
  
  // 1. Navigation State
  const [activeTab, setActiveTab] = useState('controls'); // 'controls', 'sensors', 'analytics', 'profile'

  // 2. Main Dashboard Data (Added leak severity)
  const [dashboardData, setDashboardData] = useState({
    controls: { valveOpen: true, pumpStatus: "OFF" },
    sensorData: { flowRate: 0, phLevel: 7.2, tankLevel: 85 },
    alerts: { leakDetected: true, leakSeverity: 'High' } // Set to true to see the new alert UI!
  });

  // 3. User Profile Data
  const [profileData, setProfileData] = useState({
    name: "Uppalapati Dimpu Sritulya",
    apartment: "101",
    tankCapacity: "500",
    plumberContact: "98765 43210",
    buildingManager: "98765 11111"
  });

  // NEW: State to track if we are in "Edit Mode"
  const [isEditingProfile, setIsEditingProfile] = useState(false);


  const handleLogout = () => {
    signOut(auth).then(() => {
      console.log("User successfully signed out.");
      // We deleted window.location.reload() because React handles it automatically now!
    }).catch((error) => {
      console.error("Error signing out: ", error);
    });
  };

  // 4. Helper Functions
  const toggleValve = () => {
    setDashboardData(prev => ({
      ...prev,
      controls: { ...prev.controls, valveOpen: !prev.controls.valveOpen }
    }));
  };

  const togglePump = () => {
    setDashboardData(prev => ({
      ...prev,
      controls: { ...prev.controls, pumpStatus: prev.controls.pumpStatus === "ON" ? "OFF" : "ON" }
    }));
  };

  // Handles typing in the profile inputs
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  // Handles clicking the "Save" button
  const handleSaveProfile = () => {
    // TODO: We will add the Firebase push code here in the next step!
    console.log("Saving new profile data to database:", profileData);
    setIsEditingProfile(false); // Turn off edit mode
  };


  const weeklyData = [120, 135, 100, 150, 90, 150, 160];
  const calculatedTotal = weeklyData.reduce((sum, currentDay) => sum + currentDay, 0);

  // NEW: Smart Auto-Shutoff Logic
  React.useEffect(() => {
    // If the pump is running AND the tank hits 100% (or higher)
    if (dashboardData.controls.pumpStatus === "ON" && dashboardData.sensorData.tankLevel >= 100) {
      
      // 1. Turn off the pump in the UI
      setDashboardData(prev => ({
        ...prev,
        controls: { ...prev.controls, pumpStatus: "OFF" }
      }));

      // 2. Trigger a notification so the user knows what happened
      alert("⚠️ Tank reached 100% capacity. Pump has been automatically shut off to prevent overflow.");
      
      // NOTE: In the live version, you will also send the "OFF" command to Firebase right here!
    }
  }, [dashboardData.sensorData.tankLevel, dashboardData.controls.pumpStatus]);


  // --- WEATHER & LOCATION STATES ---
  const [weatherAlert, setWeatherAlert] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // 1. SMART CHECK: Does the user already trust us?
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          fetchLocationAndWeather(); // Already trusted, fetch silently!
        } else if (result.state === 'prompt') {
          setShowLocationModal(true); // First time, show the soft popup!
        }
      }).catch(() => setShowLocationModal(true));
    } else {
      setShowLocationModal(true); // Fallback for older browsers like Safari
    }
  }, []);

  // 2. THE FORECAST FETCH LOGIC
  const fetchLocationAndWeather = () => {
    setShowLocationModal(false); // Hide the soft popup
    
    // This triggers the official browser prompt
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      
      try {
        // Securely pulling the key from the .env.local file!
        const apiKey = import.meta.env.VITE_OPENWEATHER_KEY;
        
        // Calling the FORECAST endpoint, not the current weather endpoint
        const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}`);
        const data = await res.json();
        
        // data.list[0] is the exact forecast for the next 3-hour window
        const nextForecast = data.list[0];
        const weatherCode = nextForecast.weather[0].id; 
        
        // OpenWeather Codes: 2xx (Storms), 5xx (Rain), 80x (Clouds)
        if (weatherCode >= 200 && weatherCode < 600) {
          setWeatherAlert("🌧️ Rain or storms forecasted in the next 3 hours. Consider delaying manual pump refills to maximize rainwater harvesting.");
        } else if (weatherCode >= 801 && weatherCode <= 804) {
          setWeatherAlert("☁️ Heavy clouds forecasted in the next 3 hours. Consider refilling your tank now to avoid power-cut-related water shortages.");
        } else {
          setWeatherAlert(null); // Clear skies, hide the banner
        }
      } catch (err) {
        console.error("Failed to fetch forecast.", err);
      }
    }, (err) => {
      console.log("User denied location access.", err);
      setShowLocationModal(false); // Fails gracefully without breaking the app
    });
  };



  // If Firebase is still thinking, show a blank/loading screen
  if (isCheckingAuth) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  // If no user is logged in, toggle between Login and Signup!
  if (!user) {
    if (showLogin) {
      // Pass a function to switch to Signup
      return <Login onSwitchView={() => setShowLogin(false)} />; 
    } else {
      // Pass a function to switch back to Login
      return <SignupPage onSwitchView={() => setShowLogin(true)} />; 
    }
  }


  // Your actual working dashboard code starts here:

  return (
    <div className="app-container" style={{ paddingBottom: '80px' }}> {/* Padding prevents footer overlap */}

    {/* --- SOFT LOCATION POPUP --- */}
      {showLocationModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', maxWidth: '400px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📍</div>
            <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Smart Weather Alerts</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '25px', lineHeight: '1.5' }}>
              We use your location to predict rain and storms up to 3 hours in advance, helping you secure your water supply before potential power cuts.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setShowLocationModal(false)} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '8px', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>
                Not Now
              </button>
              <button onClick={fetchLocationAndWeather} style={{ padding: '10px 20px', border: 'none', background: '#3b82f6', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                Allow Location
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 10px', boxSizing: 'border-box', marginBottom: '20px', marginTop: '20px' }}>
        <div className="header" style={{ textAlign: 'left', paddingBottom: '0' }}>
          <h1 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>Smart Water Dashboard</h1>
          <p style={{ margin: 0, color: '#64748b', textTransform: 'uppercase', fontSize: '0.9rem' }}>Monitoring: Apartment {profileData.apartment}</p>
        </div>
      </div>

      {/* --- DYNAMIC WEATHER ALERT --- */}
      {weatherAlert && (
        <div style={{ background: '#e0f2fe', borderLeft: '6px solid #0284c7', padding: '15px', borderRadius: '8px', marginBottom: '30px', display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, color: '#0369a1', fontSize: '0.95rem', fontWeight: 'bold' }}>
            {weatherAlert}
          </p>
        </div>
      )}
      

      {/* NEW: Smart Leak Alert */}
      {dashboardData.alerts.leakDetected && (
        <div style={{ background: '#fee2e2', borderLeft: '6px solid #ef4444', padding: '16px', borderRadius: '8px', margin: '0 10px', marginTop: '20px', marginBottom: '30px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#b91c1c', display: 'flex', alignItems: 'center' }}>
            ⚠️ WARNING: Potential Pipeline Leak!
          </h3>
          <p style={{ margin: 0, color: '#991b1b', fontSize: '0.95rem' }}>
            {dashboardData.alerts.leakSeverity === 'High' 
              ? `Severe continuous flow detected while valves are closed. Suggestion: Shut off the main valve immediately and call your plumber (${profileData.plumberContact}).`
              : "Minor pressure drop detected. Please inspect visible pipes for dripping."}
          </p>
        </div>
      )}

      {/* --- TAB CONTENT RENDERING --- */}
      <main style={{ padding: '0 10px' }}>


        {/* TAB 1: CONTROLS */}
        {activeTab === 'controls' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#1e293b' }}>Main Supply Valve</h2>
              <p style={{ marginBottom: '16px', fontSize: '0.95rem' }}>
                Status: <span style={{ fontWeight: 'bold', color: dashboardData.controls.valveOpen ? '#10b981' : '#ef4444' }}>
                  {dashboardData.controls.valveOpen ? "OPEN (Flowing)" : "CLOSED (Shut Off)"}
                </span>
              </p>
              <div className="switch-container">
                <span style={{ color: '#64748b', fontWeight: 'bold', marginRight: '8px' }}>OFF</span>
                <label className="switch">
                  <input type="checkbox" checked={dashboardData.controls.valveOpen} onChange={toggleValve} />
                  <span className="slider"></span>
                </label>
                <span style={{ color: '#64748b', fontWeight: 'bold', marginLeft: '8px' }}>ON</span>
              </div>
            </div>

            <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: dashboardData.controls.pumpStatus === "ON" ? '2px solid #3b82f6' : 'none' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#1e293b' }}>Quick Refill</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>Turn your overhead water pump on or off remotely.</p>
              <p style={{ marginBottom: '20px', fontSize: '1rem' }}>
                Pump Status: <span style={{ fontWeight: 'bold', color: dashboardData.controls.pumpStatus === "ON" ? '#3b82f6' : '#64748b' }}>
                  {dashboardData.controls.pumpStatus === "ON" ? "RUNNING" : "STANDBY (Off)"}
                </span>
              </p>
              <button 
                onClick={togglePump}
                style={{ width: '100%', backgroundColor: dashboardData.controls.pumpStatus === "ON" ? '#ef4444' : '#3b82f6', color: 'white', padding: '16px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
              >
                {dashboardData.controls.pumpStatus === "ON" ? "Stop Refilling" : "Start Refilling"}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SENSORS */}
        {activeTab === 'sensors' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#1e293b' }}>Tank Level</h2>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>{dashboardData.sensorData.tankLevel}%</div>
              <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '999px', height: '24px', overflow: 'hidden' }}>
                <div style={{ width: `${dashboardData.sensorData.tankLevel}%`, backgroundColor: '#3b82f6', height: '100%' }}></div>
              </div>
            </div>

            <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#1e293b' }}>Water Quality</h2>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '5px' }}>pH: {dashboardData.sensorData.phLevel}</div>
              <div style={{ fontWeight: 'bold', color: '#10b981', marginBottom: '10px' }}>Safe & Neutral</div>
            </div>

            <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#1e293b' }}>Live Water Flow</h2>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#0ea5e9' }}>{dashboardData.sensorData.flowRate}</span>
                <span style={{ fontSize: '1.2rem', color: '#64748b', marginLeft: '5px' }}>L/min</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#1e293b' }}>Weekly Water Usage</h2>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Estimated Total</p>
                  <h2 style={{ margin: 0, color: '#3b82f6' }}>{calculatedTotal.toLocaleString()} <span style={{ fontSize: '1rem', color: '#64748b' }}>Liters</span></h2>
                </div>
              </div>
              <UsageGraph />
            </div>
            <AlertHistory />
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <div style={{ display: 'grid', gap: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              
              {/* Header with Edit/Save Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Resident Profile</h2>
                <button 
                  onClick={isEditingProfile ? handleSaveProfile : () => setIsEditingProfile(true)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: isEditingProfile ? '#10b981' : '#f1f5f9', color: isEditingProfile ? 'white' : '#334155' }}
                >
                  {isEditingProfile ? 'Save Changes' : 'Edit Profile'}
                </button>
              </div>
              
              <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', marginBottom: '20px' }} />

              {/* Dynamic Form / View Area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {/* Name */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 'bold', width: '40%' }}>Full Name:</span>
                  {isEditingProfile ? (
                    <input type="text" name="name" value={profileData.name} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  ) : (
                    <strong style={{ flex: 1, textAlign: 'right' }}>{profileData.name}</strong>
                  )}
                </div>

                {/* Apartment */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 'bold', width: '40%' }}>Apartment No:</span>
                  {isEditingProfile ? (
                    <input type="text" name="apartment" value={profileData.apartment} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  ) : (
                    <strong style={{ flex: 1, textAlign: 'right' }}>{profileData.apartment}</strong>
                  )}
                </div>

                {/* Tank Capacity */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 'bold', width: '40%' }}>Tank Capacity (L):</span>
                  {isEditingProfile ? (
                    <input type="number" name="tankCapacity" value={profileData.tankCapacity} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  ) : (
                    <strong style={{ flex: 1, textAlign: 'right' }}>{profileData.tankCapacity} Liters</strong>
                  )}
                </div>

                <hr style={{ border: '0', borderTop: '1px dashed #e2e8f0', margin: '10px 0' }} />

                {/* Plumber */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 'bold', width: '40%' }}>Plumber Contact:</span>
                  {isEditingProfile ? (
                    <input type="text" name="plumberContact" value={profileData.plumberContact} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  ) : (
                    <strong style={{ flex: 1, textAlign: 'right' }}>{profileData.plumberContact}</strong>
                  )}
                </div>

                {/* Building Manager */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 'bold', width: '40%' }}>Building Manager:</span>
                  {isEditingProfile ? (
                    <input type="text" name="buildingManager" value={profileData.buildingManager} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  ) : (
                    <strong style={{ flex: 1, textAlign: 'right' }}>{profileData.buildingManager}</strong>
                  )}
                </div>

              </div>

              {/* Leave your Sign Out button exactly as it was down here */}
              <button onClick={handleLogout} style={{ width: '100%', marginTop: '30px', padding: '12px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>
                Sign Out
              </button>

            </div>
          </div>
        )}

      </main>

      {/* --- BOTTOM NAVIGATION BAR --- */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '12px 10px',
        boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.05)',
        zIndex: 1000
      }}>
        {['controls', 'sensors', 'analytics', 'profile'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              color: activeTab === tab ? '#3b82f6' : '#94a3b8',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              transition: 'color 0.2s'
            }}
          >
            <span style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
              {tab === 'controls' && '🎛️'}
              {tab === 'sensors' && '💧'}
              {tab === 'analytics' && '📈'}
              {tab === 'profile' && '👤'}
            </span>
            <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{tab}</span>
          </button>
        ))}
      </div>

    </div>
  );
}
