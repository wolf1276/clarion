import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const ChartRenderer = ({ config, data }) => {
  if (!config || !data || data.length === 0) return null;

  const { chart_type, x_axis, y_axis, color, title } = config;

  // Determine what keys we are rendering
  const yKeys = y_axis 
    ? (Array.isArray(y_axis) ? y_axis : y_axis.split(',').map(s => s.trim()))
    : Object.keys(data[0]).filter(k => k !== x_axis);

  const renderTooltip = () => {
    return <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#475569', fontWeight: 500 }} />;
  };

  const renderTitle = () => {
    return title ? <h3 className="text-lg font-bold text-slate-800 mb-4 px-2">{title}</h3> : null;
  };

  switch (chart_type?.toLowerCase()) {
    case 'bar':
      return (
        <div className="w-full h-full p-2 flex flex-col">
          {renderTitle()}
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={x_axis} stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              {renderTooltip()}
              <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
              {yKeys.map((key, index) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={50} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case 'line':
      return (
        <div className="w-full h-full p-2 flex flex-col">
          {renderTitle()}
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={x_axis} stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              {renderTooltip()}
              <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
              {yKeys.map((key, index) => (
                <Line type="monotone" key={key} dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case 'pie':
      // For pie charts, typically x_axis is the name and y_axis is the value
      const valKey = yKeys[0] || Object.keys(data[0])[1];
      const nameKey = x_axis || Object.keys(data[0])[0];
      return (
        <div className="w-full h-full p-2 flex flex-col items-center">
          {renderTitle()}
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              {renderTooltip()}
              <Legend iconType="circle" />
              <Pie
                data={data}
                dataKey={valKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={2}
                label={{ fill: '#475569', fontSize: 12 }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    case 'scatter':
      return (
        <div className="w-full h-full p-2 flex flex-col">
          {renderTitle()}
          <ResponsiveContainer width="100%" height="85%">
            <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={x_axis} type="category" stroke="#64748b" name={x_axis} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              <YAxis dataKey={yKeys[0]} type="number" stroke="#64748b" name={yKeys[0]} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              {renderTooltip()}
              <Legend iconType="circle" />
              <Scatter name={title || "Data"} data={data} fill={COLORS[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );

    case 'table':
    default:
      // Fallback to table rendering if chart type is not recognized
      const cols = data.length > 0 ? Object.keys(data[0]) : [];
      return (
        <div className="w-full h-full p-4 overflow-x-auto">
          {renderTitle()}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  {cols.map(col => <th key={col} className="px-6 py-3 font-bold tracking-wider">{col}</th>)}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    {cols.map(col => <td key={`${i}-${col}`} className="px-6 py-3 whitespace-nowrap">{row[col]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
  }
};

export default ChartRenderer;
