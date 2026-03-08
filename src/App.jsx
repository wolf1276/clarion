import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, MessageSquare, Send, Database, Loader2, AlertCircle } from 'lucide-react';
import ChartRenderer from './ChartRenderer';
import Papa from 'papaparse';
import alasql from 'alasql';

function App() {
  const [file, setFile] = useState(null);
  const [schema, setSchema] = useState(null);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [charts, setCharts] = useState([]); // Array to store up to 4 charts
  const [isUploading, setIsUploading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [errorLine, setErrorLine] = useState('');

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorLine('');
    
    const formData = new FormData();
    formData.append('file', file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data;
          if (!data || data.length === 0) {
            throw new Error('CSV is empty or invalid.');
          }
          
          // Generate schema
          const columns = Object.keys(data[0]);
          const schemaString = `CREATE TABLE dataset (${columns.map(c => `"${c}" TEXT`).join(', ')});`;
          
          // Load data into locally running AlaSQL
          alasql('DROP TABLE IF EXISTS dataset');
          alasql('CREATE TABLE dataset');
          alasql.tables.dataset.data = data;
          
          setSchema(schemaString);
          setMessages([{ 
            role: 'system', 
            content: `Data uploaded successfully! Generating initial insights...` 
          }]);
          
          // Trigger automatic insights generation
          generateInitialInsights(schemaString);

        } catch (err) {
          setErrorLine(err.message || 'Error processing CSV.');
          setIsUploading(false); // Stop loading here if error
        }
      },
      error: (err) => {
        setErrorLine(err.message || 'Error parsing CSV file.');
        setIsUploading(false);
      }
    });
  };

  const generateInitialInsights = async (schemaString) => {
    setIsQuerying(true);
    try {
      const res = await axios.post('/api/initial-insights', { schema: schemaString });
      
      if (res.data.success && res.data.insights && Array.isArray(res.data.insights)) {
        const generatedCharts = [];
        
        for (const insight of res.data.insights) {
          try {
             // Execute generated SQL locally within browser memory
             const queryData = alasql(insight.sql_query);
             
             if (queryData && queryData.length > 0) {
                generatedCharts.push({
                   id: insight.title || Date.now() + Math.random(),
                   config: {
                      chart_type: insight.chart_type || 'table',
                      x_axis: insight.x_axis,
                      y_axis: insight.y_axis,
                      color: insight.color,
                      title: insight.title
                   },
                   data: queryData
                });
             }
          } catch (sqlErr) {
             console.warn("Failed to locally execute auto-generated query:", insight.sql_query, sqlErr);
          }
        }
        
        if (generatedCharts.length > 0) {
            setCharts(generatedCharts.slice(0, 4));
            setMessages(prev => [...prev, {
              role: 'system',
              content: `Successfully generated ${generatedCharts.length} automatic insights based on your data!`
            }]);
        } else {
             setMessages(prev => [...prev, {
              role: 'assistant',
              content: "I couldn't generate immediate visual insights for this dataset, but you can try asking a query!",
              isError: true
            }]);
        }

      } else {
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: "Failed to generate initial insights.",
            isError: true
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.message || "Error generating auto dashboard.",
        isError: true
      }]);
    } finally {
      setIsQuerying(false);
      setIsUploading(false); // Done with entire upload flow
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim() || !schema) return;

    const userMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsQuerying(true);
    setErrorLine('');

    try {
      // Send schema and query to the serverless function securely holding the API key
      const res = await axios.post('/api/query', { schema, query: userMessage.content });
      
      if (res.data.success) {
        const generatedSql = res.data.sql_used;
        let queryData = [];
        
        try {
          // Execute generated SQL locally within browser memory
          queryData = alasql(generatedSql);
        } catch (sqlErr) {
          throw new Error(`Local SQL Execution Error: ${sqlErr.message}`);
        }

        if (!queryData || queryData.length === 0) {
           setMessages(prev => [...prev, {
            role: 'assistant',
            content: "Query returned no data.",
            isError: true,
            sqlUsed: generatedSql
          }]);
          setIsQuerying(false);
          return;
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Here is the visualization for your query.`,
          sqlUsed: generatedSql
        }]);
        
        // Add chart to grid
        setCharts(prev => {
          const newChart = {
            id: Date.now(),
            config: res.data.chart_config,
            data: queryData
          };
          // Keep only the 4 most recent charts
          const updatedCharts = [newChart, ...prev].slice(0, 4);
          return updatedCharts;
        });
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: res.data.message || "Failed to retrieve insights.",
          isError: true
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.message || err.message || "Error communicating with the server.",
        isError: true
      }]);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="w-full bg-white border-b border-slate-200 z-50 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
            <Database className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-wider text-blue-600 drop-shadow-sm uppercase">
            CLARION
          </h1>
        </div>
        
        <h2 className="text-xl font-black tracking-widest text-slate-800 uppercase absolute left-1/2 -translate-x-1/2 hidden md:block" style={{fontFamily: 'monospace'}}>
          ANALYTICS
        </h2>

        <div className="text-sm px-3 py-1 bg-white rounded-full border border-slate-200 flex items-center gap-2 shadow-sm font-medium">
          <div className={`w-2 h-2 rounded-full ${schema ? 'bg-green-500' : 'bg-orange-500'}`}></div>
          {schema ? 'Data Ready' : 'Awaiting Data'}
        </div>
      </header>

      {/* Main Layout - 2 Columns */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Panel - Controls & Chat */}
        <section className="w-1/3 min-w-[350px] max-w-md bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
          
          <div className="p-6 flex flex-col h-full">
            
            {/* Upload Section */}
            {!schema && (
               <div className="mb-8 p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center text-center transition-all hover:border-blue-400 hover:bg-blue-50/50">
                 <div className="bg-white p-3 rounded-xl mb-3 shadow-sm border border-slate-100">
                   <UploadCloud className="w-6 h-6 text-slate-700" />
                 </div>
                 <h2 className="text-lg font-bold mb-1 uppercase tracking-wide">Upload File</h2>
                 <p className="text-slate-500 text-sm mb-4">
                   CSV format only
                 </p>
                 
                 <div className="w-full relative">
                   <input 
                     type="file" 
                     accept=".csv"
                     onChange={handleFileChange}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                     disabled={isUploading}
                   />
                   <div className="bg-white border border-slate-200 rounded-lg py-2 px-4 text-sm font-medium text-slate-700 w-full text-center shadow-sm">
                     {file ? file.name : 'Choose File'}
                   </div>
                 </div>
                 
                 {errorLine && (
                   <div className="mt-3 flex items-center gap-2 text-red-500 bg-red-50 px-3 py-1.5 rounded-lg text-xs w-full justify-center">
                     <AlertCircle className="w-3.5 h-3.5" />
                     {errorLine}
                   </div>
                 )}
     
                 <button 
                   onClick={handleUpload}
                   disabled={!file || isUploading}
                   className="mt-4 w-full flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                 >
                   {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {isUploading ? 'Analyzing...' : 'Upload & Analyze'}
                 </button>
               </div>
            )}

            {/* Query Section */}
            <div className="mb-6">
              <h3 className="text-xl font-black mb-3 text-slate-800" style={{fontFamily: 'monospace'}}>Enter query ?</h3>
              <form onSubmit={handleQuery} className="relative flex items-center">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={!schema || isQuerying}
                  placeholder={schema ? "E.g. show sales by region" : "Upload data first"}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-4 pr-12 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium disabled:opacity-50 shadow-inner"
                />
                <button 
                  type="submit" 
                  disabled={!query.trim() || !schema || isQuerying}
                  className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:hover:bg-blue-600"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Results Header */}
            <h3 className="text-xl font-black mb-3 text-slate-800 text-center" style={{fontFamily: 'monospace'}}>Result</h3>
            
            {/* Chat History / Results */}
            <div className="flex-1 overflow-y-auto bg-white border-2 border-slate-800 rounded-2xl p-4 shadow-[4px_4px_0_rgba(15,23,42,1)] scrollbar-thin scrollbar-thumb-slate-200">
              <div className="flex flex-col gap-4">
                {messages.length === 0 && (
                  <div className="text-center text-slate-400 italic text-sm mt-4">
                    Results will appear here...
                  </div>
                )}
                
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    
                    {msg.role !== 'user' && (
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Database className="w-3 h-3 text-white" />
                      </div>
                    )}
      
                    <div className={`max-w-[85%] rounded-xl p-3 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-50 text-blue-900 border border-blue-100 rounded-tr-sm' 
                        : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm'
                    }`}>
                      
                      {msg.isError ? (
                        <div className="flex items-start gap-2 text-red-600">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{msg.content}</p>
                        </div>
                      ) : (
                        <p className="leading-relaxed font-medium">{msg.content}</p>
                      )}
                      
                      {/* SQL Used details */}
                      {msg.sqlUsed && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-bold">SQL Executed</p>
                          <pre className="bg-slate-800 p-2 rounded text-[11px] font-mono text-slate-200 overflow-x-auto">
                            <code>{msg.sqlUsed}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isQuerying && (
                   <div className="flex gap-3 justify-start">
                     <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 animate-pulse">
                        <Database className="w-3 h-3 text-white" />
                     </div>
                     <div className="bg-slate-50 border border-slate-100 text-slate-500 rounded-xl rounded-tl-sm p-3 text-sm flex items-center gap-2 font-medium">
                       <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                       Analyzing...
                     </div>
                   </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

          </div>
        </section>

        {/* Right Panel - 2x2 Analytics Grid */}
        <section className="flex-1 bg-blue-100/50 p-6 overflow-y-auto">
          <div className="h-full w-full max-w-5xl mx-auto grid grid-cols-1 xl:grid-cols-2 grid-rows-2 gap-6 pb-20 xl:pb-0">
            {[0, 1, 2, 3].map((index) => {
              const chart = charts[index];
              return (
                <div 
                  key={chart ? chart.id : `empty-${index}`} 
                  className="bg-white rounded-[2rem] border-2 border-slate-800 shadow-[4px_4px_0_rgba(15,23,42,1)] overflow-hidden flex flex-col p-4 w-full h-[400px] xl:h-auto min-h-[300px]"
                >
                  {chart ? (
                    <div className="w-full h-full">
                      <ChartRenderer config={chart.config} data={chart.data} />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                        <Database className="w-4 h-4 opacity-50" />
                        Empty Slot
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
