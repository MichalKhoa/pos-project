# Složka pro Dokumentaci Českého EET (Elektronická Evidence Tržeb)

Tato složka slouží pro ukládání oficiálních specifikací, certifikátů a technických metodik pro **EET 2.0 / Finanční správu ČR**.

## 📂 Struktura Složek:

```
docs/
├── convert_pdf_to_md.py    # Python skript pro konverzi PDF specifikací na Markdown
├── README.md               # Návod k použití
└── eet_docs/
    ├── markdown/           # Vygenerované .md soubory přístupné pro AI asistenta
    ├── eet_specifikace.pdf # Vložte sem vaše české EET dokumenty v PDF
    └── metodika_eet.pdf
```

## 🛠️ Jak Konvertovat PDF Specifikace na Markdown:

1. Vložte vaše EET PDF soubory do složky [`docs/eet_docs/`](file:///home/misko/Documents/pos-eet-himmel/docs/eet_docs/).
2. Spusťte konverzní skript z terminálu:
   ```bash
   python3 docs/convert_pdf_to_md.py
   ```
3. Skript automaticky vygeneruje odpovídající `.md` dokumenty do složky [`docs/eet_docs/markdown/`](file:///home/misko/Documents/pos-eet-himmel/docs/eet_docs/markdown/). AI asistent si z nich okamžitě načte přesnou technickou specifikaci pro implementaci EET backendu.
