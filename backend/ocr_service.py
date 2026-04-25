"""OCR service — Gemini 2.5 Pro via Google Cloud Vertex AI.

Uses Application Default Credentials (no API key required in code).
On Cloud Run the service account is granted Vertex AI User automatically.
Locally: run  gcloud auth application-default login  once.
"""
import os
import io
from PIL import Image

import vertexai
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig

# ── Project config ─────────────────────────────────────────────────────────
GCP_PROJECT  = os.environ.get("GCP_PROJECT",  "historical-markup-tool-v2")
GCP_LOCATION = os.environ.get("GCP_LOCATION", "us-central1")

# Model preference order — first available model wins
# gemini-2.5-pro-preview-05-06 is best but requires project allowlist;
# gemini-1.5-pro-002 is GA everywhere and excellent for handwriting
GEMINI_MODELS = [
    "gemini-2.5-pro-preview-05-06",
    "gemini-1.5-pro-002",
    "gemini-2.0-flash-001",
]

# Initialise once at import time
vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)

# ── Transcription prompt ───────────────────────────────────────────────────
TRANSCRIPTION_PROMPT = """You are an expert paleographer specialising in late Victorian \
and Edwardian English handwriting (1850–1920). You have decades of experience transcribing \
diaries, personal letters, and travel journals from this period.

This image is a page from the Emma B. Andrews collection — diary entries and letters \
written between 1889 and 1912, primarily during Nile River expeditions in Egypt. \
The handwriting is cursive American/English script of the period.

YOUR TASK: Produce a complete, faithful diplomatic transcription of every word visible.

TRANSCRIPTION RULES:
1. Transcribe EXACTLY as written — preserve original spelling (incl. errors), \
   punctuation, capitalisation, and abbreviations (Mr., Mrs., &, &c., viz., etc.)
2. Preserve the original line breaks exactly as they appear on the page
3. Preserve paragraph breaks with a blank line
4. For words you cannot read with confidence: use [?word] for a best guess, \
   or [illegible] only if truly undecipherable
5. For crossed-out text: use ~~strikethrough~~ notation
6. For interlinear additions (words written above/below the line): use ^insertion^
7. If text continues from a previous page or is cut off, transcribe what is visible
8. Do NOT add any commentary, labels, headings, or explanatory notes
9. Do NOT interpret or modernise the text — transcribe only what is written
10. If there are page numbers, dates, or marginalia, include them in their \
    approximate position

CONTEXT CLUES for this collection:
- Common proper names: Emma, John (her companion), Khnoumit (Egyptian crew), \
  Luxor, Aswan, Cairo, Nile, dahabiyeh (Nile houseboat)
- Common topics: weather, health, visitors, excavations, social calls, \
  shopping in bazaars, temple visits
- Dates written as: "Jan. 3rd", "Thursday", "March 15, 1900"

Begin the transcription now — output the raw transcription only:"""


def _detect_mime(image_bytes: bytes) -> str:
    """Return MIME type by inspecting the image with Pillow."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        fmt = (img.format or "").lower()
        return {
            "jpeg": "image/jpeg",
            "jpg":  "image/jpeg",
            "png":  "image/png",
            "tiff": "image/tiff",
            "tif":  "image/tiff",
            "gif":  "image/gif",
            "webp": "image/webp",
        }.get(fmt, "image/jpeg")
    except Exception:
        return "image/jpeg"


def _preprocess_image(image_bytes: bytes) -> bytes:
    """Enhance image quality for better OCR: upsample small images, convert to RGB."""
    try:
        img = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB (handles RGBA, palette, greyscale)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Upsample if the image is too small — Gemini benefits from ≥1000px on longest side
        w, h = img.size
        longest = max(w, h)
        if longest < 1500:
            scale = 1500 / longest
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        # Re-encode as high-quality JPEG
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92, optimize=True)
        return buf.getvalue()
    except Exception:
        return image_bytes  # Fall back to original if preprocessing fails


def extract_text_from_image(image_bytes: bytes) -> str:
    """Send an image to the best available Gemini model and return transcribed text.

    Tries models in preference order (2.5 Pro → 1.5 Pro → 2.0 Flash) so the
    service works regardless of which preview models are allowlisted.

    Args:
        image_bytes: Raw bytes of a JPG / PNG / TIF image.

    Returns:
        Transcribed plain text string.

    Raises:
        RuntimeError: If all models fail.
    """
    processed = _preprocess_image(image_bytes)
    image_part = Part.from_data(data=processed, mime_type="image/jpeg")

    last_error = None
    for model_name in GEMINI_MODELS:
        try:
            model = GenerativeModel(model_name)
            response = model.generate_content(
                [image_part, TRANSCRIPTION_PROMPT],
                generation_config=GenerationConfig(
                    temperature=0.0,
                    max_output_tokens=8192,
                ),
            )
            return response.text.strip()
        except Exception as e:
            # 404 = model not available in this project/region — try next
            last_error = e
            if "404" not in str(e) and "not found" not in str(e).lower():
                break  # Non-availability error — don't retry other models

    raise RuntimeError(f"Gemini transcription failed: {last_error}") from last_error
