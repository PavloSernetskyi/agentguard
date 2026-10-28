"""Build the Lambda source archive; optionally vendor Python 3.12 x86_64 assistant dependencies."""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
output = ROOT / "artifacts" / "backend.zip"
output.parent.mkdir(exist_ok=True)

parser = argparse.ArgumentParser()
parser.add_argument("--with-assistant-deps", action="store_true",
                    help="vendor the pinned Strands/OpenAI packages for Python 3.12 Lambda x86_64")
args = parser.parse_args()


def add_file(archive, path, archive_path):
    info = ZipInfo(archive_path, date_time=(2026, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    archive.writestr(info, path.read_bytes())


def build(dependency_root=None):
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        source_files = []
        for package in ("backend", "agentguard"):
            source_files.extend((ROOT / package).rglob("*.py"))
        for path in sorted(source_files):
            if path.parent.name == "backend" and path.name in {"server.py", "audit.py"}:
                continue
            add_file(archive, path, path.relative_to(ROOT).as_posix())
        if dependency_root:
            for path in sorted(Path(dependency_root).rglob("*")):
                if path.is_file() and "__pycache__" not in path.parts:
                    add_file(archive, path, path.relative_to(dependency_root).as_posix())


if args.with_assistant_deps:
    with tempfile.TemporaryDirectory(prefix="agentguard-lambda-deps-") as dependency_root:
        subprocess.run([
            sys.executable, "-m", "pip", "install", "--disable-pip-version-check",
            "--only-binary=:all:", "--platform", "manylinux2014_x86_64",
            "--implementation", "cp", "--python-version", "312", "--abi", "cp312",
            "--target", dependency_root, "-r", str(ROOT / "requirements-assistant.txt"),
        ], check=True)
        build(dependency_root)
else:
    build()

print("Built", output)
