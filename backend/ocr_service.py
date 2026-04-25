"""OCR service — Claude claude-sonnet-4-5 via Anthropic API.

Requires ANTHROPIC_API_KEY environment variable.
Set it in Cloud Run env vars (or locally in your shell).
"""
import os
import io
import base64
from PIL import Image
import anthropic

# ── Config ─────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
# claude-sonnet-4-5: best vision model — excellent for historical handwriting
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

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
- Common proper names: Emma, John (her companion), Luxor, Aswan, Cairo, Nile, \
  dahabiyeh (Nile houseboat)
- Common topics: weather, health, visitors, excavations, social calls, \
  shopping in bazaars, temple visits
- Dates written as: "Jan. 3rd", "Thursday", "March 15, 1900"

Begin the transcription now — output the raw transcription only:"""


def _preprocess_image(image_bytes: bytes) -> tuple[bytes, str]:
    """Enhance image and return (bytes, media_type).
    Upsamples small images and converts to JPEG for consistency.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Convert to RGB
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        # Upsample if too small
        w, h = img.size
        longest = max(w, h)
        if longest < 1500:
            scale = 1500 / longest
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, "image/jpeg"


def extract_text_from_image(image_bytes: bytes) -> str:
    """Send an image to Claude claude-sonnet-4-5 and return the transcribed text.

    Args:
        image_bytes: Raw bytes of a JPG / PNG / TIF image.

    Returns:
        Transcribed plain text string.

    Raises:
        RuntimeError: If the Anthropic API call fails.
    """
    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. "
            "Add it to your Cloud Run environment variables."
        )

    processed, media_type = _preprocess_image(image_bytes)
    image_b64 = base64.standard_b64encode(processed).decode("utf-8")

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": TRANSCRIPTION_PROMPT,
                        },
                    ],
                }
            ],
        )
        return message.content[0].text.strip()
    except anthropic.AuthenticationError:
        raise RuntimeError("Invalid ANTHROPIC_API_KEY — check your API key.")
    except anthropic.RateLimitError:
        raise RuntimeError("Anthropic rate limit reached — please try again shortly.")
    except Exception as e:
        raise RuntimeError(f"Claude transcription failed: {e}") from e
