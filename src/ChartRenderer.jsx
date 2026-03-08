import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';

const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'];

const ChartRenderer = ({ config, data }) => {
  if (!config || !data || data.length === 0) return null;

  const { chart_type, x_axis, y_axis, color, title } = config;

  // Extract all available columns from the data
  const availableKeys = data.length > 0 ? Object.keys(data[0]) : [];

  // Robustly determine X axis matching actual data
  let validXAxis = availableKeys.includes(x_axis) ? x_axis : availableKeys[0];

  // Robustly determine Y axes
  let rawYKeys = y_axis 
    ? (Array.isArray(y_axis) ? y_axis : y_axis.split(',').map(s => s.trim()))
    : availableKeys.filter(k => k !== validXAxis);

  // Use only keys that actually exist, or fallback to sensible defaults
  let validYKeys = rawYKeys.filter(k => availableKeys.includes(k));
  if (validYKeys.length === 0) {
     // Try to find matching keys ignoring case and spaces
     const normalizedRawY = rawYKeys.map(k => k.toLowerCase().replace(/\s+/g, ''));
     validYKeys = availableKeys.filter(k => normalizedRawY.includes(k.toLowerCase().replace(/\s+/g, '')));
     
     if (validYKeys.length === 0) {
        validYKeys = availableKeys.filter(k => k !== validXAxis && typeof data[0][k] === 'number');
        if (validYKeys.length === 0) {
           validYKeys = availableKeys.filter(k => k !== validXAxis);
        }
     }
  }

  const renderTooltip = () => {
    return <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#475569', fontWeight: 500 }} />;
  };

  const renderTitle = () => {
    return title ? <h3 className="text-lg font-bold text-slate-800 mb-4 px-2">{title}</h3> : null;
  };

  // Catch 1x1 scalar result (e.g. SELECT SUM(Revenue) ...)
  if (data.length === 1 && availableKeys.length === 1) {
    const singleKey = availableKeys[0];
    const metricValue = data[0][singleKey];
    return (
      <div className="w-full h-full p-6 flex flex-col justify-center items-center text-center">
        {renderTitle()}
        <div className="text-slate-500 font-medium mb-4 uppercase tracking-wider text-sm">{singleKey}</div>
        <div className="text-5xl font-black text-slate-800 drop-shadow-sm">
           {typeof metricValue === 'number' ? metricValue.toLocaleString() : metricValue}
        </div>
      </div>
    );
  }

  let finalChartType = chart_type?.toLowerCase() || 'table';

  // Guard against invalid chart properties (e.g. trying to render a bar chart with only 1 column)
  if (['bar', 'line', 'pie', 'scatter'].includes(finalChartType) && validYKeys.length === 0) {
      finalChartType = 'table';
  }

  switch (finalChartType) {
    case 'bar':
      return (
        <div className="w-full h-full p-2 flex flex-col">
          {renderTitle()}
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={validXAxis} stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              {renderTooltip()}
              <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
              {validYKeys.map((key, index) => (
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
              <XAxis dataKey={validXAxis} stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              {renderTooltip()}
              <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
              {validYKeys.map((key, index) => (
                <Line type="monotone" key={key} dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case 'pie':
      // For pie charts, typically x_axis is the name and y_axis is the value
      const valKey = validYKeys[0] || availableKeys[1];
      const nameKey = validXAxis || availableKeys[0];
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
              <XAxis dataKey={validXAxis} type="category" stroke="#64748b" name={validXAxis} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
              <YAxis dataKey={validYKeys[0]} type="number" stroke="#64748b" name={validYKeys[0]} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
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
