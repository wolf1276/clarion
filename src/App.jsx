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
      dynamicTyping: true,
      complete: (results) => {
        try {
          const data = results.data;
          if (!data || data.length === 0) {
            throw new Error('CSV is empty or invalid.');
          }
          
          // Generate schema mapping types
          const columns = Object.keys(data[0]);
          const schemaString = `CREATE TABLE dataset (${columns.map(c => `"${c}" ${typeof data[0][c] === 'number' ? 'REAL' : 'TEXT'}`).join(', ')});`;
          
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
        
        // Add chart to grid (always place user query in the 4th slot)
        setCharts(prev => {
          const newChart = {
            id: Date.now(),
            config: res.data.chart_config,
            data: queryData
          };
          // Copy previous charts and explicitly assign the new chart to the bottom-right 4th slot (index 3)
          const updatedCharts = [...prev];
          updatedCharts[3] = newChart;
          
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
    <div className="h-screen bg-[#F3EFE7] text-[#111111] font-sans selection:bg-[#D9D4CB] overflow-hidden flex flex-col">
      {/* Header */}
      <header className="w-full bg-[#F3EFE7] border-b border-[#D9D4CB] z-50 px-8 py-5 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/logo.jpg" alt="Clarion Logo" className="w-11 h-11 object-contain mix-blend-multiply" />
          <h1 className="text-2xl font-bold tracking-tight text-[#111111] uppercase">
            CLARION
          </h1>
        </div>
        
        <h2 className="text-sm font-semibold tracking-[0.2em] text-[#555555] uppercase absolute left-1/2 -translate-x-1/2 hidden md:block">
          ANALYTICS DASHBOARD
        </h2>

        <div className="text-xs px-4 py-1.5 bg-white rounded-full border border-[#D9D4CB] flex items-center gap-2 font-medium text-[#555555]">
          <div className={`w-2 h-2 rounded-full ${schema ? 'bg-[#000000]' : 'bg-[#D9D4CB]'}`}></div>
          {schema ? 'Data Ready' : 'Awaiting Data'}
        </div>
      </header>

      {/* Main Layout - 2 Columns */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Panel - Controls & Chat */}
        <section className="w-1/3 min-w-[350px] max-w-md bg-[#F3EFE7] border-r border-[#D9D4CB] flex flex-col z-10">
          
          <div className="p-8 flex flex-col h-full gap-6">
            
            {/* Upload Section */}
            {!schema && (
               <div className="p-8 bg-[#FFFFFF] border border-[#D9D4CB] rounded-xl flex flex-col items-center text-center transition-all hover:border-[#111111]">
                 <div className="bg-[#F3EFE7] p-4 rounded-full mb-4">
                   <UploadCloud className="w-6 h-6 text-[#111111]" />
                 </div>
                 <h2 className="text-base font-bold mb-1 text-[#111111]">Upload Dataset</h2>
                 <p className="text-[#555555] text-xs mb-6">
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
                   <div className="bg-[#F3EFE7] border border-[#D9D4CB] rounded-lg py-2.5 px-4 text-xs font-semibold text-[#111111] w-full text-center hover:bg-[#EBE5D9] transition-colors">
                     {file ? file.name : 'Choose File'}
                   </div>
                 </div>
                 
                 {errorLine && (
                   <div className="mt-4 flex items-center gap-2 text-[#111111] bg-[#F3EFE7] px-3 py-2 rounded-lg text-xs w-full justify-center border border-[#D9D4CB]">
                     <AlertCircle className="w-4 h-4" />
                     {errorLine}
                   </div>
                 )}
     
                 <button 
                   onClick={handleUpload}
                   disabled={!file || isUploading}
                   className="mt-6 w-full flex justify-center items-center gap-2 bg-[#000000] hover:bg-[#111111] text-white px-4 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider"
                 >
                   {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {isUploading ? 'Analyzing...' : 'Generate Insights'}
                 </button>
               </div>
            )}

            {/* Query Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Prompt</h3>
              <form onSubmit={handleQuery} className="relative flex items-center">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={!schema || isQuerying}
                  placeholder={schema ? "Ask a question about your data..." : "Upload data first to prompt"}
                  className="w-full bg-[#FFFFFF] border border-[#D9D4CB] rounded-xl py-3.5 pl-4 pr-12 text-[#111111] placeholder:text-[#555555] focus:outline-none focus:border-[#000000] transition-colors text-sm disabled:opacity-50"
                />
                <button 
                  type="submit" 
                  disabled={!query.trim() || !schema || isQuerying}
                  className="absolute right-2 p-2 bg-[#000000] text-white rounded-lg transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Chat History / Results */}
            <div className="flex-1 overflow-y-auto bg-[#FFFFFF] border border-[#D9D4CB] rounded-xl p-5 scrollbar-thin scrollbar-thumb-[#D9D4CB]">
              <div className="flex flex-col gap-5">
                {messages.length === 0 && (
                  <div className="text-center text-[#555555] text-xs mt-4">
                    Insights will appear here
                  </div>
                )}
                
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    
                    {msg.role !== 'user' && (
                      <div className="w-6 h-6 rounded-full bg-[#000000] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Database className="w-3 h-3 text-white" />
                      </div>
                    )}
      
                    <div className={`max-w-[85%] rounded-xl p-4 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-[#F3EFE7] text-[#111111] border border-[#D9D4CB] rounded-tr-sm' 
                        : 'bg-[#FFFFFF] border border-[#D9D4CB] text-[#555555] rounded-tl-sm'
                    }`}>
                      
                      {msg.isError ? (
                        <div className="flex items-start gap-2 text-[#111111] font-medium">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{msg.content}</p>
                        </div>
                      ) : (
                        <p className={`leading-relaxed ${msg.role === 'user' ? 'font-medium' : 'font-normal'}`}>{msg.content}</p>
                      )}
                      
                      {/* SQL Used details */}
                      {msg.sqlUsed && (
                        <div className="mt-3 pt-3 border-t border-[#D9D4CB]">
                          <p className="text-[10px] text-[#555555] mb-2 uppercase tracking-widest font-bold">Query Execution</p>
                          <pre className="bg-[#F3EFE7] p-3 rounded-lg text-[11px] font-mono text-[#111111] overflow-x-auto border border-[#D9D4CB]">
                            <code>{msg.sqlUsed}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isQuerying && (
                   <div className="flex gap-3 justify-start">
                     <div className="w-6 h-6 rounded-full bg-[#000000] flex items-center justify-center flex-shrink-0 animate-pulse">
                        <Database className="w-3 h-3 text-white" />
                     </div>
                     <div className="bg-[#FFFFFF] border border-[#D9D4CB] text-[#555555] rounded-xl rounded-tl-sm p-4 text-sm flex items-center gap-3">
                       <Loader2 className="w-4 h-4 animate-spin text-[#000000]" />
                       Processing...
                     </div>
                   </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

          </div>
        </section>

        {/* Right Panel - 2x2 Analytics Grid */}
        <section className="flex-1 bg-[#F3EFE7] p-8 overflow-y-auto">
          <div className="h-full w-full max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-2 grid-rows-2 gap-8 pb-20 xl:pb-0">
            {[0, 1, 2, 3].map((index) => {
              const chart = charts[index];
              return (
                <div 
                  key={chart ? chart.id : `empty-${index}`} 
                  className="bg-[#FFFFFF] rounded-xl border border-[#D9D4CB] flex flex-col p-6 w-full h-[400px] xl:h-[calc(50%-1rem)] min-h-[300px]"
                >
                  {chart ? (
                    <div className="w-full h-full">
                      <ChartRenderer config={chart.config} data={chart.data} />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center border border-dashed border-[#D9D4CB] rounded-lg bg-[#F3EFE7]/50">
                      <p className="text-[#555555] font-medium text-sm flex items-center gap-2">
                        <Database className="w-4 h-4 opacity-50" />
                        Awaiting visualization
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
