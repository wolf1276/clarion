import axios from 'axios';

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { schema, query } = req.body;

  if (!schema || !query) {
    return res.status(400).json({ success: false, message: 'Schema and query are required' });
  }

  try {
    const systemPrompt = `You are an expert data analyst. You are provided with a database schema and a user question.
Always produce a valid SQLite SELECT query that answers the user's question from a table named 'dataset', and specify the best chart type to visualize the result.
Chart type options: 'bar', 'line', 'pie', 'scatter', 'table'.
If the query cannot be answered using the schema, or if the user question is unrelated to the data, return a minified JSON object with 'error' describing why.

Schema:
${schema}

User Question: ${query}

Return ONLY a minified JSON object. Do not wrap in markdown. No explanation text. Keep output brief.
Required JSON keys if successful: sql_query, chart_type
Optional JSON keys: x_axis, y_axis, color, title
If returning an error, use JSON key: error`;

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: "llama3", // Ensure user pulls this using: ollama run llama3
      prompt: systemPrompt,
      format: "json", // Force Ollama to output valid JSON
      stream: false,
      options: {
        temperature: 0.1
      }
    });

    const textResp = response.data.response;
    let jsonResp = {};
    
    try {
        jsonResp = JSON.parse(textResp);
    } catch {
       return res.status(500).json({ success: false, message: 'Invalid response format from Local AI.' });
    }

    if (jsonResp.error) {
       return res.status(200).json({ success: false, message: jsonResp.error });
    }

    return res.status(200).json({
      success: true,
      chart_config: {
        chart_type: jsonResp.chart_type || 'table',
        x_axis: jsonResp.x_axis,
        y_axis: jsonResp.y_axis,
        color: jsonResp.color,
        title: jsonResp.title || query
      },
      sql_used: jsonResp.sql_query
    });

  } catch (error) {
    console.error("Ollama API Error:", error.message);
    return res.status(500).json({ 
        success: false, 
        message: 'Failed to connect to Local AI. Please ensure Ollama is running (ollama run llama3) on port 11434.' 
    });
  }
}
