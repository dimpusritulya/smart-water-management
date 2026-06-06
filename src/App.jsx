import React, { useState } from 'react';
import UsageGraph from './components/UsageGraph';
import AlertHistory from './components/AlertHistory';
import './App.css';

export default function App() {
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
    tankCapacity: "500 Liters",
    plumberContact: "98765 43210",
    buildingManager: "98765 11111"
  });

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

  return (
    <div className="app-container" style={{ paddingBottom: '80px' }}> {/* Padding prevents footer overlap */}
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 10px', boxSizing: 'border-box', marginBottom: '20px', marginTop: '20px' }}>
        <div className="header" style={{ textAlign: 'left', paddingBottom: '0' }}>
          <h1 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>Smart Water Dashboard</h1>
          <p style={{ margin: 0, color: '#64748b', textTransform: 'uppercase', fontSize: '0.9rem' }}>Monitoring: Apartment {profileData.apartment}</p>
        </div>
      </div>

      {/* NEW: Smart Leak Alert */}
      {dashboardData.alerts.leakDetected && (
        <div style={{ background: '#fee2e2', borderLeft: '6px solid #ef4444', padding: '16px', borderRadius: '8px', marginBottom: '24px', margin: '0 10px' }}>
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

        {/* 🛠️ TEMPORARY DEVELOPER SIMULATOR */}
      <div style={{ padding: '16px', background: '#f8fafc', border: '2px dashed #94a3b8', borderRadius: '8px', marginBottom: '20px', margin: '0 10px' }}>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#475569' }}>🛠️ Test Simulator: Override Hardware</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label style={{ fontWeight: 'bold' }}>Simulate Tank Level:</label>
          <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{dashboardData.sensorData.tankLevel}%</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={dashboardData.sensorData.tankLevel} 
          onChange={(e) => setDashboardData(prev => ({
            ...prev,
            sensorData: { ...prev.sensorData, tankLevel: parseInt(e.target.value) }
          }))}
          style={{ width: '100%', marginTop: '10px', cursor: 'pointer' }}
        />
      </div>

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
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', marginRight: '15px' }}>
                  {profileData.name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#1e293b' }}>{profileData.name}</h2>
                  <p style={{ margin: 0, color: '#64748b' }}>Resident • Apartment {profileData.apartment}</p>
                </div>
              </div>
              
              <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />
              
              <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: '15px' }}>System Info</h3>
              <p style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Tank Capacity:</span> <strong>{profileData.tankCapacity}</strong></p>
              <p style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>ESP32 Status:</span> <strong style={{ color: '#10b981' }}>Online</strong></p>

              <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

              <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: '15px' }}>Emergency Contacts</h3>
              <p style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Plumber:</span> <strong>{profileData.plumberContact}</strong></p>
              <p style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Building Manager:</span> <strong>{profileData.buildingManager}</strong></p>

              <button style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>
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