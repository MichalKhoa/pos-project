#!/usr/bin/env python3
"""
EET PDF Documentation Converter Script
Converts Czech EET PDF specification files into Markdown (.md) format
so the AI assistant can read and implement exact fiscal regulations.
"""

import os
import sys
import subprocess
from pathlib import Path

# Paths
DOCS_DIR = Path(__file__).parent / "eet_docs"
OUTPUT_DIR = DOCS_DIR / "markdown"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def convert_pdf_with_pypdf(pdf_path: Path) -> str:
    """Try converting PDF to text using pypdf library."""
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        markdown_pages = []
        
        markdown_pages.append(f"# {pdf_path.stem.replace('_', ' ').title()}\n")
        markdown_pages.append(f"*Converted from `{pdf_path.name}` ({len(reader.pages)} pages)*\n\n---\n")

        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            markdown_pages.append(f"## Strana {idx + 1}\n\n{text.strip()}\n\n---\n")
            
        return "\n".join(markdown_pages)
    except ImportError:
        return None
    except Exception as e:
        print(f"Error using pypdf for {pdf_path.name}: {e}")
        return None


def convert_pdf_with_pdftotext(pdf_path: Path) -> str:
    """Try converting PDF to text using system 'pdftotext' command."""
    try:
        result = subprocess.run(
            ["pdftotext", str(pdf_path), "-"],
            capture_output=True,
            text=True,
            check=True
        )
        text = result.stdout
        markdown_content = f"# {pdf_path.stem.replace('_', ' ').title()}\n\n"
        markdown_content += f"*Converted from `{pdf_path.name}` using pdftotext*\n\n---\n\n"
        markdown_content += text
        return markdown_content
    except (subprocess.SubprocessError, FileNotFoundError):
        return None


def convert_all_pdfs():
    """Scan docs/eet_docs for PDF files and convert them to Markdown."""
    pdf_files = list(DOCS_DIR.glob("*.pdf")) + list(DOCS_DIR.glob("*.PDF"))
    
    if not pdf_files:
        print(f"📁 Žádné soubory .pdf nebyly nalezeny v adresáři: {DOCS_DIR.resolve()}")
        print(f"👉 Vložte české EET dokumenty (např. eet_specifikace.pdf) do složky: {DOCS_DIR.resolve()}")
        return

    print(f"🚀 Nalezeno {len(pdf_files)} PDF souborů ke konverzi...")

    for pdf in pdf_files:
        print(f"📄 Konvertuji: {pdf.name} ...")
        
        # Try pypdf first, then pdftotext
        md_text = convert_pdf_with_pypdf(pdf)
        if md_text is None:
            md_text = convert_pdf_with_pdftotext(pdf)

        if md_text:
            output_file = OUTPUT_DIR / f"{pdf.stem}.md"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(md_text)
            print(f"  ✅ Uloženo jako Markdown: {output_file.name}")
        else:
            print(f"  ❌ Nepodařilo se konvertovat {pdf.name}. Nainstalujte 'pypdf' (pip install pypdf) nebo 'poppler-utils'.")

    print(f"\n🎉 Dokončeno! Vygenerované Markdown soubory naleznete v: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    convert_all_pdfs()
