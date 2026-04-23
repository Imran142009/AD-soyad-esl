import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
# Ensure REACT_APP_BACKEND_URL is present for tests
if not os.environ.get("REACT_APP_BACKEND_URL"):
    fe = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if fe.exists():
        for line in fe.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
                break
