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

  const { schema } = req.body;

  if (!schema) {
    return res.status(400).json({ success: false, message: 'Schema is required' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: 'GOOGLE_API_KEY is not configured on the server.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `You are an expert data analyst. You are provided with a database schema.
Your goal is to automatically generate 4 distinct, interesting analytical queries based on this schema to populate a 2x2 dashboard grid.

Rules:
1. Always produce a valid SQLite SELECT query from the table named 'dataset'.
2. Ensure the queries represent DIFFERENT types of analysis (e.g., breakdown by category, trend over time if applicable, top N items, summaries).
3. Specify the best chart type to visualize each result (options: 'bar', 'line', 'pie', 'scatter', 'table').
4. Do not hallucinates columns that are not in the schema.

Schema:
${schema}

Return the results as a JSON array containing exactly 4 objects. Do not use markdown codeblocks. Do not include extra text.
Each object must contain these keys: sql_query, chart_type, title, x_axis
Optional keys: y_axis, color
`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] }
      ],
      generationConfig: {
        temperature: 0.1, // Slight variation for interesting queries
        responseMimeType: "application/json"
      }
    });

    const textResp = result.response.text();
    let jsonResp;
    try {
        jsonResp = JSON.parse(textResp);
    } catch {
       return res.status(500).json({ success: false, message: 'Invalid response format from AI.' });
    }

    // Wrap the response
    return res.status(200).json({
      success: true,
      insights: jsonResp
    });

  } catch (error) {
    console.error("Gemini API Error (Initial Insights):", error);
    return res.status(500).json({ success: false, message: 'Error generating auto-insights from AI.' });
  }
}
