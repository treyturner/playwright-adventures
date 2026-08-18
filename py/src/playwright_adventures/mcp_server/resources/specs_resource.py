from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class SpecResource:
    id: str
    name: str
    mime_type: str
    path: str
    content: str


SPEC_FILES = [
    ("journeys", "journeys.yaml", "application/yaml"),
    ("selectors", "selectors.md", "text/markdown"),
    ("testing-philosophy", "testing-philosophy.md", "text/markdown"),
]


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def load_spec_resources() -> List[SpecResource]:
    spec_dir = _repo_root() / "common" / "specs"
    resources: List[SpecResource] = []
    for resource_id, filename, mime_type in SPEC_FILES:
        file_path = spec_dir / filename
        content = file_path.read_text(encoding="utf-8")
        resources.append(
            SpecResource(
                id=resource_id,
                name=filename,
                mime_type=mime_type,
                path=str(file_path),
                content=content,
            )
        )
    return resources
