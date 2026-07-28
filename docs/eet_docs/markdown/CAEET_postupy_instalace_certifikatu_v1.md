# Caeet Postupy Instalace Certifikatu V1

*Converted from `CAEET_postupy_instalace_certifikatu_v1.pdf` using pdftotext*

---

Certifikační autorita EET v 1.0
Modelové postupy instalace pokladního certifikátu

Obsah
Úvod......................................................................................................................................................... 3
Instalace certifikátu ve Windows 11 ......................................................................................................... 4
Instalace ze souboru .P12 (formát PKCS#12) ..................................................................................... 4
Obrazová příloha pro instalaci pokladního certifikátu do Windows 11 ................................................. 5
Instalace certifikátu v IOS ........................................................................................................................ 9
Instalace kořenového certifikátu CA .................................................................................................... 9
Instalace pokladního certifikátu a mezilehlého certifikátu .................................................................... 9
Obrazová příloha pro instalaci certifikátů do iOS ............................................................................... 10
Instalace certifikátu pro Android ............................................................................................................. 13
Instalace ze souboru .P12 (formát PKCS#12) ................................................................................... 13
Obrazová příloha pro instalaci certifikátu do Android ......................................................................... 13
Instalace certifikátů na MacOS .............................................................................................................. 16
Instalace ze souboru .P12 (formát PKCS#12) a úprava jeho důvěryhodnosti ................................... 16
Obrazová příloha instalace a úprava důvěryhodnosti certifikátu na MacOS ...................................... 17

2/18

Úvod
Uvedené postupy instalace pokladního certifikátu jsou označovány jako modelové, neboť konkrétní
postup závisí vždy na konkrétním typu pokladního systému/zařízení. Při práci s pokladními certifikáty pro
evidenci tržeb doporučujeme postupovat podle instrukcí dodavatele či výrobce Vašeho pokladního
systému/zařízení.
Uvedené postupy zahrnují práci se soukromým klíčem. Soukromý klíč musí být chráněn proti zcizení a
zneužití, neboť právě soukromý klíč slouží k vytváření elektronických podpisů. Ochrana certifikátu a
soukromého klíče pro evidenci tržeb před jeho zneužitím je zákonnou povinností poplatníka.
K instalaci pokladního certifikátu budete potřebovat soubor s pokladním certifikátem ve formátu PKCS#12
s příponou .p12 a heslo k souboru. Soubor .p12 i heslo k souboru získáte stažením z Obslužného portálu
EET po podání žádosti o pokladní certifikát.
Soubor .p12 obsahuje i soukromý klíč, proto jej vždy ukládejte do umístění, ke kterému máte přístup
pouze vy, popřípadě osoba oprávněná k manipulaci se soukromým klíčem.

V obrazové části jsou pro demonstraci použity neprodukční certifikáty.

3/18

Instalace certifikátu ve Windows 11
Níže je uveden obecný postup instalace pokladního certifikátu ve Windows 11 a kompatibilních OS.
Postupem se instalují najednou všechny certifikáty z certifikační cesty tj. kořenový certifikát, mezilehlý
certifikát i pokladní certifikát.

Instalace ze souboru .P12 (formát PKCS#12)
1. Z Obslužného portálu EET si stáhněte soubor s pokladním certifikátem a heslo k souboru.
2. Poklepáním na stažený soubor pokladního certifikátu (přípona .p12) se spustí Průvodce
importem certifikátu, kde v prvním kroku vyberte umístění podle toho, zda bude pokladní
certifikát využíván pouze aktuálně přihlášeným uživatelem, nebo všemi uživateli na tomto
počítači. Pokračujte stisknutím tlačítka Další.
3. Název importovaného souboru s pokladním certifikátem bude předvyplněn. Pokračujte
stisknutím tlačítka Další.
4. Vložte heslo pro soukromý klíč získané z Obslužného portálu EET.
5. Zvolte úložiště certifikátů, kam má být pokladní certifikát uložen. (Pokud chcete pokladní
certifikát používat pouze na tomto počítači, zvolte automatický výběr úložiště).
6. Dokončete průvodce importem.
7. V dalším kroku může aplikace vyžadovat instalaci kořenového certifikátu certifikační autority
(pokud již není nainstalován). Zvolte Ano pro instalaci kořenového certifikátu CA.
8. Po stisknutí tlačítka OK je certifikát nainstalován a je možné jej zkontrolovat ve zvoleném
úložišti pomocí aplikace Správce certifikátů uživatele.

4/18

Obrazová příloha pro instalaci pokladního certifikátu do Windows 11
Obrázek 1 – Spuštění průvodce importem certifikátu

Obrázek 2 – Import souboru .p12

5/18

Obrázek 3 – Vložení hesla k souboru .p12

Obrázek 4 - Výběr uložiště

6/18

Obrázek 5 – Dokončení průvodce importem certifikátu

Obrázek 6 – Instalace kořenového certifikátu CA

7/18

Obrázek 7 – Informace o ukončení importu

8/18

Instalace certifikátu v IOS
Níže je uveden obecný postup instalace pokladního certifikátu na zařízeních s operačním systémem
iOS. Postup instalace spočívá v krocích popsaných v kapitole 3.1 a 3.2.

Instalace kořenového certifikátu CA
1. Z Obslužného portálu EET si stáhněte soubor s kořenovým certifikátem. Odkaz na stažení
souboru s kořenovým certifikátem je umístěn v dolní části úvodní stránky Obslužného portálu
EET.
2. Poté otevřete v Nastavení -> Obecné -> VPN a správa zařízení, kde budete vidět stažený
profil. Po klepnutí na stažený profil se zobrazí informace o certifikátu.
3. Pro spuštění průvodce instalací profilu, klepněte na Instalovat.
4. Zadejte kód zařízení (PIN).
5. Zobrazí se informace, že bude instalován kořenový certifikát, klepněte na tlačítko Instalovat a
poté potvrďte.
6. Kořenový certifikát CA je nainstalován.
7. Otevřete Nastavení -> Obecné -> Informace, dole klepněte na Nastavení důvěry certifikátů.
Zvolte Kořenový certifikát a zapněte plnou důvěru.

Instalace pokladního certifikátu a mezilehlého certifikátu
Pokladní certifikát a mezilehlý certifikát se instalují najednou níže popsaným postupem.
1. Z Obslužného portálu EET si stáhněte soubor s pokladním certifikátem (přípona . p12) a heslo
k souboru.
2. Zobrazí se informace, že profil byl stažen a pro instalaci je potřebné ho zkontrolovat v
Nastavení.
3. Otevřete v Nastavení -> Obecné -> VPN a správa zařízení, kde budete vidět stažený profil. Po
klepnutí na stažený profil se zobrazí informace o certifikátu.
4. Pro spuštění průvodce instalací profilu, klepněte na Instalovat.
5. Zadejte kód zařízení (PIN).
6. V dalším kroku znovu potvrďte instalaci.
7. Zadejte heslo k souboru .p12.
8. Pokladní certifikát a mezilehlý certifikát je nainstalován.
9. Instalované certifikáty lze zkontrolovat v Nastavení > Obecné > VPN a správa zařízení
9/18

Obrazová příloha pro instalaci certifikátů do iOS
Obrázek 8 – Zahájení instalace kořenového certifikátu

Obrázek 9 – Potvrzení instalace kořenového certifikátu

10/18

Obrázek 10 – Nastavení důvěrohodnosti u kořenového certifikátu

Obrázek 11 – Zahájení instalace pokladního certifikátu

11/18

Obrázek 12 – Potvrzení instalace pokladního certifikátu a zadání hesla k zařízení

Obrázek 13 – Potvrzení instalace pokladního certifikátu a zadání hesla k souboru .p12

12/18

Instalace certifikátu pro Android
Níže je uveden obecný postup instalace pokladního certifikátu na zařízeních s operačním systémem
Android. Postupem se instalují všechny certifikáty z certifikační cesty najednou tj. kořenový certifikát,
mezilehlý certifikát i pokladní certifikát.

Instalace ze souboru .P12 (formát PKCS#12)
1. Z Obslužného portálu EET si stáhněte soubor s pokladním certifikátem (přípona . p12) a heslo
k souboru.
2. Pro spuštění importu poklepejte na stažený soubor.
3. Budete vyzváni k zadání hesla získaného z Obslužného portálu EET. Heslo vyplňte a
pokračujte tlačítkem OK.
4. Budete vyzváni k výběru typu certifikátu, kde zvolte Certifikát pro VPN a aplikaci a pokračujte
tlačítkem OK.
5. Nyní si můžete zvolit a vyplnit název certifikátu a jeho použití. Název můžete nechat
předdefinovaný a pokračujte tlačítkem OK.

Obrazová příloha pro instalaci certifikátu do Android
Obrázek 14 – Otevření souboru s pokladním certifikátem

13/18

Obrázek 15 – Zadání hesla k souboru p.12

Obrázek 16 – Výběr typu certifikátu

14/18

Obrázek 17 – Zadání názvu certifikátu

Obrázek 18 – Úspěšný import

15/18

Instalace certifikátů na MacOS
Níže je uveden obecný postup instalace pokladního certifikátu a úprava důvěryhodnosti na operačním
systému MacOS.

Instalace ze souboru .P12 (formát PKCS#12) a úprava jeho
důvěryhodnosti
1. Z Obslužného portálu EET si stáhněte soubor s pokladním certifikátem .p12 a heslo k tomuto
souboru.
2. Spusťte stažený soubor .p12. Následně budete vyzváni k zadání hesla k souboru.
3. Po zadání hesla se pokladní certifikát nainstaluje do Klíčenky, tedy do úložiště certifikátů.
4. Otevřete aplikaci Klíčenka. V případě potřeby budete vyzváni k zadání hesla nebo ověření
pomocí otisku prstu.
5. V levém menu vyberte záložku Přihlášení. Zobrazí se seznam aktuálně nainstalovaných
certifikátů.
6. V horní části okna zvolte kategorii Certifikáty a v seznamu vyhledejte položku „playground
EETv2 NCA RootCA RSA 05/2026“.
7. Na nalezený certifikát dvakrát poklepejte. Otevře se okno s detailními informacemi o certifikátu.
8. V otevřeném okně rozbalte sekci Důvěra.
9. V poli Při použití tohoto certifikátu vyberte možnost Vždy důvěřovat.
10. Po zvolení možnosti Vždy důvěřovat bude potřeba tuto změnu potvrdit zadáním hesla k
zařízení nebo ověřením pomocí otisku prstu.
11. Tím dojde k nastavení důvěryhodnosti kořenového certifikátu. Následně by měly být jako
důvěryhodné vyhodnoceny také navazující mezilehlý a pokladní certifikát.

16/18

Obrazová příloha instalace a úprava důvěryhodnosti certifikátu na
MacOS
Obrázek 19 - Otevření souboru s certifikátem

Obrázek 20 - Zadání hesla k instalaci pokladního certifikátu

Obrázek 21 - Spuštění aplikace klíčenka

Obrázek 22 – Nalezení kořenového certifikátu v klíčence

17/18

Obrázek 23 - Nastavení důvěryhodnosti po dvojkliku na kořenový certifikát

Obrázek 24 - Potvrzení o úpravě volby důvěryhodnosti

18/18

