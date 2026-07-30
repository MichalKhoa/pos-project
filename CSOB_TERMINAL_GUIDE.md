# Návod na Připojení a Konfiguraci Platebního Terminálu ČSOB (Ingenico Move 3500)

Tento dokument slouží jako kompletní návod k dokončení integrace a připojení akceptačního platebního terminálu **ČSOB Ingenico Move 3500** k pokladnímu systému **Himmel POS** jakmile od ČSOB nebo IT správce obdržíte pevnou IP adresu a číslo portu.

---

## 1. Souhrn Přípravy v Himmel POS

V systému Himmel POS je již kompletně připraveno rozhraní i backendové komunikátor pro ČSOB terminály.

### Připravené Komponenty:
- **Backendová služba**: `backend/services/csob_terminal_service.py`
  - Obsahuje protokolový komunikátor GPE / TCP Socket (STX/ETX + LRC kontrolní součet).
  - Podporuje síťový ping, odeslání prodejní transakce a spuštění denní uzávěrky (Reconciliation).
  - Při absenci IP adrese bezpečně vrací stav `NOT_CONFIGURED`, díky čemuž pokladna nikdy neselže ani neblokuje prodejce.
- **REST API Endpoints**: `backend/routers/payments.py`
  - `GET /api/v1/payments/terminal/config` – Načtení nastavení terminálu
  - `POST /api/v1/payments/terminal/config` – Uložení IP, Portu a TID
  - `POST /api/v1/payments/terminal/ping` – Test síťového spojení s terminálem
  - `POST /api/v1/payments/terminal/pay` – Zahájení platby na terminálu
  - `POST /api/v1/payments/terminal/reconcile` – Denní uzávěrka terminálu
- **Uživatelské rozhraní**:
  - **Nastavení pokladny**: Karta *Platební Terminál ČSOB (Ingenico Move 3500)* pro snadné zadání IP, portu a spuštění testu spojení.
  - **Platební okno (Karta)**: Zobrazuje stav připojení terminálu, možnost odeslat částku přímo na terminál nebo provést ruční schválení.

---

## 2. Postup pro Nastavení Statické IP na Terminálu Ingenico Move 3500

Pro spolehlivou komunikaci s pokladnou **musí mít terminál pevně nastavenou IP adresu** (nebo rezervaci DHCP na routeru podle MAC adresy).

### Krok za krokem na displeji terminálu:
1. Zapněte terminál **Ingenico Move 3500**.
2. Stiskněte tlačítko **Menu** (nebo klávesu `F` / ikonu ozubeného kola).
3. Přejděte do nabídky **0 - Telium Manager** (případně *Správa zařízení*).
4. Zadejte správcovské heslo (obvykle `3500` nebo `1234` podle nastavení od ČSOB / Sonet).
5. Zvolte **Initialization** -> **Parameters** -> **Communication**.
6. Vyberte typ připojení podle instalace:
   - **Ethernet** (připojení kabelem v základně/dokovací stanici)
   - **Wi-Fi** (bezdrátové připojení k vaší prodejní síti)
7. Zvolte **IP Configuration**:
   - Vypněte **DHCP** (zvolte *Static / Ručně*).
   - **IP Address**: Zadejte vyhrazenou statickou IP adresu (např. `192.168.1.150`).
   - **Subnet Mask**: Zadejte masku sítě (obvykle `255.255.255.0`).
   - **Gateway**: Zadejte IP adresu vašemu routeru (např. `192.168.1.1`).
   - **DNS 1**: Zadejte DNS (např. `8.8.8.8` nebo IP routeru).
8. Uložte nastavení a restartujte terminál.

---

## 3. Zjištění Čísla Portu a Protokolu ČSOB

ČSOB používá pro IP komunikaci s pokladními systémy standard **GPE (Global Payment Europe)** nebo **B-POST**.

- **Standardní port ČSOB / GPE**: `8888` (případně `2000`, `2222` nebo `2500`).
- **Protokol**: GPE TCP Socket framing (STX `0x02` + payload + ETX `0x03` + LRC byte).

> **Poznámka:** Přesné číslo portu si ověřte v předávacím protokolu od ČSOB / technika společnosti Sonet.

---

## 4. Postup Zprovoznění v Himmel POS (Po Získání IP a Portu)

Jakmile máte nastavenou IP adresu na terminálu:

1. Otevřete aplikaci **Himmel POS**.
2. V pravém horním rohu klikněte na **Nastavení** (ikona ozubeného kola).
3. Najděte sekci **Platební Terminál ČSOB (Ingenico Move 3500)**.
4. Zaškrtněte pole **Povolit integraci platebního terminálu ČSOB**.
5. Do pole **Cílová IP adresa terminálu** zadejte získanou IP adresu (např. `192.168.1.150`).
6. Do pole **Port (TCP Socket)** zadejte port (výchozí `8888`).
7. Do pole **ID Terminálu (TID)** zadejte vaše číslo smlouvy/terminálu od ČSOB (např. `12345678`).
8. Klikněte na **Uložit Nastavení Terminálu**.
9. Klikněte na tlačítko **Test Spojení (Ping)**.
   - Pokud se zobrazí zelený indikátor `✓ Terminál je na síti dostupný!`, spojení je 100% funkční!

---

## 5. Práce s Terminálem při Prodeji

### Bežný prodej kartou:
1. Na markovací obrazovce přidejte položky a klikněte na **Zaplatit**.
2. Zvolte způsob platby **Karta**.
3. Klikněte na tlačítko **Odeslat na Terminál ČSOB**.
4. Zákazník na terminálu přiloží nebo vloží kartu a zadá PIN.
5. Po schválení bankou pokladna automaticky dokončí prodej a vytiskne účtenku.

### Denní uzávěrka terminálu (Reconciliation):
Na konci směny přejděte do **Nastavení** -> **Platební Terminál ČSOB** a klikněte na **Spustit Uzávěrku**. Terminál provede vyúčtování transakcí s ČSOB bankou a vytiskne sumární lístek.

---

## 6. Řešení Problémů (Troubleshooting)

| Problém | Možná příčina | Řešení |
| :--- | :--- | :--- |
| **Test spojení hlásí TIMEOUT** | Terminál je vypnutý nebo na jiné Wi-Fi / síti | Ověřte, že je PC i terminál ve stejné lokální síti. Zkontrolujte IP v terminálu. |
| **Test spojení hlásí REFUSED** | Nesprávné číslo TCP portu | Ověřte u ČSOB / Sonet číslo komunikačního portu (vyzkoušejte `8888`, `2000`). |
| **Windows Firewall blokuje spojení** | Příchozí/odchozí port je blokován ve Windows | Povolte příchozí/odchozí TCP port `8888` ve Windows Defender Firewall. |
| **Transakce zamítnuta (Code 51 / 05)** | Nedostatek prostředků / chyba karty | Požádejte zákazníka o jinou kartu nebo zvolte **Ruční Schválení Karty**. |

---
*Vytvořeno automaticky pro Himmel POS — ČSOB Ingenico Move 3500 Integration Guide*
