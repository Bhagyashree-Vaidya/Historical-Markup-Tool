"""Transkribus API client for HTR transcription of historical document images.

Workflow per image:
  1. login()           → Bearer token
  2. upload_image()    → docId  (polls upload job until done)
  3. trigger_htr()     → jobId
  4. poll_job()        → waits until FINISHED / FAILED
  5. fetch_pagexml()   → raw PAGE XML bytes
  6. parse via pagexml_parser.parse_pagexml()
  7. delete_document() → keeps collection tidy (optional)

Auth: OpenID Connect (username + password → access_token + refresh_token)
Base: https://transkribus.eu/TrpServer/rest
"""
import io
import time
import zipfile
from typing import Optional, List, Dict, Any

import requests
from lxml import etree

AUTH_URL = (
    "https://account.readcoop.eu/auth/realms/readcoop"
    "/protocol/openid-connect/token"
)
CLIENT_ID = "transkribus-api-client"
BASE = "https://transkribus.eu/TrpServer/rest"

# Seconds between job-status polls
POLL_INTERVAL = 5
# Max seconds to wait for a job (upload or HTR)
JOB_TIMEOUT = 600


class TranskribusError(Exception):
    pass


class TranskribusClient:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self._session = requests.Session()

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    def login(self) -> None:
        """Obtain access + refresh tokens via OpenID Connect."""
        resp = requests.post(
            AUTH_URL,
            data={
                "grant_type": "password",
                "username": self.username,
                "password": self.password,
                "client_id": CLIENT_ID,
            },
        )
        if resp.status_code != 200:
            raise TranskribusError(
                f"Login failed ({resp.status_code}): {resp.text[:200]}"
            )
        data = resp.json()
        self.access_token = data["access_token"]
        self.refresh_token = data["refresh_token"]
        self._session.headers.update(
            {"Authorization": f"Bearer {self.access_token}"}
        )

    def refresh_auth(self) -> None:
        """Refresh the access token using the stored refresh token."""
        resp = requests.post(
            AUTH_URL,
            data={
                "grant_type": "refresh_token",
                "client_id": CLIENT_ID,
                "refresh_token": self.refresh_token,
            },
        )
        if resp.status_code != 200:
            # Refresh token expired — re-login
            self.login()
            return
        data = resp.json()
        self.access_token = data["access_token"]
        if "refresh_token" in data:
            self.refresh_token = data["refresh_token"]
        self._session.headers.update(
            {"Authorization": f"Bearer {self.access_token}"}
        )

    def _get(self, path: str, **kwargs) -> requests.Response:
        resp = self._session.get(f"{BASE}{path}", **kwargs)
        if resp.status_code == 401:
            self.refresh_auth()
            resp = self._session.get(f"{BASE}{path}", **kwargs)
        return resp

    def _post(self, path: str, **kwargs) -> requests.Response:
        resp = self._session.post(f"{BASE}{path}", **kwargs)
        if resp.status_code == 401:
            self.refresh_auth()
            resp = self._session.post(f"{BASE}{path}", **kwargs)
        return resp

    def _delete(self, path: str, **kwargs) -> requests.Response:
        resp = self._session.delete(f"{BASE}{path}", **kwargs)
        if resp.status_code == 401:
            self.refresh_auth()
            resp = self._session.delete(f"{BASE}{path}", **kwargs)
        return resp

    # ------------------------------------------------------------------
    # Collections
    # ------------------------------------------------------------------

    def list_collections(self) -> List[Dict]:
        resp = self._get("/collections")
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # HTR Models
    # ------------------------------------------------------------------

    def list_htr_models(self, col_id: Optional[int] = None) -> List[Dict]:
        """Return HTR models available to this account via the collection model list.

        Uses /recognition/{colId}/list which returns XML with all accessible models.
        Results are sorted: English-language models first, then alphabetically.
        """
        if col_id is None:
            col_id = 2391346  # default collection

        resp = self._get(f"/recognition/{col_id}/list")
        if resp.status_code != 200:
            raise TranskribusError(
                f"Could not fetch model list ({resp.status_code}). "
                "Make sure the collection ID is correct."
            )

        try:
            root = etree.fromstring(resp.content)
        except etree.XMLSyntaxError as e:
            raise TranskribusError(f"Unexpected response from model list: {e}")

        models = []
        for htr in root.findall(".//trpHtr"):
            model_id = htr.findtext("htrId", "").strip()
            name = htr.findtext("name", "Unnamed").strip()
            description = htr.findtext("description", "").strip()
            language = htr.findtext("language", "").strip()
            nr_tokens = htr.findtext("nrOfTokens", "0").strip()
            if not model_id:
                continue
            models.append({
                "modelId": model_id,
                "name": name,
                "description": description[:120],
                "language": language,
                "nrOfTokens": nr_tokens,
            })

        # Sort: English models first, then alphabetical
        def sort_key(m):
            name_lower = m["name"].lower()
            lang_lower = m["language"].lower()
            is_english = "english" in lang_lower or "english" in name_lower
            return (0 if is_english else 1, name_lower)

        models.sort(key=sort_key)
        return models

    # ------------------------------------------------------------------
    # Document upload
    # ------------------------------------------------------------------

    def upload_image(
        self,
        col_id: int,
        image_bytes: bytes,
        filename: str,
        title: Optional[str] = None,
    ) -> int:
        """Upload a single image to a Transkribus collection.

        Packages the image into a ZIP (Transkribus upload format) and posts it.
        Polls the upload job until complete.

        Returns: docId (int)
        """
        title = title or filename.rsplit(".", 1)[0]

        # Build upload ZIP: image + metadata.xml
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(filename, image_bytes)
            metadata_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<trpDocMetadata>
  <docId>-1</docId>
  <collId>{col_id}</collId>
  <title>{title}</title>
  <nrOfPages>1</nrOfPages>
</trpDocMetadata>"""
            zf.writestr("metadata.xml", metadata_xml)
        zip_bytes = zip_buf.getvalue()

        resp = self._post(
            f"/collections/{col_id}/upload",
            data=zip_bytes,
            headers={"Content-Type": "application/octet-stream"},
        )
        if resp.status_code not in (200, 201):
            raise TranskribusError(
                f"Upload failed ({resp.status_code}): {resp.text[:300]}"
            )

        # Response may be a job ID (int) or a JSON object
        try:
            job_id = int(resp.text.strip())
        except ValueError:
            try:
                job_id = resp.json().get("jobId") or resp.json().get("id")
            except Exception:
                raise TranskribusError(f"Unexpected upload response: {resp.text[:200]}")

        # Poll upload job
        job = self._poll_job(job_id, label="Upload")
        # Extract docId from job result
        doc_id = self._extract_doc_id(job)
        if not doc_id:
            raise TranskribusError(
                f"Upload job finished but no docId found. Job: {job}"
            )
        return doc_id

    def _extract_doc_id(self, job: Dict) -> Optional[int]:
        """Try several known locations for docId in a finished job."""
        for key in ("docId", "resultLink", "result"):
            val = job.get(key)
            if val and str(val).isdigit():
                return int(val)
        # resultLink may be a URL containing /docId/
        result_link = job.get("resultLink", "")
        if result_link:
            parts = result_link.strip("/").split("/")
            for part in reversed(parts):
                if part.isdigit():
                    return int(part)
        return None

    # ------------------------------------------------------------------
    # HTR
    # ------------------------------------------------------------------

    def trigger_htr(
        self,
        col_id: int,
        doc_id: int,
        model_id: int,
        page_nr: int = 1,
    ) -> int:
        """Trigger HTR on a document page. Returns jobId."""
        payload = {
            "docId": doc_id,
            "pageList": {"pages": [{"pageNr": page_nr}]},
        }
        resp = self._post(
            f"/pylaia/{col_id}/{model_id}/recognition",
            json=payload,
        )
        if resp.status_code not in (200, 201):
            # Fallback to older endpoint
            resp = self._post(
                f"/recognition/{col_id}/{model_id}/recognition",
                json=payload,
            )
        if resp.status_code not in (200, 201):
            raise TranskribusError(
                f"HTR trigger failed ({resp.status_code}): {resp.text[:300]}"
            )
        try:
            return int(resp.text.strip())
        except ValueError:
            return resp.json().get("jobId") or resp.json().get("id")

    # ------------------------------------------------------------------
    # Jobs
    # ------------------------------------------------------------------

    def _poll_job(self, job_id: int, label: str = "Job") -> Dict:
        """Poll a job until FINISHED or FAILED. Returns final job dict."""
        deadline = time.time() + JOB_TIMEOUT
        while time.time() < deadline:
            resp = self._get(f"/jobs/{job_id}")
            if resp.status_code != 200:
                time.sleep(POLL_INTERVAL)
                continue
            job = resp.json()
            state = job.get("state", "").upper()
            if state in ("FINISHED", "DONE"):
                return job
            if state in ("FAILED", "ERROR", "KILLED"):
                raise TranskribusError(
                    f"{label} job {job_id} failed with state {state}: "
                    f"{job.get('description', '')}"
                )
            time.sleep(POLL_INTERVAL)
        raise TranskribusError(
            f"{label} job {job_id} timed out after {JOB_TIMEOUT}s"
        )

    def get_job_status(self, job_id: int) -> Dict:
        """Return raw job status dict."""
        resp = self._get(f"/jobs/{job_id}")
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Results
    # ------------------------------------------------------------------

    def fetch_pagexml(self, col_id: int, doc_id: int) -> bytes:
        """Fetch the latest PAGE XML for a document. Returns raw XML bytes."""
        resp = self._get(
            f"/collections/{col_id}/{doc_id}/fulldoc.xml",
            params={"nrOfTranscripts": 1},
        )
        if resp.status_code != 200:
            raise TranskribusError(
                f"Failed to fetch PAGE XML ({resp.status_code}): {resp.text[:200]}"
            )
        return resp.content

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def delete_document(self, col_id: int, doc_id: int) -> None:
        """Delete a document from a collection (used for cleanup after transcription)."""
        resp = self._delete(f"/collections/{col_id}/{doc_id}")
        # 200 or 204 = success; ignore errors silently on cleanup
        pass

    # ------------------------------------------------------------------
    # High-level: full pipeline
    # ------------------------------------------------------------------

    def transcribe_image(
        self,
        col_id: int,
        image_bytes: bytes,
        filename: str,
        model_id: int,
        cleanup: bool = True,
        on_progress=None,
    ) -> str:
        """Full pipeline: image → Transkribus HTR → plain text.

        Args:
            col_id:      Transkribus collection ID.
            image_bytes: Raw image file bytes.
            filename:    Original filename (used as document title).
            model_id:    HTR model ID to use.
            cleanup:     Delete the uploaded document after transcription.
            on_progress: Optional callable(step: str) for progress updates.

        Returns: Extracted plain text string.
        """
        from backend.pagexml_parser import parse_pagexml

        def progress(msg):
            if on_progress:
                on_progress(msg)

        progress("Uploading image to Transkribus...")
        doc_id = self.upload_image(col_id, image_bytes, filename)

        progress("Running HTR recognition...")
        job_id = self.trigger_htr(col_id, doc_id, model_id)

        progress("Waiting for transcription to complete...")
        self._poll_job(job_id, label="HTR")

        progress("Fetching transcription...")
        xml_bytes = self.fetch_pagexml(col_id, doc_id)

        if cleanup:
            progress("Cleaning up...")
            self.delete_document(col_id, doc_id)

        result = parse_pagexml(xml_bytes)
        return result["text"]
