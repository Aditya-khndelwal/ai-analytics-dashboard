# AI-Powered Data Analytics Bot

An AI-powered data analytics assistant that accepts Excel/CSV files and automatically produces written reports and interactive dashboards summarizing the data.

## Features

- **Smart File Upload** — Drag-and-drop CSV/Excel files
- **Automated Analysis** — Descriptive statistics, correlations, outlier detection, trend analysis
- **AI Narration** — Plain-language insights powered by Google Gemini
- **Interactive Dashboard** — Beautiful charts with Plotly.js
- **Report Export** — Download PDF or Word reports

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| Data Processing | Pandas, NumPy, SciPy |
| AI | Google Gemini API |
| Frontend | React + Vite |
| Charting | Plotly.js |
| Report Export | ReportLab (PDF), python-docx (Word) |
| Database | SQLite |

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Gemini API key ([get one free](https://aistudio.google.com))

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```
GEMINI_API_KEY=your_api_key_here
```

Run the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to `http://localhost:8000`.

## Architecture

```
User uploads file → Parser (Pandas) → Analyzer (Stats/Correlations/Outliers)
                                          ↓
                                    Narrator (Gemini AI)
                                          ↓
                              Dashboard (React + Plotly) + Report Export (PDF/Word)
```

**Key Design Principle**: The LLM only narrates pre-computed statistics — it never performs calculations. All numbers originate from Pandas/NumPy.

## License

MIT
