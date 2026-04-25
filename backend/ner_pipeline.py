"""Named Entity Recognition pipeline using spaCy."""
import spacy

_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


# Map spaCy labels to TEI-friendly categories
ENTITY_MAP = {
    "PERSON": "persName",
    "GPE": "placeName",
    "LOC": "placeName",
    "FAC": "placeName",
    "ORG": "orgName",
    "DATE": "date",
    "TIME": "time",
    "EVENT": "name",
    "WORK_OF_ART": "title",
    "NORP": "name",
}

# Colors for frontend highlighting
ENTITY_COLORS = {
    "persName": "#fbbf24",   # amber
    "placeName": "#60a5fa",  # blue
    "orgName": "#a78bfa",    # purple
    "date": "#34d399",       # green
    "time": "#34d399",       # green
    "title": "#f472b6",      # pink
    "name": "#fb923c",       # orange
}


def extract_entities(text: str) -> dict:
    """Run NER on text and return entities with positions."""
    nlp = get_nlp()
    doc = nlp(text)

    entities = []
    for ent in doc.ents:
        tei_tag = ENTITY_MAP.get(ent.label_, "name")
        entities.append({
            "text": ent.text,
            "start": ent.start_char,
            "end": ent.end_char,
            "label": ent.label_,
            "tei_tag": tei_tag,
            "color": ENTITY_COLORS.get(tei_tag, "#9ca3af"),
        })

    return {
        "text": text,
        "entities": entities,
    }
