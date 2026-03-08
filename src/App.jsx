import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, MessageSquare, Send, Database, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="h-screen bg-[#F3EFE7] text-[#111111] font-sans selection:bg-[#D9D4CB] overflow-hidden flex flex-col relative">
      
      {/* High-End Subtly Animated Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
        <motion.div 
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-multiply pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(217,212,203,0.5) 0%, transparent 60%)', filter: 'blur(60px)' }}
        />
        <motion.div 
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] rounded-full mix-blend-multiply pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(17,17,17,0.03) 0%, transparent 60%)', filter: 'blur(80px)' }}
        />
      </div>

      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full bg-[#F3EFE7]/80 backdrop-blur-md border-b border-[#D9D4CB] z-50 px-8 py-5 flex justify-between items-center flex-shrink-0"
      >
        <div className="flex items-center gap-4">
          <motion.img 
            whileHover={{ rotate: 10, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
            src="/logo.jpg" 
            alt="Clarion Logo" 
            className="w-11 h-11 object-contain mix-blend-multiply cursor-pointer" 
          />
          <h1 className="text-2xl font-bold tracking-tight text-[#111111] uppercase">
            CLARION
          </h1>
        </div>
        
        <h2 className="text-sm font-semibold tracking-[0.2em] text-[#555555] uppercase absolute left-1/2 -translate-x-1/2 hidden md:block">
          ANALYTICS DASHBOARD
        </h2>

        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="text-xs px-4 py-1.5 bg-white rounded-full border border-[#D9D4CB] flex items-center gap-2 font-medium text-[#555555] shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
        >
          <motion.div 
            animate={schema ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-2 h-2 rounded-full ${schema ? 'bg-[#000000]' : 'bg-[#D9D4CB]'}`}
          />
          {schema ? 'Data Ready' : 'Awaiting Data'}
        </motion.div>
      </motion.header>

      {/* Main Layout - 2 Columns */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Left Panel - Controls & Chat */}
        <motion.section 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="w-1/3 min-w-[350px] max-w-md bg-[#F3EFE7]/60 backdrop-blur-sm border-r border-[#D9D4CB] flex flex-col z-10"
        >
          
          <div className="p-8 flex flex-col h-full gap-6">
            
            {/* Upload Section */}
            {!schema && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="p-8 bg-[#FFFFFF] border border-[#D9D4CB] rounded-xl flex flex-col items-center text-center transition-all hover:border-[#111111] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] group"
               >
                 <motion.div 
                   whileHover={{ scale: 1.1, rotate: 5 }}
                   className="bg-[#F3EFE7] p-4 rounded-full mb-4 group-hover:bg-[#111111] group-hover:text-white transition-colors"
                 >
                   <UploadCloud className="w-6 h-6 text-inherit" />
                 </motion.div>
                 <h2 className="text-base font-bold mb-1 text-[#111111]">Upload Dataset</h2>
                 <p className="text-[#555555] text-xs mb-6">
                   CSV format only
                 </p>
                 
                 <div className="w-full relative">
                   <input 
                     type="file" 
                     accept=".csv"
                     onChange={handleFileChange}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                     disabled={isUploading}
                   />
                   <div className="bg-[#F3EFE7] border border-[#D9D4CB] rounded-lg py-2.5 px-4 text-xs font-semibold text-[#111111] w-full text-center group-hover:bg-[#EBE5D9] transition-colors">
                     {file ? file.name : 'Choose File'}
                   </div>
                 </div>
                 
                 {errorLine && (
                   <div className="mt-4 flex items-center gap-2 text-[#111111] bg-[#F3EFE7] px-3 py-2 rounded-lg text-xs w-full justify-center border border-[#D9D4CB]">
                     <AlertCircle className="w-4 h-4" />
                     {errorLine}
                   </div>
                 )}
     
                 <motion.button 
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                   onClick={handleUpload}
                   disabled={!file || isUploading}
                   className="mt-6 w-full flex justify-center items-center gap-2 bg-[#000000] hover:shadow-[0_0_15px_rgba(0,0,0,0.3)] text-white px-4 py-3 rounded-lg font-semibold transition-shadow disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider overflow-hidden relative"
                 >
                   {/* Button shimmer effect */}
                   <motion.div
                     animate={{ x: ['-100%', '200%'] }}
                     transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                     className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"
                   />
                   {isUploading ? <Loader2 className="w-4 h-4 animate-spin relative z-10" /> : null}
                   <span className="relative z-10">{isUploading ? 'Analyzing...' : 'Generate Insights'}</span>
                 </motion.button>
               </motion.div>
            )}

            {/* Query Section */}
            <motion.div layout className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider flex items-center gap-2">
                Prompt <div className="w-1.5 h-1.5 rounded-full bg-[#111111] animate-pulse"></div>
              </h3>
              <form onSubmit={handleQuery} className="relative flex items-center group">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={!schema || isQuerying}
                  placeholder={schema ? "Ask a question about your data..." : "Upload data first to prompt"}
                  className="w-full bg-[#FFFFFF] border border-[#D9D4CB] rounded-xl py-3.5 pl-4 pr-12 text-[#111111] placeholder:text-[#555555] focus:outline-none focus:border-[#000000] focus:shadow-[0_0_0_4px_rgba(0,0,0,0.05)] transition-all text-sm disabled:opacity-50"
                />
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="submit" 
                  disabled={!query.trim() || !schema || isQuerying}
                  className="absolute right-2 p-2 bg-[#000000] text-white rounded-lg transition-all disabled:opacity-50 hover:shadow-[0_0_10px_rgba(0,0,0,0.2)]"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </form>
            </motion.div>

            {/* Chat History / Results */}
            <motion.div layout className="flex-1 overflow-y-auto bg-[#FFFFFF] border border-[#D9D4CB] rounded-xl p-5 scrollbar-thin scrollbar-thumb-[#D9D4CB] shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col gap-5">
                <AnimatePresence>
                  {messages.length === 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-center text-[#555555] text-xs mt-4"
                    >
                      Insights will appear here
                    </motion.div>
                  )}
                  
                  {messages.map((msg, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      key={idx} 
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      
                      {msg.role !== 'user' && (
                        <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
                          <Database className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
        
                      <div className={`max-w-[85%] rounded-xl p-4 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.02)] ${
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
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ delay: 0.2 }}
                            className="mt-3 pt-3 border-t border-[#D9D4CB] overflow-hidden"
                          >
                            <p className="text-[10px] text-[#555555] mb-2 uppercase tracking-widest font-bold">Query Execution</p>
                            <pre className="bg-[#F3EFE7] p-3 rounded-lg text-[11px] font-mono text-[#111111] overflow-x-auto border border-[#D9D4CB] shadow-inner">
                              <code>{msg.sqlUsed}</code>
                            </pre>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  
                  {isQuerying && (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                       className="flex gap-3 justify-start"
                     >
                       <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.2)]">
                          <Database className="w-3.5 h-3.5 text-white animate-pulse" />
                       </div>
                       <div className="bg-[#FFFFFF] border border-[#D9D4CB] text-[#555555] rounded-xl rounded-tl-sm p-4 text-sm flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                         <Loader2 className="w-4 h-4 animate-spin text-[#000000]" />
                         Processing...
                       </div>
                     </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </motion.div>

          </div>
        </motion.section>

        {/* Right Panel - 2x2 Analytics Grid */}
        <motion.section 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex-1 bg-transparent overflow-y-auto z-10 custom-scrollbar flex items-center justify-center p-8"
        >
          <div className="w-full max-w-6xl aspect-[4/3] max-h-[900px] min-h-[600px] grid grid-cols-1 xl:grid-cols-2 grid-rows-4 xl:grid-rows-2 gap-8">
            <AnimatePresence>
              {[0, 1, 2, 3].map((index) => {
                const chart = charts[index];
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.1 }}
                    whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}
                    key={chart ? chart.id : `empty-${index}`} 
                    className="bg-[#FFFFFF]/90 backdrop-blur-sm rounded-xl border border-[#D9D4CB] flex flex-col p-6 w-full h-full transition-all hover:border-[#111111]/30 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden group"
                  >
                    {/* Subtle internal shimmer */}
                    <motion.div
                      animate={{ x: ['-200%', '300%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: index * 0.5 }}
                      className="absolute top-0 left-0 w-[150%] h-full bg-gradient-to-r from-transparent via-[#F3EFE7]/40 to-transparent skew-x-[-20deg] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                    
                    {chart ? (
                      <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + (index * 0.1) }} 
                        className="w-full h-full relative z-10"
                      >
                        <ChartRenderer config={chart.config} data={chart.data} />
                      </motion.div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center border border-dashed border-[#D9D4CB] rounded-lg bg-[#F3EFE7]/30 relative z-10 group-hover:bg-[#F3EFE7]/50 transition-colors">
                        <p className="text-[#555555] font-medium text-sm flex items-center gap-2">
                          <Database className="w-4 h-4 opacity-50 group-hover:animate-bounce" />
                          Awaiting visualization
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.section>

      </main>
    </div>
  );
}

export default App;
