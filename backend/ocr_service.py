"""OCR service — Gemini 2.0 Flash via Google Cloud Vertex AI.

Uses Application Default Credentials (no API key required in code).
On Cloud Run the service account is granted Vertex AI User automatically.
Locally: run  gcloud auth application-default login  once.
"""
import os
import io
from PIL import Image

import vertexai
from vertexai.generative_models import GenerativeModel, Part

# ── Project config ─────────────────────────────────────────────────────────
GCP_PROJECT  = os.environ.get("GCP_PROJECT",  "historical-markup-tool-v2")
GCP_LOCATION = os.environ.get("GCP_LOCATION", "us-central1")
GEMINI_MODEL = "gemini-2.0-flash"

# Initialise once at import time
vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)

# ── Transcription prompt ───────────────────────────────────────────────────
TRANSCRIPTION_PROMPT = """You are an expert paleographer and archival transcriber \
specialising in 19th and early 20th century English handwriting.

Carefully transcribe ALL the handwritten text visible in this image. \
This is a historical letter or diary page from the Emma B. Andrews collection (1889-1912 era).

Rules:
- Transcribe the text exactly as written, preserving original spelling, \
  punctuation, capitalisation, and line breaks
- Use [illegible] for words you truly cannot decipher
- Use [?word] when you can make a reasonable guess but are not certain
- Preserve paragraph breaks with blank lines
- If there are multiple columns, transcribe left to right, top to bottom
- Do NOT add any commentary, headers, or notes — output the raw transcription only
- Maintain original capitalisation and abbreviations (e.g. Mr., Mrs., &)

Transcribe now:"""


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


def extract_text_from_image(image_bytes: bytes) -> str:
    """Send an image to Gemini 2.0 Flash and return the transcribed text.

    Args:
        image_bytes: Raw bytes of a JPG / PNG / TIF image.

    Returns:
        Transcribed plain text string.

    Raises:
        RuntimeError: If the Vertex AI call fails.
    """
    mime_type  = _detect_mime(image_bytes)
    image_part = Part.from_data(data=image_bytes, mime_type=mime_type)

    try:
        model    = GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(
            [image_part, TRANSCRIPTION_PROMPT],
            generation_config={
                "temperature":       0.1,
                "max_output_tokens": 4096,
            },
        )
        return response.text.strip()
    except Exception as e:
        raise RuntimeError(f"Gemini transcription failed: {e}") from e
