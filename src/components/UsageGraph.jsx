import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data representing daily water usage in Liters
const weeklyData = [
  { day: 'Mon', usage: 120 },
  { day: 'Tue', usage: 132 },
  { day: 'Wed', usage: 101 },
  { day: 'Thu', usage: 145 },
  { day: 'Fri', usage: 90 },
  { day: 'Sat', usage: 150 },
  { day: 'Sun', usage: 160 },
];

function UsageGraph() {
  return (
    <div style={{ width: '100%', height: 250, marginTop: '20px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={weeklyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <Line type="monotone" dataKey="usage" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
          <CartesianGrid stroke="#ccc" strokeDasharray="5 5" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
            labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default UsageGraph;