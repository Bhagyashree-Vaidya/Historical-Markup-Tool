# Historical Markup Tool
### Emma B. Andrews Diary Project — University of Washington

A digital humanities web application for transcribing, annotating, and exporting handwritten historical documents using AI vision models. Built for Prof. Sarah Ketchley's research into the Emma B. Andrews diary collection (1889–1912).

---

## Overview

Emma B. Andrews accompanied Egyptologist Theodore Davis on Nile expeditions for over two decades, keeping detailed diaries of excavations, social life, and travel. This tool transforms scanned diary pages into structured, scholarly-grade transcriptions with Named Entity Recognition and TEI XML export.

**Live app:** https://historical-markup-tool-production.up.railway.app

---

## Features

- **AI Transcription** — Upload handwritten diary images (JPG, PNG, TIF); Claude claude-sonnet-4-5 produces diplomatic transcriptions preserving original spelling, punctuation, and line breaks
- **Named Entity Recognition** — Automatically tags people, places, dates, and organisations using spaCy
- **Interactive Editor** — Review transcriptions, correct flagged words, manage entity annotations
- **TEI XML Export** — One-click export to Text Encoding Initiative P5 standard for scholarly archival
- **Plain Text Export** — Clean plain-text output for corpus analysis
- **Document Library** — Manage and search across all transcribed pages

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Babel Standalone, custom CSS design system |
| Backend | Python 3.11, FastAPI, uvicorn |
| AI / OCR | Anthropic Claude claude-sonnet-4-5 (vision) |
| NER | spaCy `en_core_web_sm` |
| XML | lxml (TEI P5 generation) |
| Deployment | Railway (Docker) |
| CI/CD | GitHub → Railway auto-deploy on push |

---

## Local Development

### Prerequisites
- Python 3.11+
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

### Setup

```bash
# Clone the repo
git clone https://github.com/Bhagyashree-Vaidya/Historical-Markup-Tool.git
cd Historical-Markup-Tool

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run the app
uvicorn app:app --reload --port 8000
```

Open http://localhost:8000

---

## Deployment

The app deploys automatically to Railway on every push to `main`.

### First-time setup
1. Connect the GitHub repo to [Railway](https://railway.app)
2. Add `ANTHROPIC_API_KEY` in Railway → Variables
3. Railway auto-detects the Dockerfile and builds

### Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude vision |
| `PORT` | Set automatically by Railway |

---

## Project Structure

```
historical-markup-tool/
├── app.py                        # FastAPI application & API routes
├── backend/
│   ├── ocr_service.py            # Claude claude-sonnet-4-5 transcription
│   ├── ner_pipeline.py           # spaCy named entity recognition
│   ├── tei_generator.py          # TEI P5 XML export
│   └── pagexml_parser.py         # PAGE XML parser (Transkribus compat.)
├── frontend/
│   ├── templates/index.html      # React app shell
│   └── static/
│       ├── css/style.css         # Archival design system
│       └── js/app.js             # React UI (Library, Editor, Upload)
├── Dockerfile
├── requirements.txt
└── cloudbuild.yaml
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ocr` | Transcribe an uploaded image |
| `POST` | `/api/analyze` | Run NER on transcribed text |
| `POST` | `/api/tei` | Generate TEI XML from annotated text |

---

## Collection Context

The **Emma B. Andrews Diary Project** is part of the University of Washington's Digital Humanities programme. Emma B. Andrews (1837–1922) travelled to Egypt annually with Theodore Davis from 1889 to 1912, keeping meticulous diaries that are a primary source for Egyptological history of the period.

- **Date range:** 1889–1912
- **Script:** Cursive American/English, late Victorian
- **Topics:** Nile expeditions, excavations (Valley of the Kings), social calls, travel

---

## Contributors

- **Prof. Sarah Ketchley** — Project lead, University of Washington
- **Bhagyashree Vaidya** — Development, University of Washington (iSchool, MSIM)

---

## License

For academic and research use. Contact Prof. Sarah Ketchley (University of Washington) for permissions regarding the Emma B. Andrews archival materials.
