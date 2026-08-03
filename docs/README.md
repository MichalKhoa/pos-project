# Dokumentace Českého EET (Elektronická Evidence Tržeb)

Tato složka slouží pro ukládání a správu oficiálních specifikací, certifikátů a technických metodik pro **EET 2.0 / Finanční správu ČR**.

---

## 📂 Dokumentační Struktura

```
docs/
├── plans/                          # Specifikace a Plány Implementace
│   ├── INVENTORY_IMPLEMENTATION_PLAN.md
│   ├── EET_HARDENING_PLAN.md
│   ├── DATABASE_SAFETY_PLAN.md
│   ├── PROMPTING_GUIDE.md
│   ├── PROMPT_QUESTIONNAIRE.md
│   └── security_and_stability_roadmap.md
├── guides/                         # Příručky pro Nastavení a Správu
│   ├── CASHIER_SETUP_GUIDE.md
│   ├── CSOB_TERMINAL_GUIDE.md
│   ├── LITESTREAM_R2_SETUP.md
│   ├── SCALING_AND_NETWORK_SECURITY.md
│   └── WINDOWS_SERVICE_SETUP.md
├── eet_docs/                       # Oficiální EET PDF & konvertovaný Markdown
├── csob_docs/                      # CSOB terminál dokumentace
└── convert_pdf_to_md.py            # Python skript pro konverzi PDF na Markdown
```

---

## 🛠️ Jak Konvertovat PDF Specifikace na Markdown

Skript [`convert_pdf_to_md.py`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/convert_pdf_to_md.py) automaticky prohledá složku [`eet_docs/`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/eet_docs/) a převede veškeré PDF specifikace do strukturovaného Markdownu.

### 1. Vložení PDF souborů
Vložte vaše EET PDF dokumenty (např. *Technická specifikace EET 2.0*, *Certifikační metodika*) do složky [`docs/eet_docs/`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/eet_docs/).

### 2. Spuštění konverzního skriptu
Spusťte skript z kořenového adresáře projektu:

```bash
# S využitím Python 3:
python docs/convert_pdf_to_md.py
```

Skript se nejprve pokusí použít Python knihovnu `pypdf` (`pip install pypdf`), a pokud není dostupná, použije systémový nástroj `pdftotext`.

### 3. Výstup
Skript vygeneruje odpovídající `.md` dokumenty do složky [`docs/eet_docs/markdown/`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/eet_docs/markdown/). AI asistent si z nich dokáže přečíst přesnou technickou specifikaci pro aktualizaci backendu.

---

## 🔑 Práce s EET Certifikáty PKCS#12 (`.p12` / `.pfx`)

Pro testovací prostředí (Playground) i ostrý provoz (Production) je vyžadován kryptografický certifikát poplatníka ve formátu PKCS#12 (`.p12` nebo `.pfx`).

### Umístění certifikátu
Uložte Váš certifikát do složky `backend/certs/` (např. `backend/certs/EET_CZ12345678.p12`).

### Konfigurace v aplikaci
V rozhraní **Nastavení (Settings)** zadáváte:
- **Cesta k certifikátu**: `certs/EET_CZ12345678.p12`
- **Heslo k certifikátu**: Heslo zadané při vygenerování na portálu Finanční správy ČR
- **Režim tržby**: `Standardní` (online) nebo `Zjednodušený` (offline)
- **ID provozovny**: Např. `11`
- **ID pokladny**: Např. `1`

---

## 📋 Standardy EET 2.0 v Himmel POS

1. **PKP (Podpisový Kód Poplatníka)**: RSA-SHA256 podpis kanonického řetězce tržby.
2. **BKP (Bezpečnostní Kód Poplatníka)**: SHA-1 hash z binárního podpisu PKP, formátovaný do 5 osmičkových hex skupin.
3. **WS-Security 1.0 SOAP**: Odesílání podepsaných SOAP zpráv přes HTTPS POST na servery Finanční správy ČR.
4. **FIK (Fiskální Identifikační Kód)**: Unikátný kód vrácený serverem Finanční správy ČR při úspěšné registraci tržby.
