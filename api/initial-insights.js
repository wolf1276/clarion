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

  const { schema } = req.body;

  if (!schema) {
    return res.status(400).json({ success: false, message: 'Schema is required' });
  }

  try {
    const systemPrompt = `You are an expert data analyst. You are provided with a database schema.
Your goal is to automatically generate 4 distinct, interesting analytical queries based on this schema to populate a 2x2 dashboard grid.

Rules:
1. Always produce a valid SQLite SELECT query from the table named 'dataset'.
2. Ensure the queries represent DIFFERENT types of analysis (e.g., breakdown by category, top N items, summaries).
3. Specify the best chart type to visualize each result (options: 'bar', 'line', 'pie', 'scatter', 'table').
4. Return ONLY a single JSON array containing exactly 4 objects. Do not wrap it in markdown. No explanation.

Schema:
${schema}

Each object in the array must strictly have these string keys: sql_query, chart_type, title, x_axis
Optional keys: y_axis, color
`;

    // Local request to Ollama
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: "llama3", // The user must pull this using: ollama run llama3
      prompt: systemPrompt,
      format: "json", // Force Ollama to output JSON
      stream: false,
      options: {
        temperature: 0.1
      }
    });

    const textResp = response.data.response;
    
    let jsonResp;
    try {
        jsonResp = JSON.parse(textResp);
        // Sometimes LLMs (even in JSON mode) output a top level object mapping to an array, if they didn't output a raw array
        if (!Array.isArray(jsonResp)) {
          // Attempt to extract array if it nested it
          const keys = Object.keys(jsonResp);
          for (const key of keys) {
            if (Array.isArray(jsonResp[key])) {
                jsonResp = jsonResp[key];
                break;
            }
          }
        }
    } catch {
       return res.status(500).json({ success: false, message: 'Invalid response format from Local AI.' });
    }

    return res.status(200).json({
      success: true,
      insights: jsonResp
    });

  } catch (error) {
    console.error("Ollama API Error (Initial Insights):", error.message);
    return res.status(500).json({ 
       success: false, 
       message: 'Failed to connect to Local AI. Please ensure Ollama is running (ollama run llama3) on port 11434.' 
    });
  }
}
