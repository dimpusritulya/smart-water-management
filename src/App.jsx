import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebaseConfig"; 
import { ref, update, onValue } from "firebase/database";
import Login from "./components/Login";
import SignupPage from './components/SignupPage';
import UsageGraph from './components/UsageGraph';
import AlertHistory from './components/AlertHistory';
import './App.css';

export default function App() {

  // ==========================================
  // 1. AUTHENTICATION & NAVIGATION STATE
  // ==========================================
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showLogin, setShowLogin] = useState(true); 
  const [activeTab, setActiveTab] = useState('controls'); // 'controls', 'sensors', 'analytics', 'profile'

  // ==========================================
  // 2. THEME STATE (DARK/LIGHT MODE)
  // ==========================================
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('smartWaterTheme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('smartWaterTheme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('smartWaterTheme', 'light');
    }
  }, [isDarkMode]);

  // ==========================================
  // 3. CORE DASHBOARD & PROFILE STATE
  // ==========================================
  const [dashboardData, setDashboardData] = useState({
    controls: { valveOpen: true, pumpStatus: "OFF" },
    sensorData: { flowRate: 0, phLevel: 7.2, tankLevel: 0 },
    alerts: { leakDetected: false, leakSeverity: 'Low' } 
  });

  const [profileData, setProfileData] = useState({
    name: "", apartment: "", tankCapacity: "", plumberContact: "", buildingManager: ""
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [reminders, setReminders] = useState([]);

  // ==========================================
  // 4. FIREBASE LISTENERS (THE BOUNCER)
  // ==========================================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); 
      
      if (currentUser) {
        // A. Listen for Profile Data
        const profileRef = ref(db, 'users/' + currentUser.uid + '/profile');
        onValue(profileRef, (snapshot) => {
          if (snapshot.exists()) {
            setProfileData(snapshot.val());        
          } else {
            setProfileData({ name: "Loading...", apartment: "...", tankCapacity: "...", plumberContact: "Not provided yet", buildingManager: "Not provided yet" });
          }
        });

        // B. Listen for Reminders Data & Calculate Due Dates
        const remindersRef = ref(db, 'users/' + currentUser.uid + '/reminders');
        onValue(remindersRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const today = new Date();

            const processedReminders = Object.keys(data).map(key => {
              const item = data[key];
              const lastDate = new Date(item.lastCompletedDate);
              const daysPassed = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
              const daysRemaining = item.frequencyInDays - daysPassed;
              const isOverdue = daysRemaining < 0;

              if (daysRemaining <= 14) {
                return {
                  id: key, title: item.title, overdue: isOverdue, completed: false,
                  desc: isOverdue ? `OVERDUE by ${Math.abs(daysRemaining)} days` : `Due in ${daysRemaining} days`
                };
              }
              return null; 
            }).filter(Boolean); 

            setReminders(processedReminders);
          } else {
            // Seed defaults for new accounts
            const initialReminders = {
              "task_tank": { title: "Overhead Tank Deep Cleaning", frequencyInDays: 180, lastCompletedDate: "2025-11-01T00:00:00Z" },
              "task_filter": { title: "Water Filter Recalibration", frequencyInDays: 90, lastCompletedDate: "2026-03-01T00:00:00Z" }
            };
            update(ref(db, 'users/' + currentUser.uid + '/reminders'), initialReminders);
          }
        });

        // C. Listen for Live Dashboard Data (Sensors, Controls, Alerts)
        const dashboardRef = ref(db, 'users/' + currentUser.uid);
        onValue(dashboardRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setDashboardData({
              controls: data.controls || { valveOpen: false, pumpStatus: "OFF" },
              sensorData: data.sensorData || { flowRate: 0, phLevel: 7.2, tankLevel: 0 },
              alerts: data.alerts || { leakDetected: false, leakSeverity: 'Low' }
            });
          }
        });
      }
      setIsCheckingAuth(false);
    });
    
    return () => unsubscribeAuth();
  }, []);

  // ==========================================
  // 5. HELPER FUNCTIONS & SMART LOGIC
  // ==========================================
  const handleLogout = () => signOut(auth).catch(err => console.error("Error signing out: ", err));

  const toggleValve = () => {
    setDashboardData(prev => ({ ...prev, controls: { ...prev.controls, valveOpen: !prev.controls.valveOpen } }));
  };

  const togglePump = () => {
    setDashboardData(prev => ({ ...prev, controls: { ...prev.controls, pumpStatus: prev.controls.pumpStatus === "ON" ? "OFF" : "ON" } }));
  };

  const handleProfileChange = (e) => setProfileData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSaveProfile = async () => {
    if (!user) return; 
    try {
      await update(ref(db, 'users/' + user.uid + '/profile'), profileData); 
      setIsEditingProfile(false); 
      alert("Profile updated successfully!");
    } catch (error) { alert("Failed to save profile updates."); }
  };

  const toggleReminder = (id) => {
    setReminders(prev => prev.map(rem => rem.id === id ? { ...rem, completed: true } : rem));
    setTimeout(async () => {
      if (user) await update(ref(db, `users/${user.uid}/reminders/${id}`), { lastCompletedDate: new Date().toISOString() });
    }, 600);
  };

  // Smart Auto-Shutoff Logic
  useEffect(() => {
    if (dashboardData.controls.pumpStatus === "ON" && dashboardData.sensorData.tankLevel >= 100) {
      setDashboardData(prev => ({ ...prev, controls: { ...prev.controls, pumpStatus: "OFF" } }));
      alert("⚠️ Tank reached 100% capacity. Pump has been automatically shut off to prevent overflow.");
    }
  }, [dashboardData.sensorData.tankLevel, dashboardData.controls.pumpStatus]);

  const weeklyData = [120, 135, 100, 150, 90, 150, 160];
  const calculatedTotal = weeklyData.reduce((sum, currentDay) => sum + currentDay, 0);

  // ==========================================
  // 6. WEATHER & LOCATION LOGIC (SAFARI FIXED)
  // ==========================================
  const [weatherAlert, setWeatherAlert] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [cityInput, setCityInput] = useState('');

  // A. The Smart Cache Check
  useEffect(() => {
    const userDecision = localStorage.getItem('smartWaterLocationPref');
    const cachedTime = localStorage.getItem('smartWaterWeatherTime');
    const now = new Date().getTime();

    if ((userDecision === 'allowed' || userDecision === 'manual') && cachedTime && (now - cachedTime < 7200000)) {
      // Data is fresh (under 2 hours), bypass API and GPS
      const cachedAlert = localStorage.getItem('smartWaterWeatherData');
      if (cachedAlert) setWeatherAlert(cachedAlert); 
    } 
    else if (userDecision === 'allowed') fetchLocationAndWeather();
    else if (userDecision !== 'dismissed') setShowLocationModal(true);
  }, []); 

  // B. Auto GPS Fetch (Live + 6-Hour Horizon)
  const fetchLocationAndWeather = () => {
    setShowLocationModal(false); 
    setShowCityModal(false);
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const apiKey = import.meta.env.VITE_OPENWEATHER_KEY;
      
      try {
        // DOUBLE-TAP: Fetch both Current conditions AND the Future forecast simultaneously
        const [currentRes, forecastRes] = await Promise.all([
          fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}`),
          fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}`)
        ]);
        
        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();
        let alertMessage = null;

        // Save City Name
        const cityName = currentData.name || forecastData.city.name;
        if (auth.currentUser) update(ref(db, `users/${auth.currentUser.uid}/profile`), { lat: latitude.toFixed(4), lon: longitude.toFixed(4), city: cityName });

        // --- 1. CHECK EXACTLY RIGHT NOW (Catches sudden pop-up storms like code 211) ---
        const liveCode = currentData.weather[0].id;
        const liveWind = currentData.wind.speed;

        if (liveCode >= 200 && liveCode <= 232) {
          alertMessage = "⚡ ACTIVE THUNDERSTORM: Severe storm currently overhead. High risk of power loss. Secure water supply immediately.";
        } else if ([502, 503, 504, 522, 531].includes(liveCode)) {
          alertMessage = "🌧️ ACTIVE TORRENTIAL RAIN: Grid instability risks detected. Ensure storage tank is filled.";
        } else if (liveWind >= 11) {
          alertMessage = `💨 SEVERE WINDS ACTIVE (${Math.round(liveWind * 3.6)} km/h). Pre-filling tank recommended.`;
        }

        // --- 2. IF SAFE RIGHT NOW, CHECK THE 6-HOUR FORECAST ---
        if (!alertMessage) {
          for (let i = 0; i < Math.min(2, forecastData.list.length); i++) {
            const fCode = forecastData.list[i].weather[0].id;
            const fWind = forecastData.list[i].wind.speed;

            if (fCode >= 200 && fCode <= 232) {
              alertMessage = "⚡ Thunderstorms approaching. High risk of lightning-induced power outages. Secure water supply."; break;
            } else if ([502, 503, 504, 522, 531].includes(fCode)) {
              alertMessage = "🌧️ Heavy torrential rain forecasted. Grid instability risks detected. Ensure storage tank is filled."; break;
            } else if (fWind >= 11) {
              alertMessage = `💨 Severe wind gusts forecasted (${Math.round(fWind * 3.6)} km/h). Pre-filling tank recommended.`; break;
            }
          }
        }

        // --- 3. SAVE AND UPDATE UI ---
        setWeatherAlert(alertMessage);
        localStorage.setItem('smartWaterLocationPref', 'allowed');
        localStorage.setItem('smartWaterWeatherTime', new Date().getTime());
        if (alertMessage) localStorage.setItem('smartWaterWeatherData', alertMessage);
        else localStorage.removeItem('smartWaterWeatherData');
        
      } catch (err) { console.error("Failed to fetch Live/Forecast data.", err); }
    }, () => {
      localStorage.setItem('smartWaterLocationPref', 'dismissed');
      setShowLocationModal(false);
    });
  };

  // C. Manual City Fetch (Live + 6-Hour Horizon)
  const fetchWeatherByCity = async (e) => {
    if (e) e.preventDefault();
    try {
      const apiKey = import.meta.env.VITE_OPENWEATHER_KEY;
      
      // Convert City to Coordinates
      const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${cityInput}&limit=1&appid=${apiKey}`);
      const geoData = await geoRes.json();
      if (geoData.length === 0) { alert("City not found. Please try again."); return; }
      
      const { lat, lon, name } = geoData[0];

      // DOUBLE-TAP: Fetch both Current and Future
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`)
      ]);
      
      const currentData = await currentRes.json();
      const forecastData = await forecastRes.json();
      let alertMessage = null;

      // --- 1. CHECK EXACTLY RIGHT NOW ---
      const liveCode = currentData.weather[0].id;
      const liveWind = currentData.wind.speed;

      if (liveCode >= 200 && liveCode <= 232) {
        alertMessage = "⚡ ACTIVE THUNDERSTORM: Severe storm currently overhead. High risk of power loss. Secure water supply immediately.";
      } else if ([502, 503, 504, 522, 531].includes(liveCode)) {
        alertMessage = "🌧️ ACTIVE TORRENTIAL RAIN: Grid instability risks detected. Ensure storage tank is filled.";
      } else if (liveWind >= 11) {
        alertMessage = `💨 SEVERE WINDS ACTIVE (${Math.round(liveWind * 3.6)} km/h). Pre-filling tank recommended.`;
      }

      // --- 2. IF SAFE RIGHT NOW, CHECK FORECAST ---
      if (!alertMessage) {
        for (let i = 0; i < Math.min(2, forecastData.list.length); i++) {
          const fCode = forecastData.list[i].weather[0].id;
          const fWind = forecastData.list[i].wind.speed;

          if (fCode >= 200 && fCode <= 232) {
            alertMessage = "⚡ Thunderstorms approaching. High risk of lightning-induced power outages. Secure water supply."; break;
          } else if ([502, 503, 504, 522, 531].includes(fCode)) {
            alertMessage = "🌧️ Heavy torrential rain forecasted. Grid instability risks detected. Ensure storage tank is filled."; break;
          } else if (fWind >= 11) {
            alertMessage = `💨 Severe wind gusts forecasted (${Math.round(fWind * 3.6)} km/h). Pre-filling tank recommended.`; break;
          }
        }
      }

      // --- 3. SAVE AND UPDATE UI ---
      setWeatherAlert(alertMessage); 
      localStorage.setItem('smartWaterLocationPref', 'manual');
      localStorage.setItem('smartWaterWeatherTime', new Date().getTime());
      if (alertMessage) localStorage.setItem('smartWaterWeatherData', alertMessage);
      else localStorage.removeItem('smartWaterWeatherData');

      if (auth.currentUser) update(ref(db, `users/${auth.currentUser.uid}/profile`), { lat: lat.toFixed(4), lon: lon.toFixed(4), city: name });

      setShowCityModal(false);
      setShowLocationModal(false);
      setCityInput('');
    } catch (err) { console.error("Failed to fetch custom location weather.", err); }
  };

  // ==========================================
  // 7. RENDER LOGIC
  // ==========================================
  if (isCheckingAuth) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-main)' }}>Loading System...</div>;
  if (!user) return showLogin ? <Login onSwitchView={() => setShowLogin(false)} /> : <SignupPage onSwitchView={() => setShowLogin(true)} />; 

  return (
    <div className="app-container" style={{ paddingBottom: '80px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', transition: 'background-color 0.3s ease' }}>

      {/* --- LOCATION MODALS --- */}
      {showLocationModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '12px', maxWidth: '400px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📍</div>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>Smart Weather Alerts</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '25px', lineHeight: '1.5' }}>
              We use your location to predict rain and storms up to 6 hours in advance.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={fetchLocationAndWeather} style={{ padding: '12px', border: 'none', background: '#3b82f6', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Use Auto-GPS</button>
              <button onClick={() => { setShowLocationModal(false); setShowCityModal(true); }} style={{ padding: '12px', border: '1px solid var(--border-color)', background: 'transparent', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}>Type City Manually</button>
              <button onClick={() => { localStorage.setItem('smartWaterLocationPref', 'dismissed'); setShowLocationModal(false); }} style={{ padding: '12px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>Not Now</button>
            </div>
          </div>
        </div>
      )}

      {showCityModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '12px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🌍</div>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>Enter Your City</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
              Type your city name to get local weather alerts without using GPS.
            </p>
            <form onSubmit={fetchWeatherByCity} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="text" placeholder="e.g., London, Mumbai, Vijayawada" value={cityInput} onChange={(e) => setCityInput(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', boxSizing: 'border-box' }} required />
              
              {/* THE NEW "USE CURRENT LOCATION" BUTTON */}
              <button 
                type="button" 
                onClick={fetchLocationAndWeather} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', backgroundColor: 'transparent', border: '2px dashed #3b82f6', color: '#3b82f6', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
              >
                📍 Use My Current Location
              </button>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '5px' }}>
                <button type="button" onClick={() => setShowCityModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border-color)', background: 'transparent', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', border: 'none', background: '#10b981', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Search Weather</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 10px', boxSizing: 'border-box', marginBottom: '20px', paddingTop: '20px' }}>
        <div className="header" style={{ textAlign: 'left', paddingBottom: '0' }}>
          <h1 style={{ margin: '0 0 5px 0', color: 'var(--text-main)' }}>Smart Water Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.9rem' }}>
            Monitoring: Apt {profileData.apartment} <span style={{ margin: '0 8px' }}>•</span> 📍 {profileData.city || "Locating..."}
          </p>
        </div>
        <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '1.2rem', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          {isDarkMode ? '🌙' : '☀️'}
        </button>
      </div>

      {/* --- DYNAMIC ALERTS --- */}
      {weatherAlert && (
        <div style={{ background: '#e0f2fe', borderLeft: '6px solid #0284c7', padding: '15px', borderRadius: '8px', marginBottom: '30px', margin: '0 10px', display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, color: '#0369a1', fontSize: '0.95rem', fontWeight: 'bold' }}>{weatherAlert}</p>
        </div>
      )}

      {dashboardData.alerts.leakDetected && (
        <div style={{ 
          background: dashboardData.alerts.leakSeverity === 'High' ? '#fee2e2' : '#fef3c7', 
          borderLeft: `6px solid ${dashboardData.alerts.leakSeverity === 'High' ? '#ef4444' : '#f59e0b'}`, 
          padding: '16px', borderRadius: '8px', margin: '0 10px', marginBottom: '30px', animation: 'fadeIn 0.5s ease-in' 
        }}>
          <h3 style={{ margin: '0 0 8px 0', color: dashboardData.alerts.leakSeverity === 'High' ? '#b91c1c' : '#b45309', display: 'flex', alignItems: 'center' }}>
            ⚠️ {dashboardData.alerts.leakSeverity === 'High' ? 'CRITICAL' : 'WARNING'}: Potential Pipeline Leak!
          </h3>
          <p style={{ margin: 0, color: dashboardData.alerts.leakSeverity === 'High' ? '#991b1b' : '#92400e', fontSize: '0.95rem' }}>
            {dashboardData.alerts.leakSeverity === 'High' 
              ? `Severe continuous flow detected. System has AUTOMATICALLY SHUT OFF the main valve to prevent flooding. Call plumber (${profileData.plumberContact}).`
              : "Minor unexplained pressure drop detected. Please inspect visible pipes for dripping. Valve remains open."}
          </p>
        </div>
      )}

      {/* --- MAIN TABS --- */}
      <main style={{ padding: '0 10px' }}>
        
        {/* TAB 1: CONTROLS */}
        {activeTab === 'controls' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--text-main)' }}>Main Supply Valve</h2>
              <p style={{ marginBottom: '16px', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Status: <span style={{ fontWeight: 'bold', color: dashboardData.controls.valveOpen ? '#10b981' : '#ef4444' }}>
                  {dashboardData.controls.valveOpen ? "OPEN (Flowing)" : "CLOSED (Shut Off)"}
                </span>
              </p>
              <div className="switch-container">
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', marginRight: '8px' }}>OFF</span>
                <label className="switch">
                  <input type="checkbox" checked={dashboardData.controls.valveOpen} onChange={toggleValve} />
                  <span className="slider"></span>
                </label>
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', marginLeft: '8px' }}>ON</span>
              </div>
            </div>

            <div className="card" style={{ padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: dashboardData.controls.pumpStatus === "ON" ? '2px solid #3b82f6' : '1px solid transparent' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-main)' }}>Quick Refill</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>Turn your overhead water pump on or off remotely.</p>
              <p style={{ marginBottom: '20px', fontSize: '1rem', color: 'var(--text-main)' }}>
                Pump Status: <span style={{ fontWeight: 'bold', color: dashboardData.controls.pumpStatus === "ON" ? '#3b82f6' : 'var(--text-muted)' }}>
                  {dashboardData.controls.pumpStatus === "ON" ? "RUNNING" : "STANDBY (Off)"}
                </span>
              </p>
              <button onClick={togglePump} style={{ width: '100%', backgroundColor: dashboardData.controls.pumpStatus === "ON" ? '#ef4444' : '#3b82f6', color: 'white', padding: '16px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                {dashboardData.controls.pumpStatus === "ON" ? "Stop Refilling" : "Start Refilling"}
              </button>
            </div>

            <div className="card" style={{ gridColumn: '1 / -1', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-main)' }}>Maintenance Reminders</h2>
                {reminders.some(r => r.overdue && !r.completed) && <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Action Required</span>}
              </div>

              {reminders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', animation: 'fadeIn 0.5s ease-in' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>✨</span>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>You're all caught up!</p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>No reminders currently.</p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {reminders.map((reminder) => (
                    <li key={reminder.id} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', opacity: reminder.completed ? 0.5 : 1, transition: 'all 0.5s ease-out' }}>
                      <div onClick={() => toggleReminder(reminder.id)} style={{ width: '22px', height: '22px', borderRadius: '50%', border: reminder.completed ? 'none' : '2px solid var(--border-color)', backgroundColor: reminder.completed ? '#3b82f6' : 'transparent', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }}>
                        {reminder.completed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleReminder(reminder.id)}>
                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: reminder.completed ? '500' : '600', color: reminder.completed ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: reminder.completed ? 'line-through' : 'none' }}>{reminder.title}</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: reminder.completed ? 'var(--text-muted)' : (reminder.overdue ? '#ef4444' : 'var(--text-muted)'), fontWeight: (!reminder.completed && reminder.overdue) ? 'bold' : 'normal', marginTop: '4px' }}>{reminder.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div> 
        )}

        {/* TAB 2: SENSORS */}
        {activeTab === 'sensors' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--text-main)' }}>Tank Level</h2>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '16px' }}>{dashboardData.sensorData.tankLevel}%</div>
              <div style={{ width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '999px', height: '24px', overflow: 'hidden' }}>
                <div style={{ width: `${dashboardData.sensorData.tankLevel}%`, backgroundColor: '#3b82f6', height: '100%', transition: 'width 0.5s ease' }}></div>
              </div>
            </div>

            <div className="card" style={{ padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--text-main)' }}>Water Quality</h2>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '5px' }}>pH: {dashboardData.sensorData.phLevel}</div>
              <div style={{ fontWeight: 'bold', color: '#10b981', marginBottom: '10px' }}>Safe & Neutral</div>
            </div>

            <div className="card" style={{ padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-main)' }}>Live Water Flow</h2>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#0ea5e9' }}>{dashboardData.sensorData.flowRate}</span>
                <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginLeft: '5px' }}>L/min</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-main)' }}>Weekly Water Usage</h2>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Estimated Total</p>
                  <h2 style={{ margin: 0, color: '#3b82f6' }}>{calculatedTotal.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Liters</span></h2>
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
            <div className="card" style={{ padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', width: '100%' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>Resident Profile</h2>
                <button onClick={isEditingProfile ? handleSaveProfile : () => setIsEditingProfile(true)} style={{ position: 'absolute', right: 0, padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 'bold', cursor: 'pointer', backgroundColor: isEditingProfile ? '#10b981' : 'var(--bg-main)', color: isEditingProfile ? 'white' : 'var(--text-main)' }}>
                  {isEditingProfile ? 'Save Changes' : 'Edit Profile'}
                </button>
              </div>
              
              <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', marginBottom: '20px' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', width: '40%' }}>Full Name:</span>
                  {isEditingProfile ? <input type="text" name="name" value={profileData.name} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} /> : <strong style={{ flex: 1, textAlign: 'right', color: 'var(--text-main)' }}>{profileData.name}</strong>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', width: '40%' }}>Apartment No:</span>
                  {isEditingProfile ? <input type="text" name="apartment" value={profileData.apartment} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} /> : <strong style={{ flex: 1, textAlign: 'right', color: 'var(--text-main)' }}>{profileData.apartment}</strong>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', width: '40%' }}>Tank Capacity (L):</span>
                  {isEditingProfile ? <input type="number" name="tankCapacity" value={profileData.tankCapacity} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} /> : <strong style={{ flex: 1, textAlign: 'right', color: 'var(--text-main)' }}>{profileData.tankCapacity} Liters</strong>}
                </div>

                <hr style={{ border: '0', borderTop: '1px dashed var(--border-color)', margin: '10px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', width: '40%' }}>Plumber Contact:</span>
                  {isEditingProfile ? <input type="text" name="plumberContact" value={profileData.plumberContact} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} /> : <strong style={{ flex: 1, textAlign: 'right', color: 'var(--text-main)' }}>{profileData.plumberContact}</strong>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', width: '40%' }}>Building Manager:</span>
                  {isEditingProfile ? <input type="text" name="buildingManager" value={profileData.buildingManager} onChange={handleProfileChange} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} /> : <strong style={{ flex: 1, textAlign: 'right', color: 'var(--text-main)' }}>{profileData.buildingManager}</strong>}
                </div>

                {/* THE NEW "CHANGE CITY" BUTTON FOR WEATHER API */}
                <hr style={{ border: '0', borderTop: '1px dashed var(--border-color)', margin: '15px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', width: '40%' }}>Location Settings:</span>
                  <button onClick={() => setShowCityModal(true)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}>
                    Change City
                  </button>
                </div>

              </div>

              <button onClick={handleLogout} style={{ width: '100%', marginTop: '30px', padding: '12px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>
                Sign Out
              </button>
            </div>
          </div>
        )}

      </main>

      {/* --- BOTTOM NAVIGATION BAR --- */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '12px 10px', zIndex: 1000 }}>
        {['controls', 'sensors', 'analytics', 'profile'].map((tab) => (
          <button 
            key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
              color: activeTab === tab ? '#3b82f6' : 'var(--text-muted)', fontWeight: activeTab === tab ? 'bold' : 'normal', transition: 'color 0.2s'
            }}
          >
            <span style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
              {tab === 'controls' && '🎛️'} {tab === 'sensors' && '💧'} {tab === 'analytics' && '📈'} {tab === 'profile' && '👤'}
            </span>
            <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{tab}</span>
          </button>
        ))}
      </div>

    </div>
  );
}