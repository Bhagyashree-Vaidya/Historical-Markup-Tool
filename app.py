"""Historical Markup Tool — Emma B. Andrews Diary Project.

A web application for Named Entity Recognition and TEI XML generation
from historical diary and letter transcriptions.

Transcription: Gemini 2.0 Flash via Google Cloud Vertex AI.
Hosting: Google Cloud Run.
"""
import io
import json
import os
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from backend.ner_pipeline import extract_entities, ENTITY_COLORS
from backend.pagexml_parser import parse_pagexml, parse_pagexml_multi
from backend.tei_generator import generate_tei

app = FastAPI(title="Historical Markup Tool", version="2.0")

BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend" / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "frontend" / "templates")


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "entity_colors": ENTITY_COLORS,
    })


# ---------------------------------------------------------------------------
# OCR — Claude Vision
# ---------------------------------------------------------------------------

@app.post("/api/ocr")
async def ocr_image(file: UploadFile = File(...)):
    """Send an image to Claude Vision and return the transcribed text."""
    from backend.ocr_service import extract_text_from_image
    try:
        image_bytes = await file.read()
        text = extract_text_from_image(image_bytes)
        if not text.strip():
            return JSONResponse(
                {"error": "No text extracted. Try a clearer image."},
                status_code=422,
            )
        return JSONResponse({"text": text})
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse({"error": f"Transcription failed: {e}"}, status_code=500)


# ---------------------------------------------------------------------------
# Transkribus PAGE XML import
# ---------------------------------------------------------------------------

@app.post("/api/import-pagexml")
async def import_pagexml(file: UploadFile = File(...)):
    """Parse a Transkribus PAGE XML export (.xml or .zip of multiple pages)."""
    try:
        raw = await file.read()
        filename = file.filename or ""

        if filename.lower().endswith(".zip"):
            pages = []
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                xml_names = sorted(
                    n for n in zf.namelist()
                    if n.lower().endswith(".xml") and not n.startswith("__")
                )
                if not xml_names:
                    return JSONResponse({"error": "No .xml files found in ZIP."}, status_code=422)
                for name in xml_names:
                    pages.append((name, zf.read(name)))
            result = parse_pagexml_multi(pages)
        elif filename.lower().endswith(".xml"):
            result = parse_pagexml(raw)
            result.setdefault("page_count", 1)
            result.setdefault("errors", [])
        else:
            return JSONResponse(
                {"error": "Upload a .xml or .zip exported from Transkribus."},
                status_code=400,
            )

        if not result.get("text", "").strip():
            return JSONResponse(
                {"error": "No text found. Is this a valid Transkribus PAGE XML export?"},
                status_code=422,
            )

        return JSONResponse({
            "text": result["text"],
            "page_count": result.get("page_count", 1),
            "region_count": len(result.get("regions", [])),
            "errors": result.get("errors", []),
        })
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=422)
    except Exception as e:
        return JSONResponse({"error": f"Import failed: {e}"}, status_code=500)


# ---------------------------------------------------------------------------
# NER
# ---------------------------------------------------------------------------

@app.post("/api/analyze")
async def analyze_text(text: str = Form(...)):
    result = extract_entities(text)
    return JSONResponse(result)


# ---------------------------------------------------------------------------
# TEI generation
# ---------------------------------------------------------------------------

@app.post("/api/tei")
async def generate_tei_xml(
    text: str = Form(...),
    entities: str = Form(...),
    title: str = Form(""),
    author: str = Form(""),
    source: str = Form(""),
):
    ent_list = json.loads(entities)
    metadata = {"title": title, "author": author, "source": source}
    xml = generate_tei(text, ent_list, metadata)
    return Response(content=xml, media_type="application/xml")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
