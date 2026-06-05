import { auth } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './components/Login';
import Signup from './components/SignupPage'; 
import { useState, useEffect } from 'react';
import { database } from './firebaseConfig';
import { ref, onValue, set } from 'firebase/database';
import { FaWater, FaTint, FaTachometerAlt, FaExclamationTriangle, FaCloudShowersHeavy, FaMapMarkerAlt } from 'react-icons/fa';
import FlowGraph from './components/FlowGraph';
import RemindersPanel from './components/RemindersPanel';
import AlertHistory from './components/AlertHistory';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [isLoginView, setIsLoginView] = useState(true);

  // Monitor login status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  
  
  const [dashboardData, setDashboardData] = useState({
    controls: { valveOpen: true, pumpStatus: "OFF" },
    sensorData: { flowRate: 0, phLevel: 7.0, tankLevel: 0 },
    alerts: { leakDetected: false }
  });
  
  const [weatherAlert, setWeatherAlert] = useState("");
  // New state to track if we should show the location explanation banner
  const [locationStatus, setLocationStatus] = useState("idle");

// 1. Listen for Firebase Data dynamically based on logged-in user
  useEffect(() => {
    // Safety check: If no one is logged in yet, don't try to fetch data
    if (!user) return; 

    // Look at the specific folder for THIS logged-in user
    const userRef = ref(database, `users/${user.uid}`);
    
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDashboardData(prevState => ({ ...prevState, ...data }));
      }
    });
    
    return () => unsubscribe();
  }, [user]); // <-- Adding 'user' here tells React to run this again if a different person logs in

  // 2. Weather Fetch Logic (Upgraded for Probability and Wind)
  const fetchWeather = async (lat, lon) => {
    try {
      const apiKey = '80ec7cdea5572775cae90e17cefee865'; 
      // ADDED: &units=metric to easily calculate wind speeds
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const cityName = data.city.name;
      const forecast = data.list[0]; // The next 3-hour window
      
      const upcomingCondition = forecast.weather[0].main; 
      // 'pop' is a decimal (0 to 1), multiply by 100 to get a clean percentage
      const rainProbability = Math.round(forecast.pop * 100); 
      // Wind speed in m/s (10 m/s is roughly 36 km/h, enough to cause issues)
      const windSpeed = forecast.wind.speed; 

      // Thresholds: Only alert if it's ACTUALLY highly likely to happen
      const MIN_RAIN_PROBABILITY = 60; // Require at least a 60% chance of rain
      const HIGH_WIND_THRESHOLD = 10; // Require wind speeds over 10 m/s

      let newAlert = "";

      // 1. Check for High Winds FIRST (biggest cause of power cuts)
      if (windSpeed >= HIGH_WIND_THRESHOLD) {
        newAlert = `High Wind Warning for ${cityName} (${Math.round(windSpeed * 3.6)} km/h expected). Refill your tank now to prepare for wind-induced power cuts.`;
      }
      // 2. Check for Reliable Storms/Rain SECOND
      else if ((upcomingCondition === "Rain" || upcomingCondition === "Thunderstorm") && rainProbability >= MIN_RAIN_PROBABILITY) {
        newAlert = `Approaching Storm Alert for ${cityName} (${rainProbability}% chance of rain). Refill your tank now to prepare for potential power cuts.`;
      }
      // 3. Clear the alert if the weather is fine
      else {
        newAlert = "";
      }

      setWeatherAlert(newAlert);
    } catch (error) {
      console.error("Could not fetch weather forecast", error);
    }
  };

  // 3. The "Soft Prompt" Function triggered by the user
  const requestLocation = () => {
    setLocationStatus("asking");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationStatus("granted");
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error("User denied location access.", error);
          setLocationStatus("denied");
          // Fallback to a default location if they deny
          fetchWeather(16.5062, 80.6480); 
        }
      );
    }
  };

  // 4. Automatically check if they already granted permission in a previous session
  useEffect(() => {
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          requestLocation();
        }
      });
    }
  }, []);

  const toggleValve = () => {
    if (!user) return; // Safety check
    
    const valveRef = ref(database, `users/${user.uid}/controls/valveOpen`);
    set(valveRef, !dashboardData.controls.valveOpen);
  };

  const togglePump = () => {
    if (!user) return; // Safety check
    
    // Read the current state from dashboardData and flip it
    const newStatus = dashboardData.controls.pumpStatus === "ON" ? "OFF" : "ON";
    
    // Send the new status to Firebase
    const pumpRef = ref(database, `users/${user.uid}/controls/pumpStatus`);
    set(pumpRef, newStatus);
  };

  const getWaterQualityInfo = (ph) => {
    if (ph < 6.5) return { status: "Acidic - Unsafe", color: "red", message: "Corrosive. Not safe for skin contact." };
    if (ph > 8.5) return { status: "Alkaline - Unsafe", color: "red", message: "Hard/Basic. May cause skin irritation." };
    return { status: "Safe & Neutral", color: "green", message: "Water is safe for household use." };
  };

  const { controls, sensorData, alerts } = dashboardData;
  const quality = getWaterQualityInfo(sensorData.phLevel);

  // IF NOT LOGGED IN, SHOW LOGIN OR SIGNUP PAGE
  if (!user) {
    return isLoginView ? (
      <Login onSwitchView={() => setIsLoginView(false)} />
    ) : (
      <Signup onSwitchView={() => setIsLoginView(true)} />
    );
  }

  // IF LOGGED IN, SHOW DASHBOARD
  return (
    <div className="dashboard-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left' }}>
          <h1>Smart Water Dashboard</h1>
          <p>Monitoring: Apartment 101</p>
        </div>
        <button 
          onClick={() => signOut(auth)}
          style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Logout
        </button>
      </header>

      {/* --- NEW: The Soft Prompt Location Banner --- */}
      {locationStatus === "idle" && (
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '20px', borderRadius: '12px', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaMapMarkerAlt size={24} color="#22c55e" />
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Enable Smart Weather Alerts</h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#15803d', lineHeight: '1.5' }}>
            To accurately predict approaching storms in your area and warn you to refill your tank <strong>before</strong> wind-induced power cuts occur, this dashboard requires your location.
          </p>
          <button 
            onClick={requestLocation} 
            style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: 'fit-content', transition: '0.2s' }}
          >
            Allow Location Access
          </button>
        </div>
      )}

      {/* Emergency Leak Alert */}
      {alerts.leakDetected && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
          <FaExclamationTriangle style={{ marginRight: '10px' }} />
          WARNING: Potential water leak detected in your pipeline!
        </div>
      )}

      {/* Weather Predictive Alert */}
      {weatherAlert && (
        <div className="alert-banner" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
          <FaCloudShowersHeavy style={{ marginRight: '10px' }} />
          {weatherAlert}
        </div>
      )}

      <main className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '30px' }}>
          
          {/* Card 1: Main Supply Valve Control */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#1e293b' }}>Main Supply Valve</h2>
            <p style={{ marginBottom: '16px', fontSize: '0.95rem' }}>
              Status: <span style={{ fontWeight: 'bold', color: dashboardData.controls.valveOpen ? '#10b981' : '#ef4444' }}>
                {dashboardData.controls.valveOpen ? "OPEN (Water Flowing)" : "CLOSED (Shut Off)"}
              </span>
            </p>
            
            <div className="switch-container">
              <span style={{ color: '#64748b', fontWeight: 'bold', marginRight: '8px' }}>OFF</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={dashboardData.controls.valveOpen} 
                  onChange={toggleValve} 
                />
                <span className="slider"></span>
              </label>
              <span style={{ color: '#64748b', fontWeight: 'bold', marginLeft: '8px' }}>ON</span>
            </div>
          </div>

          {/* Card 2: Quick Refill Panel */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: dashboardData.controls.pumpStatus === "ON" ? '2px solid #3b82f6' : 'none', transition: 'all 0.3s' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#1e293b' }}>Quick Refill</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              Turn your overhead water pump on or off remotely.
            </p>
            
            <p style={{ marginBottom: '20px', fontSize: '1rem' }}>
              Pump Status: <span style={{ fontWeight: 'bold', color: dashboardData.controls.pumpStatus === "ON" ? '#3b82f6' : '#64748b' }}>
                {dashboardData.controls.pumpStatus === "ON" ? "RUNNING" : "STANDBY (Off)"}
              </span>
            </p>

            <button 
              onClick={togglePump}
              style={{ 
                width: '100%', 
                backgroundColor: dashboardData.controls.pumpStatus === "ON" ? '#ef4444' : '#3b82f6', 
                color: 'white', 
                padding: '16px', 
                borderRadius: '8px', 
                border: 'none', 
                fontWeight: 'bold', 
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgb(0 0 0 / 0.1)',
                transition: 'background-color 0.2s, transform 0.1s'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {dashboardData.controls.pumpStatus === "ON" ? "Stop Refilling" : "Start Refilling"}
            </button>
          </div>

          {/* Card 3: Tank Level */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#1e293b' }}>Tank Level</h2>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>
              {dashboardData.sensorData.tankLevel}%
            </div>
            <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '999px', height: '24px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${dashboardData.sensorData.tankLevel}%`, 
                backgroundColor: '#3b82f6', 
                height: '100%', 
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                backgroundSize: '1rem 1rem',
                transition: 'width 0.5s ease-in-out'
              }}></div>
            </div>
          </div>

          {/* Card 4: Water Quality */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#1e293b' }}>Water Quality</h2>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '5px' }}>
              pH: {dashboardData.sensorData.phLevel}
            </div>
            <div style={{ fontWeight: 'bold', color: dashboardData.sensorData.phLevel >= 6.5 && dashboardData.sensorData.phLevel <= 8.5 ? '#10b981' : '#ef4444', marginBottom: '10px' }}>
              {dashboardData.sensorData.phLevel >= 6.5 && dashboardData.sensorData.phLevel <= 8.5 ? 'Safe & Neutral' : 'Needs Attention'}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Water is safe for household use.</p>
          </div>

          {/* Card 5: Live Flow Rate */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#1e293b' }}>Live Water Flow</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>Current speed of water moving through the pipe.</p>
            
            <div style={{ marginTop: '10px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#0ea5e9' }}>
                {dashboardData.sensorData.flowRate}
              </span>
              <span style={{ fontSize: '1.2rem', color: '#64748b', marginLeft: '5px' }}>L/min</span>
            </div>
            <p style={{ marginTop: '15px', fontSize: '0.9rem', color: dashboardData.sensorData.flowRate > 0 ? '#10b981' : '#64748b', fontWeight: 'bold' }}>
              {dashboardData.sensorData.flowRate > 0 ? "● Water is Flowing" : "○ No Flow Detected"}
            </p>
          </div>

          {/* Card 6: Hardware Status */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#1e293b' }}>Hardware Status</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>ESP32 Microcontroller connection to cloud.</p>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '10px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '10px', boxShadow: '0 0 12px #10b981' }}></div>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>ONLINE</span>
            </div>
            <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#64748b' }}>
              Latency: ~45ms (Secure)
            </p>
          </div>

        {/* --- REMINDERS PANEL --- */}
        <RemindersPanel />

        {/* Card 7: Flow Rate & History */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2><FaTachometerAlt color="#64748b" style={{ marginRight: '8px' }} /> Weekly Water Usage</h2>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Current Flow</p>
              <h2 style={{ margin: 0, color: '#1e293b' }}>{sensorData.flowRate} <span style={{ fontSize: '1rem' }}>L/min</span></h2>
            </div>
          </div>
          <FlowGraph />
        </div>

        {/* System Alert History */}
        <AlertHistory />

      </main>
    </div>
  );
}

export default App;