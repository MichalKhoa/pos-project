# Návod: Propojení e-mailu Seznam.cz s Himmel POS pro automatické ověřování QR plateb

Tento návod vás krok za krokem provede nastavením automatického schvalování **QR plateb v reálném čase (během 2–4 sekund)** pomocí e-mailových oznámení od banky.

---

## Jak to funguje?

1. Zákazník naskenuje QR kód na pokladně a odešle platbu (**Okamžitá platba**).
2. Banka (ČSOB, Air Bank, Fio, KB apod.) odešle do 1–2 sekund e-mailové oznámení na váš e-mail na Seznam.cz.
3. Pokladna Himmel POS v pozadí přečte e-mail, porovná **Variabilní symbol** a **Částku**.
4. Displej pokladny se automaticky rozsvítí zeleně **"PLATBA PŘIJATA!"** a vytiskne účtenku.

---

## Krok 1: Vygenerování hesla pro aplikaci na Seznam.cz

Pro bezpečnost **nepoužíváte hlavní heslo** k e-mailu, ale vygenerujete speciální heslo pro pokladnu:

1. Přihlaste se do e-mailu na **[Seznam.cz](https://email.seznam.cz)**.
2. Vpravo nahoře klikněte na **Nastavení** (ikona ozubeného kola) → **Všechna nastavení**.
3. V levém menu vyberte **Heslo a zabezpečení**.
4. Ujistěte se, že je zapnutá volba **Povolit přístup přes POP3/IMAP**.
5. V sekci **Poštovní hesla pro aplikace** klikněte na **Vytvořit nové heslo**.
6. Do název zadejte např. `Himmel POS` a potvrďte.
7. Zobrazí se vygenerovaný klíč (např. `a1b2c3d4e5f6g7h8`). **Tento kód si zkopírujte**.

---

## Krok 2: Zadání údajů do pokladny (soubor `.env`)

V adresáři backendu pokladny (ve složce `backend/`) vytvořte nebo upravte soubor `.env` a přidejte do něj tyto řádky:

```env
# Nastavení e-mailového listeneru pro QR platby
BANK_EMAIL_USER="vas_email@seznam.cz"
BANK_EMAIL_PASS="vygenerovane_heslo_pro_aplikaci"
BANK_EMAIL_SERVER="imap.seznam.cz"
```

*(Nahraďte `vas_email@seznam.cz` vaším e-mailem a `vygenerovane_heslo_pro_aplikaci` kód z Kroku 1).*

---

## Krok 3: Nastavení zasílání e-mailů v bance (ČSOB / Internetové bankovnictví)

Aby banka posílala e-maily při každé příchozí platbě:

### Pro ČSOB (CEB / Elektronické bankovnictví):
1. Přihlaste se do bankovnictví ČSOB / CEB.
2. Jděte do **Nastavení** → **Hlášení o pohybech / Notifikace**.
3. Přidejte nebo aktivujte **E-mailové notifikace pro příchozí platby** na váš e-mail `vas_email@seznam.cz`.
4. Ujistěte se, že e-mail obsahuje **Variabilní symbol** a **Částku**.

---

## Krok 4: Testování u pokladny

1. Spusťte pokladnu Himmel POS.
2. Na klávesnici zadejte částku (např. 10 Kč) a vyberte **QR Platba**.
3. Naskenujte QR kód vaším mobilním bankovnictvím a pošlete **Okamžitou platbu**.
4. Do **2 až 4 sekund** po odeslání platby z mobilu se obrazovka pokladny automaticky změní na schváleno!

---

## Řešení problémů (Troubleshooting)

- **Pokladna nereaguje na platbu?**
  - Zkontrolujte, zda zákazník odeslal platbu jako **Okamžitou platbu** (Instant Payment). Běžná převodní platba trvá hodiny.
  - Ověřte, že v souboru `.env` je heslo pro aplikaci bez mezer.
- **Příchozí e-mail skončil ve spamu?**
  - Na Seznam.cz zkontrolujte složku *Spam*. Pokud tam e-mail od ČSOB přistál, označte jej jako **Není spam**.
