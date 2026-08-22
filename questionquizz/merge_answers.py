#!/usr/bin/env python3
"""Merge header + answer batches into questions.txt"""
from pathlib import Path

ROOT = Path(__file__).parent
SOURCE = ROOT / "questions.txt"
OUTPUT = ROOT / "questions.txt"
BATCHES = [ROOT / f"answers_batch_{i}.txt" for i in range(1, 5)]


def read_header() -> list[str]:
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    header: list[str] = []
    for line in lines:
        if line.strip().startswith("#") or (not line.strip() and not header):
            header.append(line)
        elif "?" in line and " = " not in line:
            break
        elif not line.strip() and header:
            header.append(line)
    return header


def main() -> None:
    header = read_header()
    answered: list[str] = []
    for batch in BATCHES:
        if not batch.exists():
            raise SystemExit(f"Missing: {batch}")
        answered.extend(batch.read_text(encoding="utf-8").splitlines())

    # Validate
    missing = [l for l in answered if " = " not in l]
    if missing:
        raise SystemExit(f"{len(missing)} lines without answers")

    out_lines = header + [""] + answered
    OUTPUT.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    print(f"Written {len(answered)} questions to {OUTPUT}")


if __name__ == "__main__":
    main()
