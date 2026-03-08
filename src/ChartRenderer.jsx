import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';

const COLORS = ['#111111', '#555555', '#777777', '#999999', '#BBBBBB', '#DDDDDD'];

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

  // Format large decimals to prevent UI overlap / number overflow
  data = data.map(row => {
    const newRow = { ...row };
    Object.keys(newRow).forEach(k => {
      if (typeof newRow[k] === 'number' && !Number.isInteger(newRow[k])) {
        newRow[k] = parseFloat(newRow[k].toFixed(2));
      }
    });
    return newRow;
  });

  const renderTooltip = () => {
    return <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #D9D4CB', borderRadius: '0.5rem', color: '#111111', padding: '10px' }} itemStyle={{ color: '#555555', fontWeight: 500 }} />;
  };

  const renderTitle = () => {
    return title ? <h3 className="text-base font-bold text-[#111111] mb-6 px-2">{title}</h3> : null;
  };

  // Catch 1x1 scalar result (e.g. SELECT SUM(Revenue) ...)
  if (data.length === 1 && availableKeys.length === 1) {
    const singleKey = availableKeys[0];
    const metricValue = data[0][singleKey];
    return (
      <div className="w-full h-full p-6 flex flex-col justify-center items-center text-center">
        {renderTitle()}
        <div className="text-[#555555] font-medium mb-4 uppercase tracking-widest text-xs">{singleKey}</div>
        <div className="text-6xl font-bold text-[#111111]">
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
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D4CB" vertical={false} />
              <XAxis dataKey={validXAxis} stroke="#555555" tick={{fill: '#555555', fontSize: 11}} axisLine={{stroke: '#D9D4CB'}} tickLine={false} />
              <YAxis stroke="#555555" tick={{fill: '#555555', fontSize: 11}} axisLine={false} tickLine={false} />
              {renderTooltip()}
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#555555' }} iconType="circle" />
              {validYKeys.map((key, index) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />
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
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D4CB" vertical={false} />
              <XAxis dataKey={validXAxis} stroke="#555555" tick={{fill: '#555555', fontSize: 11}} axisLine={{stroke: '#D9D4CB'}} tickLine={false} />
              <YAxis stroke="#555555" tick={{fill: '#555555', fontSize: 11}} axisLine={false} tickLine={false} />
              {renderTooltip()}
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#555555' }} iconType="circle" />
              {validYKeys.map((key, index) => (
                <Line type="monotone" key={key} dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 3, strokeWidth: 1, fill: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case 'pie':
      // For pie charts, typically x_axis is the name and y_axis is the value
      const valKey = validYKeys[0] || availableKeys[1];
      const nameKey = validXAxis || availableKeys[0];
      const showLabels = data.length <= 6;
      return (
        <div className="w-full h-full p-2 flex flex-col items-center overflow-hidden">
          {renderTitle()}
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              {renderTooltip()}
              <Legend 
                wrapperStyle={{ fontSize: '11px', color: '#555555', paddingTop: '5px' }} 
                iconType="circle" 
                iconSize={8}
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
              />
              <Pie
                data={data}
                dataKey={valKey}
                nameKey={nameKey}
                cx="50%"
                cy="45%"
                innerRadius="35%"
                outerRadius="55%"
                fill="#8884d8"
                paddingAngle={1}
                label={showLabels ? { fill: '#555555', fontSize: 10 } : false}
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
            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D4CB" vertical={false} />
              <XAxis dataKey={validXAxis} type="category" stroke="#555555" name={validXAxis} tick={{fill: '#555555', fontSize: 11}} axisLine={{stroke: '#D9D4CB'}} tickLine={false} />
              <YAxis dataKey={validYKeys[0]} type="number" stroke="#555555" name={validYKeys[0]} tick={{fill: '#555555', fontSize: 11}} axisLine={false} tickLine={false} />
              {renderTooltip()}
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#555555' }} iconType="circle" />
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
          <div className="border border-[#D9D4CB] rounded-xl overflow-hidden">
            <table className="min-w-full text-left text-sm text-[#555555]">
              <thead className="text-xs text-[#555555] uppercase bg-[#F3EFE7] border-b border-[#D9D4CB]">
                <tr>
                  {cols.map(col => <th key={col} className="px-6 py-4 font-bold tracking-wider">{col}</th>)}
                </tr>
              </thead>
              <tbody className="bg-[#FFFFFF] divide-y divide-[#D9D4CB] text-[#111111]">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-[#F3EFE7]/50 transition-colors">
                    {cols.map(col => <td key={`${i}-${col}`} className="px-6 py-4 whitespace-nowrap">{row[col]}</td>)}
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
