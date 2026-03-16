import mimetypes
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, RedirectResponse

from app.config import settings

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _resolve_local_path(org: str, dataset: str, path: str) -> Path | None:
    """Return the local filesystem path if the file exists, else None.

    Also validates that the resolved path stays within DATA_ROOT to prevent
    directory traversal attacks.
    """
    local_path = (settings.DATA_ROOT / org / dataset / path).resolve()
    data_root_resolved = settings.DATA_ROOT.resolve()
    if not str(local_path).startswith(str(data_root_resolved)):
        return None
    if local_path.is_file():
        return local_path
    return None


@router.api_route("/{org}/{dataset}/resolve/{path:path}", methods=["GET", "HEAD"])
async def resolve_file(org: str, dataset: str, path: str):
    """Unified file resolution endpoint.

    - video paths (videos/*) -> 302 redirect to COS URL
    - other paths -> serve local file, or 302 redirect to HuggingFace
    """
    # Video files: redirect to COS
    if path.startswith("videos/") and settings.COS_BASE_URL:
        cos_url = f"{settings.COS_BASE_URL.rstrip('/')}/{org}/{dataset}/{path}"
        return RedirectResponse(url=cos_url, status_code=302)

    # Try local file
    local_path = _resolve_local_path(org, dataset, path)
    if local_path is not None:
        media_type, _ = mimetypes.guess_type(str(local_path))
        return FileResponse(
            path=local_path,
            media_type=media_type or "application/octet-stream",
        )

    # Fallback to HuggingFace
    if settings.ENABLE_HF_FALLBACK:
        hf_url = f"{settings.HF_BASE_URL}/{org}/{dataset}/resolve/main/{path}"
        return RedirectResponse(url=hf_url, status_code=302)

    raise HTTPException(status_code=404, detail=f"File not found: {path}")
