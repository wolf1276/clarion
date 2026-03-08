import express from 'express';
import cors from 'cors';
import handler from './api/query.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Forward any POST request to the Vercel handler logic
app.post('/api/query', async (req, res) => {
    try {
        await handler(req, res);
    } catch (error) {
        console.error("Local Dev Server Error:", error);
        res.status(500).json({ success: false, message: "Local server error" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Mock Vercel API Server running on port ${PORT}`);
});
