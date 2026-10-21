"""Build a deterministic Lambda archive; contains source only, never local data."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
output = ROOT / "artifacts" / "backend.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
    for path in sorted((ROOT / "backend").glob("*.py")):
        if path.name in {"server.py", "audit.py"}:
            continue
        info = ZipInfo(path.relative_to(ROOT).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        archive.writestr(info, path.read_bytes())
print("Built", output)
