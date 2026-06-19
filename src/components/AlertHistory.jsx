import React from 'react';
import { FaHistory, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

// --- MOCK DATABASE DATA FOR DEMO ---
const mockHistory = [
  { id: 1, date: '2026-05-28 14:30', type: 'Leak Detected', severity: 'High', resolved: true },
  { id: 2, date: '2026-05-20 09:15', type: 'Low pH (Acidic)', severity: 'Medium', resolved: true },
  { id: 3, date: '2026-05-15 18:45', type: 'Tank Level < 10%', severity: 'High', resolved: true },
  { id: 4, date: '2026-05-02 08:00', type: 'System Routine Clean', severity: 'Low', resolved: true },
];

function AlertHistory() {
  return (
    <div className="card" style={{ gridColumn: '1 / -1', marginTop: '20px', textAlign: 'left' }}>
      
      {/* HEADER SECTION */}
      <h2 style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', color: 'var(--text-main)' }}>
        <FaHistory color="var(--text-muted)" style={{ marginRight: '10px' }} /> 
        System Alert History
      </h2>
      
      {/* TABLE DATA SECTION */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Date & Time</th>
              <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Alert Type</th>
              <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Severity</th>
              <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {mockHistory.map((alert) => (
              <tr key={alert.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{alert.date}</td>
                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>{alert.type}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                    backgroundColor: alert.severity === 'High' ? '#fee2e2' : alert.severity === 'Medium' ? '#fef3c7' : '#e0f2fe',
                    color: alert.severity === 'High' ? '#ef4444' : alert.severity === 'Medium' ? '#d97706' : '#0ea5e9'
                  }}>
                    {alert.severity}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  {alert.resolved ? 
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}><FaCheckCircle style={{ marginRight: '5px' }}/> Resolved</span> : 
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}><FaTimesCircle style={{ marginRight: '5px' }}/> Active</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AlertHistory;