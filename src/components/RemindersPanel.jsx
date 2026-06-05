import React, { useState } from 'react';
import { FaBell, FaBroom, FaTools, FaFilter, FaCheck } from 'react-icons/fa';

// Initial reminder data
const initialReminders = [
  { id: 1, title: 'Bi-Annual Tank Scrubbing', desc: 'Prevent algae buildup. Due in 5 days.', icon: <FaBroom color="#d97706" />, urgent: true },
  { id: 2, title: 'pH Sensor Calibration', desc: 'Recalibrate using buffer solutions.', icon: <FaTools color="#0ea5e9" />, urgent: false },
  { id: 3, title: 'Replace Sediment Filter', desc: '10,000 Liters processed since last change.', icon: <FaFilter color="#0ea5e9" />, urgent: false },
];

function RemindersPanel() {
  const [reminders, setReminders] = useState(initialReminders);

  // Function to remove a reminder when clicked
  const handleMarkDone = (id) => {
    setReminders(reminders.filter(reminder => reminder.id !== id));
  };

  return (
    <div className="card" style={{ gridColumn: '1 / -1', borderLeft: '6px solid #f59e0b', textAlign: 'left' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <FaBell color="#f59e0b" style={{ marginRight: '10px' }} /> 
        Action Required: System Reminders
      </h2>
      
      {reminders.length === 0 ? (
        <p style={{ color: '#10b981', fontWeight: 'bold' }}>All caught up! Your system is fully maintained.</p>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {reminders.map((item) => (
            <div key={item.id} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '15px', backgroundColor: item.urgent ? '#fef3c7' : '#f8fafc', 
              borderRadius: '8px', border: '1px solid #e2e8f0' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ fontSize: '1.5rem' }}>{item.icon}</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{item.title}</h3>
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#64748b' }}>{item.desc}</p>
                </div>
              </div>
              <button 
                onClick={() => handleMarkDone(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                  backgroundColor: 'white', color: '#10b981', border: '1px solid #10b981',
                  borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.color = 'white'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#10b981'; }}
              >
                <FaCheck /> Done
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RemindersPanel;