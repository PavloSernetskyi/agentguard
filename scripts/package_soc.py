"""Build the small, separate reporting Lambda package without store or agent code."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


root = Path(__file__).resolve().parents[1]
target = root / "artifacts" / "soc.zip"
target.parent.mkdir(exist_ok=True)
with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
    for name in ("backend/__init__.py", "backend/dynamo.py", "backend/soc_cloud.py"):
        entry = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        archive.writestr(entry, (root / name).read_bytes())
print(f"Built reporting package ({target.stat().st_size} bytes)")
