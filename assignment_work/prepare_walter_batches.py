import json
from pathlib import Path

from docx import Document


SOURCE = Path(
    r"C:\Users\Acer\Documents\MathsRush3D\deliverables"
    r"\Math_Rush_3D_Application_Development_Report_Submission.docx"
)
OUTPUT = Path(
    r"C:\Users\Acer\Documents\MathsRush3D\assignment_work"
    r"\walter_batches.json"
)

# Main prose paragraphs only. Headings, contents, lists, captions, references,
# tables and short evidence labels are preserved exactly as they appear.
PARAGRAPH_INDICES = [
    19, 37, 38, 39, 40, 41, 42, 45, 47, 58, 61, 85, 94, 110, 118, 119,
    120, 122, 123, 124, 126, 127, 129, 136, 138, 143, 144, 145, 148, 158,
    163, 166, 168, 180, 181,
]


document = Document(SOURCE)
batches = [
    {"paragraph_index": index, "source": document.paragraphs[index].text}
    for index in PARAGRAPH_INDICES
]
OUTPUT.write_text(json.dumps(batches, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Prepared {len(batches)} paragraphs in {OUTPUT}")
