# Kompletní Technický a Provozní Souhrn EET 2.0 (Verze 4.1, 2026)

Tento dokument představuje ucelený souhrn všech **7 oficiálních dokumentů** Finanční správy ČR pro **Elektronickou Evidenci Tržeb 2.0 (EET 2.0)**.

---

## 1. Základní Přehled a Termíny

- **Implementovaná Verze Rozhraní**: **EET v4.1**
- **Platnost Neprodukčního Prostředí (Playground)**: Spuštěno do 1. 7. 2026 (`https://pg.trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4`)
- **Platnost Produkčního Prostředí**: Spuštění od 1. 1. 2027 (`https://trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4`)
- **Komunikační Protokol**: **HTTPS (TLS 1.2 / TLS 1.3) + SOAP 1.1 + WS-Security 1.0 (X.509 Profile)**
- **XML Namespace**: `http://fs.gov.cz/eet/schema/v4`

---

## 2. Žádost, Vydání a Automatizovaná Obnova Certifikátů

### **A. Získání Prvního Certifikátu (Ruční postup)**
1. Poplatník se přihlásí do portálu MOJE daně / DIS+ (`https://mojedane.gov.cz`).
2. V aplikaci **Správa pokladních certifikátů EET** požádá o nový pokladní certifikát.
3. Certifikát včetně párů RSA klíčů je bezpečně vygenerován na straně CA EET.
4. Poplatník si stáhne balíček ve formátu **PKCS#12 (`.p12`)** obsahující:
   - Soukromý klíč pokladny
   - Pokladní certifikát
   - Mezilehlý certifikát (SubCA)
   - Kořenový certifikát (Root CA)
5. Soubor `.p12` je chráněn heslem staženým z portálu a je k dispozici ke stažení **max. 30 dní**.

### **B. Automatizovaná Obnova Certifikátu (Z Pokladního Systému)**
- Pokladní certifikát má platnost **366 dnů**.
- Pokladní systém realizuje obnovu **2–3 týdny před vypršením platnosti**.
- Obnova probíhá přes API rozhraní `caeetapi` za použití **JWT tokenu** a digitálního podpisu stávajícím platným pokladním certifikátem.

---

## 3. Identifikátory a Datová Struktura (`<v4:Trzba>`)

Každá datová zpráva odesílaná na EET rozhraní obsahuje následující strukturu:

### **A. Hlavička (`<v4:Hlavicka>`)**
- `uuid_zpravy`: Unikátní identifikátor zprávy (UUID v4: `03965780-6457-4842-bd80-5f9195c0b8c8`)
- `dat_odesl`: Datum a čas odeslání zprávy v ISO 8601 UTC (`2026-07-01T09:02:18Z`)
- `prvni_zaslani`: `true` (první pokus), `false` (opakované odeslání z offline fronty)
- `overeni`: `false` (běžný prodej), `true` (ověřovací testovací zpráva bez zápisu)

### **B. Datová Část (`<v4:Data>`)**
- `eic_popl`: Evidenční Identifikační Číslo poplatníka (`CZ00000019` - PO, `CZ8551015704` - FO)
- `id_jednotky` / `id_provozovny`: Číslo provozovny (např. `303` nebo `11`)
- `id_pokl`: Označení pokladního zařízení (např. `Pokladna #01`)
- `porad_cis`: Pořadové číslo účtenky (např. `2026-0001`)
- `dat_trzby`: Datum a čas tržby (`2026-07-01T09:02:18Z`)
- `celk_trzba`: Celková částka v Kč (např. `188580.00`)
- `zakl_dan1`, `dan1` (21%), `zakl_dan2`, `dan2` (12%), `zakl_nepodl_dph` (0%)

---

## 4. Kódy Účtenky (BKP, PKP, FIK)

1. **BKP (Bezpečnostní Kód Poplatníka)**:
   - SHA-1 hash z údajů tržby v 5 blocích po 8 hexadecimálních znacích (`XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX`).
   - Tiskne se **vždy** na každou účtenku.

2. **PKP (Podpisový Kód Poplatníka)**:
   - Digitální RSA-SHA256 podpis řetězce tržby. Tiskne se na účtenku v **offline režimu**.

3. **FIK (Fiskální Identifikační Kód)**:
   - Generován serverem Finanční správy v SOAP odpovědi (`<v4:Odpoved fik="...">`). Tiskne se na účtenku v **online režimu**.

---

## 5. Přehled Zpracovaných Souborů Dokumentace

| Název Souboru | Popis |
| :--- | :--- |
| `EET_popis_rozhrani_v1.1.pdf` | XML SOAP v4.1 schémata, WSDL definice, datová pole tržby |
| `CAEET_postupy_zadost_certifikat_v2.pdf` | Postup generování `.p12` v DIS+ a JWT API pro automatickou obnovu |
| `CAEET_postupy_instalace_certifikatu_v1.pdf` | Návody na import `.p12` do Windows 11, macOS, Android, iOS |
| `CAEET_napoveda_webove_aplikace_v2.pdf` | Uživatelská příručka portálu Správy certifikátů EET |
| `EET_pristupove_provozni_informace_playground_1_1.pdf` | Testovací URL, certifikáty a EIČ na Playgroundu |
| `EET_pristupove_provozni_informace_produkce_v1.pdf` | Produkční URL, balancování DNS a certifikáty |
| `CAEET_certifikacni_politika_v1.pdf` | Bezpečnostní pravidla a certifikační autorita CA EET |
