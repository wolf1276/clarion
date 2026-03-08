<div align="center">
  
# 🚀 CLARION: Serverless AI Analytics Dashboard

**Transform any CSV dataset into dynamic, beautiful interactive charts using natural language.** <br>
*Zero databases. Zero infrastructure costs. 100% Client-Side Processing.*

[![Built with React](https://img.shields.io/badge/Built_with-React-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Powered by Vite](https://img.shields.io/badge/Powered_by-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styled_with-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/AI_Model-Gemini_2.5_Flash-orange?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)

</div>

<br/>

## 🌟 The Problem
Data analytics tools are notoriously complex, expensive, and require significant infrastructure (SQL databases, stateful backends, auth systems). For small teams, hackathons, or individuals who just want to quickly visualize a `.csv` file, the barrier to entry is simply too high. Furthermore, sending sensitive data to third-party APIs poses security and privacy risks.

## 💡 The Solution: Clarion
Clarion completely reimagines data visualization by moving the entire data processing pipeline into the user's web browser. 

By leveraging **in-browser SQL processing** combined with **Generative AI**, Clarion allows users to upload a dataset and instantly ask questions in plain English. The AI generates the required SQL, which the browser executes locally against the uploaded data, instantly rendering beautiful, responsive charts in a clean 2x2 dashboard layout.

### ✨ Key Features
- **🗣️ Natural Language to SQL:** Ask questions like *"Show me the total sales by region and category"* and watch the magic happen.
- **⚡ Instant Auto-Insights:** The moment you upload a dataset, Clarion's AI automatically generates 4 distinct, intelligent visualizations and populates a 2x2 dashboard grid before you even type a query.
- **🔒 100% Private Data Handling:** Your `.csv` file **never** leaves your browser. Parsing and SQL execution happen entirely on the client-side.
- **⚡ Zero-Latency Analytics:** Because the database lives in browser memory, querying millions of rows happens in milliseconds.
- **📈 Dynamic Type Casting:** Automatically parses CSV text strings into pure numeric values (`dynamicTyping`), ensuring that Recharts renders math-accurate graphs.
- **💸 $0 Infrastructure Setup:** Designed to run seamlessly on Vercel's free tier. No persistent databases to manage or pay for.

---

## 🏗️ System Architecture

Clarion achieves its free, serverless architecture through a specific division of labor:

```mermaid
graph TD
    subgraph Client Browser [Client Browser (React/Vite)]
        UI[Frontend UI]
        CSV[(Local CSV File)]
        Papa[PapaParse]
        DB[(AlaSQL In-Memory DB)]
        Recharts[Recharts Interactive Visuals]
    end

    subgraph Vercel Serverless
        API1[api/initial-insights.js]
        API2[api/query.js]
    end

    subgraph Google Cloud
        Gemini[Gemini 2.5 Flash]
    end

    UI -- 1. Uploads --> CSV
    CSV -- 2. Parses (Dynamic Typing) --> Papa
    Papa -- 3. Loads Data --> DB
    Papa -- 4. Extracts Schema --> UI
    
    UI -- 5. Auto-Prompts (Schema only) --> API1
    API1 -- 6. Generates 4 SQL Queries --> Gemini
    UI -- 7. User Prompts (Query + Schema) --> API2
    API2 -- 8. Forwards Auth'd Prompt --> Gemini
    Gemini -- 9. Returns SQL & Chart Config --> API2
    
    UI -- 10. Executes SQL Locally --> DB
    DB -- 11. Returns Filtered Data --> Recharts
    Recharts -- 12. Renders Responsive Grid Elements --> UI
```

### The Workflow:
1. **Upload:** User uploads a `.csv` via the UI. 
2. **Offline Parsing:** `papaparse` reads the file instantly in the browser and dynamically casts types (numbers vs strings).
3. **Local Database Generation:** `alasql` spins up a virtual SQL database in the browser memory and ingests the parsed data, generating a schema mapping.
4. **Auto-Insights Generation:** Upon successful load, the UI silently pings `/api/initial-insights` with the data schema. The AI creates 4 varied, analytical SQL queries to populate the initial blank canvas.
5. **Interactive Queries:** When the user types a manual query, the frontend sends the *schema only* (no user data) and the natural language prompt to `/api/query`.
6. **Secure Execution:** The serverless functions securely hold the Google API Key, call Gemini 2.5 Flash, and return the constructed SQL queries.
7. **Local Rendering:** The browser executes the SQL against `alasql` and pipes the resulting JSON into our dynamic `recharts` grid with robust fallback key mapping.

---

## 🛠️ Tech Stack
- **Frontend Framework:** React 19 + Vite
- **Styling:** Tailwind CSS 4
- **Local Database Engine:** AlaSQL
- **CSV Parser:** PapaParse
- **Data Visualization:** Recharts
- **Icons:** Lucide React
- **Serverless API:** Node.js (Vercel Serverless Functions)
- **AI Model:** Google Gemini 2.5 Flash (`@google/generative-ai`)

---

## 🚀 Local Development / Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/wolf1276/clarion.git
cd clarion
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory and add your Google Gemini API key:
```env
# Get your free key at: https://aistudio.google.com/
GOOGLE_API_KEY=your_gemini_api_key_here
```

### 4. Start the Dev Servers
Because Vercel Serverless functions run differently than standard Vite apps, we need a mock server locally:
```bash
# Terminal 1: Start the mock API Server
node api-server.js

# Terminal 2: Start the Vite Frontend
npm run dev
```

Visit `http://localhost:5173` to view the application!

---

## 🌐 Deployment (Vercel)

Deploying Clarion is incredibly simple since it was designed with Vercel in mind.

1. Push your code to a GitHub repository.
2. Log into [Vercel](https://vercel.com) and click **Add New Project**.
3. Select your GitHub repository.
4. Under **Environment Variables**, add:
   - Name: `GOOGLE_API_KEY`
   - Value: `[your_actual_key]`
5. Click **Deploy**. Vercel will automatically detect Vite and expose your `api/query.js` file as a serverless endpoint!

---

<div align="center">
  <p>Built with ❤️</p>
</div>
