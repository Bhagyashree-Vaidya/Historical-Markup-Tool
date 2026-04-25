"""Parser for Transkribus PAGE XML exports.

PAGE XML schema: http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15
Transkribus exports one PAGE XML file per page, or a ZIP of multiple pages.

Extracts:
  - Plain text (preserving paragraph/line structure)
  - Region coordinates (for TEI <zone> elements)
  - Page metadata (image filename, dimensions)
  - Confidence scores where available
"""
from lxml import etree
from typing import Optional, List, Tuple

# Transkribus may use any of these namespace variants
PAGE_NS_LIST = [
    "http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15",
    "http://schema.primaresearch.org/PAGE/gts/pagecontent/2010-03-19",
    "http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15",
]


def _ns(root: etree._Element) -> str:
    """Detect the PAGE XML namespace from the root element."""
    tag = root.tag  # e.g. "{http://schema...}PcGts"
    if tag.startswith("{"):
        return tag[1:tag.index("}")]
    # Fall back to first known namespace
    return PAGE_NS_LIST[0]


def parse_pagexml(xml_bytes: bytes) -> dict:
    """Parse a single Transkribus PAGE XML file.

    Returns a dict with:
        text        : str   — full plain text, paragraphs separated by \\n\\n
        regions     : list  — [{id, coords_points, text, lines: [{id, coords_points, text}]}]
        image_file  : str   — original image filename
        image_w/h   : int   — image dimensions (for coordinate normalisation)
        page_index  : int   — page number if embedded in XML (defaults to 1)
    """
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as e:
        raise ValueError(f"Invalid XML: {e}")

    ns = _ns(root)
    P = f"{{{ns}}}"  # namespace prefix shorthand

    # --- Page element ---
    page_el = root.find(f".//{P}Page")
    if page_el is None:
        raise ValueError("No <Page> element found. Is this a valid PAGE XML file?")

    image_file = page_el.get("imageFilename", "")
    image_w = int(page_el.get("imageWidth", 0))
    image_h = int(page_el.get("imageHeight", 0))

    regions = []
    paragraph_texts = []

    # --- TextRegions (reading order preserved by Transkribus) ---
    # Try to honour ReadingOrder if present
    reading_order_ids = _reading_order(root, P)
    text_regions = {
        r.get("id"): r
        for r in page_el.findall(f".//{P}TextRegion")
    }

    # Use reading order if available, else document order
    ordered_regions = []
    if reading_order_ids:
        for rid in reading_order_ids:
            if rid in text_regions:
                ordered_regions.append(text_regions[rid])
        # Append any regions not in reading order
        for rid, r in text_regions.items():
            if rid not in reading_order_ids:
                ordered_regions.append(r)
    else:
        ordered_regions = list(text_regions.values())

    for region_el in ordered_regions:
        region_id = region_el.get("id", "")
        region_coords = _coords(region_el, P)
        region_type = region_el.get("type", "paragraph")

        # Skip non-text regions (marginalia tags, etc.) — still extract text
        lines = []
        line_texts = []

        for line_el in region_el.findall(f".//{P}TextLine"):
            line_id = line_el.get("id", "")
            line_coords = _coords(line_el, P)
            line_text = _best_text(line_el, P)
            if line_text:
                lines.append({
                    "id": line_id,
                    "coords": line_coords,
                    "text": line_text,
                })
                line_texts.append(line_text)

        # Prefer the region-level TextEquiv if present (full region text)
        region_text = _best_text(region_el, P, children_only=True)
        if not region_text and line_texts:
            region_text = " ".join(line_texts)

        if region_text:
            regions.append({
                "id": region_id,
                "type": region_type,
                "coords": region_coords,
                "text": region_text,
                "lines": lines,
            })
            paragraph_texts.append(region_text)

    full_text = "\n\n".join(paragraph_texts)

    return {
        "text": full_text,
        "regions": regions,
        "image_file": image_file,
        "image_w": image_w,
        "image_h": image_h,
    }


def parse_pagexml_multi(files: List[Tuple[str, bytes]]) -> dict:
    """Parse multiple PAGE XML files (e.g. from a multi-page export).

    files: list of (filename, xml_bytes) tuples, sorted by filename (page order).
    Returns combined result with all pages concatenated.
    """
    all_texts = []
    all_regions = []
    errors = []

    for filename, xml_bytes in files:
        try:
            result = parse_pagexml(xml_bytes)
            all_texts.append(result["text"])
            for r in result["regions"]:
                r["page"] = filename  # tag region with source page
                all_regions.append(r)
        except Exception as e:
            errors.append(f"{filename}: {e}")

    return {
        "text": "\n\n".join(all_texts),
        "regions": all_regions,
        "page_count": len(files),
        "errors": errors,
    }


# --- Helpers ---

def _coords(el: etree._Element, P: str) -> Optional[str]:
    """Extract Coords points string from an element."""
    coords_el = el.find(f"{P}Coords")
    if coords_el is not None:
        return coords_el.get("points")
    return None


def _best_text(el: etree._Element, P: str, children_only: bool = False) -> str:
    """Get the best available text from a TextEquiv element.

    Transkribus can have multiple TextEquiv elements with different confidence.
    We take the one with the highest @conf, or the first if no conf given.
    children_only=True: only look at direct TextEquiv children (not nested).
    """
    if children_only:
        candidates = el.findall(f"{P}TextEquiv")
    else:
        # Get TextEquiv that are direct children only (avoid nested line TextEquivs)
        candidates = [c for c in el if c.tag == f"{P}TextEquiv"]

    if not candidates:
        return ""

    # Sort by @conf descending if available
    def conf(te):
        try:
            return float(te.get("conf", "0"))
        except ValueError:
            return 0.0

    best = max(candidates, key=conf)
    unicode_el = best.find(f"{P}Unicode")
    if unicode_el is not None and unicode_el.text:
        return unicode_el.text.strip()
    return ""


def _reading_order(root: etree._Element, P: str) -> list[str]:
    """Extract region IDs in reading order from ReadingOrder element."""
    ids = []
    ro = root.find(f".//{P}ReadingOrder")
    if ro is None:
        return ids
    # OrderedGroup or UnorderedGroup
    for group in ro.iter():
        ref = group.get("regionRef")
        if ref:
            ids.append(ref)
    return ids
