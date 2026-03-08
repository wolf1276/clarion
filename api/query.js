import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // CORS setup for local dev, Vercel handles it in production
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

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: 'GOOGLE_API_KEY is not configured on the server.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `You are an expert data analyst. You are provided with a database schema.
Always produce a valid SQLite SELECT query that answers the user's question from a table named 'dataset', and specify the best chart type to visualize the result.
Chart type options: 'bar', 'line', 'pie', 'scatter', 'table'.
If the query cannot be answered using the schema, or if the user question is unrelated to the data, return a minified JSON object with 'error' describing why.

Schema:
${schema}

Output exclusively in minified JSON format. Do not use markdown codeblocks. Do not include extra text.
Required JSON keys if successful: sql_query, chart_type
Optional JSON keys: x_axis, y_axis, color, title
If returning an error, use JSON key: error`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: query }] }
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json"
      }
    });

    const textResp = result.response.text();
    const jsonResp = JSON.parse(textResp);

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
    console.error("Gemini API Error:", error);
    return res.status(500).json({ success: false, message: 'Error generating response from AI.' });
  }
}
