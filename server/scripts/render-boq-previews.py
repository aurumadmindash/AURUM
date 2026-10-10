"""Render matching mobile previews after regenerating the BOQ PDFs.

Requires PyMuPDF and Pillow. Run from the repository root; deployment serves
the resulting static WebP pages and does not need Python or a PDF plugin.
"""
from pathlib import Path
import pymupdf

root = Path(__file__).resolve().parents[2] / 'client' / 'public' / 'samples'
for name in ['boq-sample', 'boq-client-completed']:
    destination = root / 'previews' / name
    destination.mkdir(parents=True, exist_ok=True)
    with pymupdf.open(root / f'{name}.pdf') as document:
        for index, page in enumerate(document):
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
            (destination / f'page-{index + 1}.webp').write_bytes(
                pixmap.pil_tobytes(format='WEBP', quality=88)
            )
        print(f'{name}: {len(document)} mobile preview pages')
