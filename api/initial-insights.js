import { HfInference } from '@huggingface/inference';

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

  const hfToken = process.env.HF_TOKEN;

  if (!hfToken) {
    return res.status(500).json({ success: false, message: 'HF_TOKEN is not configured in the server environment.' });
  }

  try {
    const hf = new HfInference(hfToken);
    
    // Using a model highly capable of returning valid JSON
    const modelId = "Qwen/Qwen2.5-Coder-32B-Instruct"; 

    const systemPrompt = `You are an expert data analyst. You are provided with a database schema.
Your goal is to automatically generate 4 distinct, interesting analytical queries based on this schema to populate a 2x2 dashboard grid.

Rules:
1. Always produce a valid SQLite SELECT query from the table named 'dataset'.
2. Ensure the queries represent DIFFERENT types of analysis (e.g., breakdown by category, trend over time if applicable, top N items, summaries).
3. Specify the best chart type to visualize each result (options: 'bar', 'line', 'pie', 'scatter', 'table').
4. Do not hallucinates columns that are not in the schema.

Schema:
${schema}

Return the results EXCLUSIVELY as a raw, minified JSON array containing exactly 4 objects without any markdown formatting, backticks, or explanation.
Each object must contain these keys: sql_query, chart_type, title, x_axis
Optional keys: y_axis, color`;

    const response = await hf.chatCompletion({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate 4 initial insights as a JSON array now." }
      ],
      max_tokens: 1500,
      temperature: 0.1
    });

    let textResp = response.choices[0].message.content.trim();
    
    // Clean potential markdown backticks that sometimes leak out
    if (textResp.startsWith("\`\`\`json")) textResp = textResp.replace(/^\`\`\`json[\n\r]*/, "");
    if (textResp.startsWith("\`\`\`")) textResp = textResp.replace(/^\`\`\`[\n\r]*/, "");
    if (textResp.endsWith("\`\`\`")) textResp = textResp.replace(/[\n\r]*\`\`\`$/, "");

    let jsonResp;
    try {
        jsonResp = JSON.parse(textResp);
    } catch {
       return res.status(500).json({ success: false, message: 'Invalid JSON response from AI.' });
    }

    return res.status(200).json({
      success: true,
      insights: jsonResp
    });

  } catch (error) {
    console.error("Hugging Face API Error (Initial Insights):", error);
    return res.status(500).json({ success: false, message: 'Error generating auto-insights from Hugging Face AI.' });
  }
}
