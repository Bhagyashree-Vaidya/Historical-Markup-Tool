"""Generate TEI XML from annotated text."""
from typing import Optional
from lxml import etree
from datetime import date


TEI_NS = "http://www.tei-c.org/ns/1.0"
XML_NS = "http://www.w3.org/XML/1998/namespace"
NSMAP = {None: TEI_NS}


def generate_tei(text: str, entities: list, metadata: Optional[dict] = None) -> str:
    """Build a TEI XML document from raw text and entity annotations.

    Args:
        text: The original raw text.
        entities: List of entity dicts with keys: text, start, end, tei_tag, ref (optional).
        metadata: Optional dict with title, author, date fields.
    """
    metadata = metadata or {}

    root = etree.Element("TEI", nsmap=NSMAP)
    root.set(f"{{{XML_NS}}}id", "eba-markup")

    # --- teiHeader ---
    header = etree.SubElement(root, "teiHeader")
    file_desc = etree.SubElement(header, "fileDesc")

    title_stmt = etree.SubElement(file_desc, "titleStmt")
    title_el = etree.SubElement(title_stmt, "title")
    title_el.text = metadata.get("title", "Emma B. Andrews Diary Entry")
    if metadata.get("author"):
        author_el = etree.SubElement(title_stmt, "author")
        author_el.text = metadata["author"]

    pub_stmt = etree.SubElement(file_desc, "publicationStmt")
    publisher = etree.SubElement(pub_stmt, "publisher")
    publisher.text = "Newbook Digital Texts / Emma B. Andrews Diary Project"
    pub_date = etree.SubElement(pub_stmt, "date")
    pub_date.text = date.today().isoformat()

    source_desc = etree.SubElement(file_desc, "sourceDesc")
    p_source = etree.SubElement(source_desc, "p")
    p_source.text = metadata.get("source", "Transcribed from original manuscript")

    # --- text/body ---
    text_el = etree.SubElement(root, "text")
    body = etree.SubElement(text_el, "body")

    # Split text into paragraphs
    paragraphs = text.split("\n\n") if "\n\n" in text else [text]

    # Build a sorted, non-overlapping entity list
    sorted_ents = sorted(entities, key=lambda e: e["start"])

    for para_text in paragraphs:
        # Find the paragraph boundaries in original text
        para_start = text.find(para_text)
        para_end = para_start + len(para_text)

        p_el = etree.SubElement(body, "p")

        # Filter entities in this paragraph
        para_ents = [
            e for e in sorted_ents
            if e["start"] >= para_start and e["end"] <= para_end
        ]

        # Build mixed content: text + entity elements
        cursor = para_start
        last_el = None

        for ent in para_ents:
            # Add text before this entity
            if ent["start"] > cursor:
                preceding = text[cursor:ent["start"]]
                if last_el is None:
                    p_el.text = (p_el.text or "") + preceding
                else:
                    last_el.tail = (last_el.tail or "") + preceding

            # Create entity element
            ent_el = etree.SubElement(p_el, ent["tei_tag"])
            ent_el.text = ent["text"]
            if ent.get("ref"):
                ent_el.set("ref", ent["ref"])

            last_el = ent_el
            cursor = ent["end"]

        # Trailing text after last entity
        if cursor < para_end:
            trailing = text[cursor:para_end]
            if last_el is None:
                p_el.text = (p_el.text or "") + trailing
            else:
                last_el.tail = (last_el.tail or "") + trailing

    # Serialize
    xml_bytes = etree.tostring(
        root,
        pretty_print=True,
        xml_declaration=True,
        encoding="UTF-8",
    )
    return xml_bytes.decode("utf-8")
