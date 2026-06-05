import { useState, useEffect } from 'react';
import { database } from './firebaseConfig';
import { ref, onValue, set } from 'firebase/database';
import { FaWater, FaTint, FaTachometerAlt, FaExclamationTriangle, FaCloudShowersHeavy } from 'react-icons/fa';
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
  
  // New state to hold weather warnings
  const [weatherAlert, setWeatherAlert] = useState("");

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

  // 2. Fetch Future Weather Forecast for Vijayawada
  useEffect(() => {
    const checkWeather = async () => {
      try {
        const apiKey = '80ec7cdea5572775cae90e17cefee865'; 
        // CHANGED: Using the 'forecast' endpoint instead of 'weather'
        const url = `https://api.openweathermap.org/data/2.5/forecast?q=Vijayawada&appid=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        // CHANGED: Look at the first item in the forecast list (the next 3 hours)
        const upcomingCondition = data.list[0].weather[0].main; 
        
        // We only want to alert for severe approaching weather
        const alertConditions = ["Rain", "Thunderstorm"];
        
        if (alertConditions.includes(upcomingCondition)) {
          setWeatherAlert(`Approaching Storm Alert (${upcomingCondition} expected soon). Refill your tank now to prepare for potential wind-induced power cuts.`);
        }
      } catch (error) {
        console.error("Could not fetch weather forecast", error);
      }
    };
    
    checkWeather();
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

      {/* Emergency Leak Alert */}
      {alerts.leakDetected && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
          <FaExclamationTriangle style={{ marginRight: '10px' }} />
          WARNING: Potential water leak detected in your pipeline!
        </div>
      )}

      {/* Weather Predictive Alert */}
      {weatherAlert && (
        <div style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
          <FaCloudShowersHeavy style={{ marginRight: '10px' }} />
          {weatherAlert}
        </div>
      )}

      <main className="grid">
        {/* Card 1: Main Valve Control */}
        <div className="card">
          <h2>Main Supply Valve</h2>
          <p>Status: <span style={{ fontWeight: 'bold', color: controls.valveOpen ? '#28a745' : '#dc3545' }}>
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
          <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '10px', height: '20px', overflow: 'hidden' }}>
            <div style={{ width: `${sensorData.tankLevel}%`, backgroundColor: sensorData.tankLevel < 20 ? '#ef4444' : '#3b82f6', height: '100%', transition: 'width 0.5s ease-in-out' }}></div>
          </div>
          {sensorData.tankLevel < 20 && <p style={{ color: '#ef4444', marginTop: '10px', fontSize: '0.9rem' }}>Tank level is critically low.</p>}
        </div>

        {/* Card 3: Water Quality */}
        <div className="card">
          <h2><FaTint color={quality.color} style={{ marginRight: '8px' }} /> Water Quality</h2>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: '#1e293b' }}>pH: {sensorData.phLevel.toFixed(1)}</h1>
          <p style={{ fontWeight: 'bold', color: quality.color }}>{quality.status}</p>
          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{quality.message}</p>
        </div>

        {/* --- NEW REMINDERS PANEL --- */}
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