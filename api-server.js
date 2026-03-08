import express from 'express';
import cors from 'cors';
import queryHandler from './api/query.js';
import insightsHandler from './api/initial-insights.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Forward POST request to the Vercel query handler logic
app.post('/api/query', async (req, res) => {
    try {
        await queryHandler(req, res);
    } catch (error) {
        console.error("Local Dev Server Error (query):", error);
        res.status(500).json({ success: false, message: "Local server error" });
    }
});

// Forward POST request to the Vercel initial-insights handler logic
app.post('/api/initial-insights', async (req, res) => {
    try {
        await insightsHandler(req, res);
    } catch (error) {
        console.error("Local Dev Server Error (insights):", error);
        res.status(500).json({ success: false, message: "Local server error" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Mock Vercel API Server running on port ${PORT}`);
});
