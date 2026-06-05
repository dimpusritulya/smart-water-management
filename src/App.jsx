import { useState, useEffect } from 'react';
import { database } from './firebaseConfig';
import { ref, onValue, set } from 'firebase/database';
import { FaWater, FaTint, FaTachometerAlt, FaExclamationTriangle, FaCloudShowersHeavy, FaMapMarkerAlt } from 'react-icons/fa';
import FlowGraph from './components/FlowGraph';
import RemindersPanel from './components/RemindersPanel';
import AlertHistory from './components/AlertHistory';
import './App.css';

function App() {
  const userId = "user_apt_101";
  
  const [dashboardData, setDashboardData] = useState({
    controls: { valveOpen: true },
    sensorData: { flowRate: 0, phLevel: 7.0, tankLevel: 0 },
    alerts: { leakDetected: false }
  });
  
  const [weatherAlert, setWeatherAlert] = useState("");
  // New state to track if we should show the location explanation banner
  const [locationStatus, setLocationStatus] = useState("idle");

  // 1. Listen for Firebase Data
  useEffect(() => {
    const userRef = ref(database, `users/${userId}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDashboardData(prevState => ({ ...prevState, ...data }));
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Weather Fetch Logic
  const fetchWeather = async (lat, lon) => {
    try {
      const apiKey = '80ec7cdea5572775cae90e17cefee865'; 
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const cityName = data.city.name;
      const upcomingCondition = data.list[0].weather[0].main; 
      
      const alertConditions = ["Rain", "Thunderstorm"];
      
      if (alertConditions.includes(upcomingCondition)) {
        setWeatherAlert(`Approaching Storm Alert for ${cityName} (${upcomingCondition} expected). Refill your tank now to prepare for potential power cuts.`);
      }
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
    const valveRef = ref(database, `users/${userId}/controls/valveOpen`);
    set(valveRef, !dashboardData.controls.valveOpen);
  };

  const getWaterQualityInfo = (ph) => {
    if (ph < 6.5) return { status: "Acidic - Unsafe", color: "red", message: "Corrosive. Not safe for skin contact." };
    if (ph > 8.5) return { status: "Alkaline - Unsafe", color: "red", message: "Hard/Basic. May cause skin irritation." };
    return { status: "Safe & Neutral", color: "green", message: "Water is safe for household use." };
  };

  const { controls, sensorData, alerts } = dashboardData;
  const quality = getWaterQualityInfo(sensorData.phLevel);

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>Smart Water Dashboard</h1>
        <p>Monitoring: Apartment 101</p>
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

      <main className="grid">
        {/* Card 1: Main Valve Control */}
        <div className="card">
          <h2>Main Supply Valve</h2>
          <p>Status: <span style={{ fontWeight: 'bold', color: controls.valveOpen ? '#10b981' : '#ef4444' }}>
            {controls.valveOpen ? "OPEN (Flowing)" : "CLOSED (Shut Off)"}
          </span></p>
          
          <div className="switch-container">
            <span style={{ color: '#64748b', fontWeight: 'bold' }}>OFF</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={controls.valveOpen} 
                onChange={toggleValve} 
              />
              <span className="slider"></span>
            </label>
            <span style={{ color: '#64748b', fontWeight: 'bold' }}>ON</span>
          </div>
        </div>

        {/* Card 2: Tank Level */}
        <div className="card">
          <h2><FaWater color="#3b82f6" style={{ marginRight: '8px' }} /> Tank Level</h2>
          <h1 style={{ fontSize: '3rem', margin: '10px 0', color: '#1e293b' }}>{sensorData.tankLevel}%</h1>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${sensorData.tankLevel}%`, backgroundColor: sensorData.tankLevel < 20 ? '#ef4444' : '#3b82f6' }}></div>
          </div>
          {sensorData.tankLevel < 20 && <p style={{ color: '#ef4444', marginTop: '10px', fontSize: '0.9rem', fontWeight: 'bold' }}>Tank level is critically low.</p>}
        </div>

        {/* Card 3: Water Quality */}
        <div className="card">
          <h2><FaTint color={quality.color} style={{ marginRight: '8px' }} /> Water Quality</h2>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: '#1e293b' }}>pH: {sensorData.phLevel.toFixed(1)}</h1>
          <p style={{ fontWeight: 'bold', color: quality.color }}>{quality.status}</p>
          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{quality.message}</p>
        </div>

        {/* --- REMINDERS PANEL --- */}
        <RemindersPanel />

        {/* Card 4: Flow Rate & History */}
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