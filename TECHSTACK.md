# 🛠️ Clarion — Tech Stack

## Frontend
| Technology | Purpose |
|---|---|
| **React 19** | Component-based UI framework |
| **Vite 7** | Lightning-fast dev server & bundler |
| **Tailwind CSS 4** | Utility-first styling framework |
| **Recharts 3** | Data visualization & charting library |
| **PapaParse 5** | Client-side CSV parsing engine |
| **AlaSQL 4** | In-browser SQL execution engine |
| **Axios** | HTTP client for API communication |
| **Lucide React** | Minimal icon library |

## Backend (Serverless Functions)
| Technology | Purpose |
|---|---|
| **Node.js** | Runtime for serverless API handlers |
| **Express 5** | Local development API server |
| **Hugging Face Inference API** | AI-powered natural language to SQL |
| **Qwen2.5-Coder-32B-Instruct** | Open-source LLM for query generation |

## AI / LLM Pipeline
| Technology | Purpose |
|---|---|
| **Hugging Face Serverless Inference** | Free, unlimited AI model hosting |
| **Qwen2.5-Coder-32B-Instruct** | Code-specialized LLM for SQL generation |
| **Natural Language → SQL** | Converts user prompts to executable queries |
| **Auto-Insight Generation** | Automatically generates 4 analytical views on CSV upload |

## Data Processing
| Technology | Purpose |
|---|---|
| **PapaParse** | Parses CSV files entirely client-side |
| **AlaSQL** | Executes SQL queries in-browser (no database server needed) |
| **Dynamic Typing** | Automatically detects numeric vs text columns |

## Deployment & DevOps
| Technology | Purpose |
|---|---|
| **Vercel** | Serverless deployment platform |
| **GitHub** | Version control & CI/CD trigger |
| **dotenv** | Environment variable management |

## Design System
| Element | Value |
|---|---|
| **Primary Background** | `#F3EFE7` (Architectural Paper Beige) |
| **Card Background** | `#FFFFFF` |
| **Primary Text** | `#111111` |
| **Secondary Text** | `#555555` |
| **Accent / CTA** | `#000000` |
| **Borders** | `#D9D4CB` |
| **Font** | Inter / System Sans-Serif |
| **Chart Palette** | Monochrome (Black → Grey gradient) |

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ PapaParse│→ │  AlaSQL  │→ │   Recharts    │  │
│  │ (CSV)    │  │ (SQL)    │  │ (Viz)         │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│        ↕               ↕                         │
│  ┌──────────────────────────────────────────┐    │
│  │         React 19 + Tailwind CSS 4        │    │
│  └──────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────┘
                        │ API Calls
                        ▼
┌───────────────────────────────────────────┐
│     Vercel Serverless / Local Express     │
│  ┌─────────────┐  ┌───────────────────┐   │
│  │ /api/query  │  │/api/initial-insights│  │
│  └──────┬──────┘  └────────┬──────────┘   │
│         └────────┬─────────┘              │
│                  ▼                        │
│   ┌──────────────────────────────┐        │
│   │  Hugging Face Inference API  │        │
│   │  Qwen2.5-Coder-32B-Instruct │        │
│   └──────────────────────────────┘        │
└───────────────────────────────────────────┘
```
