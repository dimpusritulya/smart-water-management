import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig"; // This links your specific database keys!
import { ref, update, onValue } from "firebase/database";
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


  // --- THE UPGRADED BOUNCER (Auth Guard & Live Data Listeners) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); 
      
      if (currentUser) {
        // 1. Listen for Profile Data
        const profileRef = ref(db, 'users/' + currentUser.uid + '/profile');
        onValue(profileRef, (snapshot) => {
          if (snapshot.exists()) {
            setProfileData(snapshot.val());        
          } else {
            setProfileData({ name: "Loading...", apartment: "...", tankCapacity: "...", plumberContact: "Not provided yet", buildingManager: "Not provided yet" });
          }
        });

        // 2. Listen for Reminders Data & Calculate Due Dates!
        const remindersRef = ref(db, 'users/' + currentUser.uid + '/reminders');
        onValue(remindersRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const today = new Date();

            // Process the raw database dates into actionable UI items
            const processedReminders = Object.keys(data).map(key => {
              const item = data[key];
              const lastDate = new Date(item.lastCompletedDate);
              
              // Calculate how many days have passed
              const daysPassed = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
              const daysRemaining = item.frequencyInDays - daysPassed;
              const isOverdue = daysRemaining < 0;

              // SMART FILTER: ONLY show on dashboard if due within 14 days OR overdue
              if (daysRemaining <= 14) {
                return {
                  id: key,
                  title: item.title,
                  desc: isOverdue ? `OVERDUE by ${Math.abs(daysRemaining)} days` : `Due in ${daysRemaining} days`,
                  overdue: isOverdue,
                  completed: false
                };
              }
              return null; // If it's not due soon, keep it hidden!
            }).filter(Boolean); // Remove the hidden ones from the array

            setReminders(processedReminders);
          } else {
            // SEED DEFAULT REMINDERS for brand new accounts!
            // We set the lastCompletedDate intentionally far back so they show up for testing
            const initialReminders = {
              "task_tank": { title: "Overhead Tank Deep Cleaning", frequencyInDays: 180, lastCompletedDate: "2025-11-01T00:00:00Z" },
              "task_filter": { title: "Water Filter Recalibration", frequencyInDays: 90, lastCompletedDate: "2026-03-01T00:00:00Z" }
            };
            update(ref(db, 'users/' + currentUser.uid + '/reminders'), initialReminders);
          }
        });

        // 3. Listen for Live Dashboard Data (Sensors, Controls, Alerts)
        const dashboardRef = ref(db, 'users/' + currentUser.uid);
        onValue(dashboardRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Overwrite the hardcoded state with live database values
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
    name: "",
    apartment: "",
    tankCapacity: "",
    plumberContact: "",
    buildingManager: ""
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
  const handleSaveProfile = async () => {
    if (!user) return; // Safety check
    
    try {
      // Points exactly to this specific logged-in user
      const profileRef = ref(db, 'users/' + user.uid + '/profile'); 
      
      // Updates Firebase with whatever is currently in your input boxes
      await update(profileRef, profileData); 
      
      setIsEditingProfile(false); // Turn off edit mode
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile in Firebase:", error);
      alert("Failed to save profile updates.");
    }
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

  // --- REMINDERS STATE & LOGIC ---
  const [reminders, setReminders] = useState([]); // Starts empty, Firebase fills it!

  const toggleReminder = (id) => {
    // 1. Instantly check it off on the screen for that satisfying UI animation
    setReminders(prev => prev.map(rem => 
      rem.id === id ? { ...rem, completed: true } : rem
    ));

    // 2. Wait 600ms, then tell Firebase you completed it RIGHT NOW
    setTimeout(async () => {
      if (user) {
        const taskRef = ref(db, `users/${user.uid}/reminders/${id}`);
        await update(taskRef, {
          lastCompletedDate: new Date().toISOString() // Saves the exact current date/time!
        });
      }
    }, 600);
  };


  // --- WEATHER & LOCATION STATES ---
  const [weatherAlert, setWeatherAlert] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false); // Kept your original modal!

  // 1. SMART CHECK: Silent Permission Query
  useEffect(() => {
    const checkPermissions = async () => {
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          
          if (result.state === 'granted') {
            // They already trust us! Fetch silently in the background. No banners.
            fetchLocationAndWeather(); 
          } else if (result.state === 'prompt') {
            // First time ever visiting. Show your friendly explanation modal.
            setShowLocationModal(true);
          }

          // Listen in case they manually change permissions later
          result.onchange = () => {
            if (result.state === 'granted') {
              setShowLocationModal(false);
              fetchLocationAndWeather();
            }
          };
        } catch (e) {
          setShowLocationModal(true); // Fallback
        }
      } else {
        setShowLocationModal(true); // Fallback for older browsers
      }
    };
    
    checkPermissions();
  }, []); 

  // 2. THE FORECAST FETCH LOGIC 
  const fetchLocationAndWeather = () => {
    setShowLocationModal(false); // Hide your custom modal when they click "Allow"

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;

      // Save to Firebase for the ESP32 to use
      if (auth.currentUser) {
        update(ref(db, `users/${auth.currentUser.uid}/profile`), {
          lat: latitude.toFixed(4),
          lon: longitude.toFixed(4)
        });
      }
      
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_KEY;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}`);
        const data = await res.json();
        
        const nextForecast = data.list[0];
        const weatherCode = nextForecast.weather[0].id; 
        const windSpeed = nextForecast.wind.speed;

        const isThunderstorm = (weatherCode >= 200 && weatherCode <= 232);
        const isHeavyRain = [500, 501, 502, 503, 504, 522, 531].includes(weatherCode);
        const isHighWind = windSpeed >= 11;

        if (isThunderstorm) {
          setWeatherAlert("⚡ Thunderstorms forecasted within 3 hours. High risk of lightning-induced power outages. Consider securing your water supply now.");
        } else if (isHeavyRain) {
          setWeatherAlert("🌧️ Torrential rain forecasted within 3 hours. Structural grid risks detected. Ensure your storage tank is sufficiently filled.");
        } else if (isHighWind) {
          setWeatherAlert(`💨 Severe wind gusts forecasted (${Math.round(windSpeed * 3.6)} km/h). High risk of falling branches on power lines. Pre-filling tank recommended.`);
        } else {
          setWeatherAlert(null); 
        }
      } catch (err) {
        console.error("Failed to fetch forecast.", err);
      }
    }, (err) => {
      console.log("Location access denied.");
      setShowLocationModal(false);
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

            {/* CARD 3: MAINTENANCE REMINDERS */}
            <div className="card" style={{ gridColumn: '1 / -1', padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#1e293b' }}>Maintenance Reminders</h2>
                
                {/* Only show the Action Required tag if something is actually overdue and not completed */}
                {reminders.some(r => r.overdue && !r.completed) && (
                  <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    Action Required
                  </span>
                )}
              </div>

              {/* Conditional Rendering: Empty State vs The List */}
              {reminders.length === 0 ? (
                
                <div style={{ textAlign: 'center', padding: '40px 0', animation: 'fadeIn 0.5s ease-in' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>✨</span>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#475569' }}>You're all caught up!</p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', marginTop: '4px' }}>No reminders currently.</p>
                </div>

              ) : (

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {reminders.map((reminder) => (
                    <li key={reminder.id} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', opacity: reminder.completed ? 0 : 1, transition: 'all 0.5s ease-out' }}>
                      
                      {/* The Custom Circular Checkbox */}
                      <div 
                        onClick={() => toggleReminder(reminder.id)}
                        style={{ 
                          width: '22px', height: '22px', borderRadius: '50%', 
                          border: reminder.completed ? 'none' : '2px solid #cbd5e1', 
                          backgroundColor: reminder.completed ? '#3b82f6' : 'transparent',
                          display: 'flex', justifyContent: 'center', alignItems: 'center', 
                          cursor: 'pointer', marginTop: '2px', flexShrink: 0,
                          transition: 'all 0.2s'
                        }}
                      >
                        {reminder.completed && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>

                      {/* Text Details */}
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleReminder(reminder.id)}>
                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: reminder.completed ? '500' : '600', color: reminder.completed ? '#94a3b8' : '#1e293b', textDecoration: reminder.completed ? 'line-through' : 'none', transition: 'all 0.2s' }}>
                          {reminder.title}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: reminder.completed ? '#94a3b8' : (reminder.overdue ? '#ef4444' : '#64748b'), fontWeight: (!reminder.completed && reminder.overdue) ? 'bold' : 'normal', marginTop: '4px', transition: 'color 0.2s' }}>
                          {reminder.desc}
                        </p>
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
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', width: '100%' }}>
                
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Resident Profile</h2>
                
                <button 
                  onClick={isEditingProfile ? handleSaveProfile : () => setIsEditingProfile(true)}
                  style={{ position: 'absolute', right: 0, padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: isEditingProfile ? '#10b981' : '#f1f5f9', color: isEditingProfile ? 'white' : '#334155' }}
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
