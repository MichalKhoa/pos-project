--- PAGE 1 ---
 
 
 
 
Elektronická evidence tržeb 2.0 
 
Formát a struktura údajů o evidované tržbě a 
popis datového rozhraní pro příjem datových 
zpráv evidovaných tržeb 
 
 
 
Verze 1.2 
 
 
 
 
 
 
Datum poslední verze dokumentu: 25.08.2026 
 
 
Změny vůči publikované verzi 1.0)* 
Změna číslo 
Popis 
1 
02.06.2026 Uvolnění verze 1.0 
2 
07.07.2026 Verze 1.1: upřesnění pravidel pro deklaraci UTF-8 kódování zpráv 
(použití hlavičky Content-Type) – kapitola 3.1 Kódování datových položek 
3 
25.08.2026 Verze 1.2: doplnění informací o podpoře CORS HTTP hlaviček ze 
strany společného technického zařízení – kapitola 2.3.3 Podpora CORS 
ochrany; formální textové opravy 
 
)* Tabulka změn nepopisuje drobné formální úpravy textu. 
 

--- PAGE 2 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
2//37 
Vymezení obsahu dokumentu 
Dokument popisuje datové rozhraní pro příjem a potvrzování datových zpráv obsahujících údaje 
o tržbě, které jsou poplatníci EET povinni zasílat pro každou uskutečněnou tržbu, která je 
předmětem evidence dle zákona o evidenci tržeb a o změně některých dalších zákonů (verze 1.0  
tohoto dokumentu vychází ze znění vládního návrhu zákona rozeslaného poslancům dne 11. 
5. 2026 jako  sněmovní tisk č. 189/0). 
Soubory obsahující definici XML schématu a webové služby (WSDL), které formálně popisují 
strukturu datových zpráv evidovaných tržeb a webovou službu pro jejich příjem, jsou přílohou 
tohoto dokumentu. 
 
 

--- PAGE 3 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
3//37 
 
Obsah 
1 
ÚVODNÍ INFORMACE .............................................................................................. 4 
1.1 
ČÍSLOVÁNÍ VERZÍ ROZHRANÍ ............................................................................................4 
1.2 
PŘEHLED ZKRATEK ........................................................................................................4 
1.3 
PŘEHLED ZÁKLADNÍCH POJMŮ .........................................................................................5 
2 
KOMUNIKAČNÍ SCÉNÁŘ ZASÍLÁNÍ DATOVÝCH ZPRÁV ............................................... 8 
2.1 
ZÁKLADNÍ SCHÉMA KOMUNIKACE .....................................................................................8 
2.2 
MÓDY ODESÍLÁNÍ DATOVÝCH ZPRÁV, PRODUKČNÍ A NEPRODUKČNÍ PROSTŘEDÍ ...........................9 
2.2.1 
Mód odeslání datové zprávy ........................................................................................... 9 
2.2.2 
Produkční a neprodukční prostředí .............................................................................. 10 
2.2.3 
Kritické kontroly (kritické chyby) ................................................................................... 12 
2.2.4 
Propustné kontroly (propustné chyby) .......................................................................... 12 
2.3 
STANDARDY SÍŤOVÉ KOMUNIKACE ................................................................................... 13 
2.3.1 
HTTPS/TLS .................................................................................................................. 13 
2.3.2 
HTTP .......................................................................................................................... 13 
2.3.3 
Podpora CORS ochrany ............................................................................................... 13 
2.4 
CERTIFIKÁTY .............................................................................................................. 16 
3 
STRUKTURA DATOVÝCH ZPRÁV .............................................................................. 17 
3.1 
KÓDOVÁNÍ DATOVÝCH POLOŽEK ..................................................................................... 17 
3.2 
PŘEHLED STRUKTURY DATOVÝCH ZPRÁV ........................................................................... 17 
3.3 
DATOVÁ ZPRÁVA EVIDOVANÉ TRŽBY ................................................................................. 20 
3.3.1 
XML formát e-tržby ...................................................................................................... 21 
3.3.2 
Přehled položek datové zprávy o evidované tržbě .......................................................... 21 
3.3.3 
Podrobný popis položek e-tržby ................................................................................... 21 
3.3.4 
Příklad e-tržby ............................................................................................................. 26 
3.4 
POTVRZOVACÍ DATOVÁ ZPRÁVA ...................................................................................... 27 
3.4.1 
XML formát potvrzení .................................................................................................. 27 
3.4.2 
Přehled datových položek potvrzení ............................................................................. 28 
3.4.3 
Příklad potvrzení ......................................................................................................... 30 
3.4.4 
Seznam kódů a textů varování ...................................................................................... 30 
3.5 
CHYBOVÁ DATOVÁ ZPRÁVA ............................................................................................ 31 
3.5.1 
XML formát chyby ....................................................................................................... 31 
3.5.2 
Přehled datových položek chyby .................................................................................. 31 
3.5.3 
Příklad chyby .............................................................................................................. 33 
3.5.4 
Seznam chybových kódů a chybových zpráv ................................................................. 34 
4 
JEDNOZNAČNÝ KÓD TRŽBY – URČENÍ UNIKÁTNOSTI DANÉ TRŽBY ............................ 35 
5 
UPŘESNĚNÍ XML ZPRÁVY VE TVARU SOAP A JEJÍ ZABEZPEČENÍ ................................ 36 
5.1 
ŠIFROVÁNÍ KOMUNIKACE PROTOKOLEM HTTPS ................................................................. 36 
5.2 
PODPIS DATOVÝCH ZPRÁV EVIDOVANÝCH TRŽEB ................................................................ 36 
5.3 
ELEKTRONICKÝ PODPIS POTVRZOVACÍCH DATOVÝCH ZPRÁV .................................................. 37 
5.4 
POMOCNÉ TECHNICKÉ INFORMACE PRO TRASOVÁNÍ ........................................................... 37 
 
 

--- PAGE 4 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
4//37 
1 ÚVODNÍ INFORMACE 
Datové zprávy evidované tržby jsou zasílány jako SOAP zprávy prostřednictvím protokolu HTTPS. 
Zprávy jsou zabezpečené elektronickým podpisem dle standardu WS-Security. Kvůli 
jednoduchosti a interoperabilitě, a také pro zajištění kompatibility s předchozím řešením, jsou 
použity tyto standardy: 
• 
SOAP 1.1 
• 
WS-Security 1.1 
1.1 ČÍSLOVÁNÍ VERZÍ ROZHRANÍ 
Rozhraní pro příjem datových zpráv evidovaných tržeb je po technické stránce předepsáno 
soubory WSDL a XSD.  Verze rozhraní je číslována dvojicí čísel: hlavní (první) a vedlejší (druhé), 
např. 1.0, 1.1, 1.2 atd. Hlavní číslo verze rozhraní je součástí URL adresy ve všech cílových 
prostředích (např. v4 pro verzi 4.x). Změny v rozhraní jsou zveřejňovány následujícím způsobem: 
 
1. 
V případě drobných změn, které nemají mít vliv na implementaci v pokladních 
zařízeních poplatníků (tzv. kompatibilní změny), dojde ke změně pouze vedlejšího 
čísla verze: 4.1 -> 4.2 -> 4.3 -> ... atd. Verze XML schématu a WSDL dokumentu v jejich 
hlavičce se analogicky změní z 4.1 na 4.2, 4.3, atd. Naproti tomu uvnitř XML schématu 
a WSDL dokumentu se URL jmenných prostorů, cílová URL adresa služby apod. 
nezmění - na konci zůstane /v4. 
2. 
Pokud dojde ke změnám struktury datových zpráv, které vyžadují změnu 
implementace v pokladních zařízeních poplatníků (tzv. nekompatibilní změny – 
změny formátu datových položek apod.), dojde ke změně čísla hlavní verze: např. 4.2 
-> 5.1. Následné drobné změny (viz bod 1.) budou opět číslovány: 5.2, 5.3, atd. Uvnitř 
XML schématu a WSDL dokumentu se URL adresa jmenných prostorů, cílová URL 
služby apod. změní na /v5. 
Ke dni vydání první verze tohoto dokumentu je verze rozhraní EET 4.1 (předchozí systém EET měl 
poslední verzi rozhraní 3.1 a změny, které přineslo EET v roce 2026, jsou nekompatibilní). 
1.2 
PŘEHLED ZKRATEK 
Zkratka 
Definice 
CA 
Certifikační autorita 
CRL 
Certificate Revocation List 
EIČ 
Evidenční identifikační číslo 
DŘ 
Daňový řád 
EET 
Elektronická evidence tržeb 
FS, FSČR 
Finanční správa České republiky 
GFŘ 
Generální finanční ředitelství 

--- PAGE 5 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
5//37 
Zkratka 
Definice 
POK 
Potvrzovací kód vracený společným technickým zařízením správce 
daně v případě úspěšného přijetí datové zprávy evidované tržby 
SEČ 
Středoevropský čas (CET) 
SELČ 
Středoevropský letní čas (CEST) 
SOAP 
Protokol pro výměnu zpráv založených na XML dle specifikace 
https://www.w3.org/TR/soap/ 
UUID 
Unikátní identifikátor dle standardu RFC 9562 Universally Unique 
IDentifiers (UUIDs) 
WS-Security 
Web Services Security – rozšíření SOAP standardu o zabezpečení 
WWW služeb dle specifikace publikované http://www.oasis-
open.org/committees/wss/ 
WSDL 
Web Services Description Language – jazyk založený na XML určený 
pro popis funkcí, jež nabízí WWW služba, dle specifikace 
https://www.w3.org/TR/wsdl 
XML schéma 
Jazyk založený na XML, určený pro definici struktury XML dokumentů, 
dle specifikace https://www.w3.org/TR/xmlschema11-1/ a 
https://www.w3.org/TR/xmlschema11-2/ 
XSD 
Popis struktury XML dokumentu pomocí XML schéma (XML Schema 
Definition) 
ZoET 
Zákon o evidenci tržeb a o změně některých dalších zákonů 
1.3 
PŘEHLED ZÁKLADNÍCH POJMŮ 
V tomto odstavci uvádíme definice základních pojmů, které jsou používány v textu tohoto 
dokumentu. 
 
Pojem 
Definice 
e-tržba 
Datová struktura v zákonem definovaném 
formátu, která obsahuje všechny datové 
údaje evidované tržby tak, jak je stanoví ZoET. 

--- PAGE 6 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
6//37 
Pojem 
Definice 
Datová zpráva evidované tržby 
 
Datová struktura v zákonem požadovaném 
XML formátu, která obsahuje e-tržbu a další 
potřebné údaje technického charakteru. 
Jedná se o kompletní XML zprávu, obsahující 
údaje popsané příslušnými standardy pro 
webové služby: SOAP/WSDL/WS-Security 
atd. 
Datová zpráva evidované tržby je pokladním 
zařízením zasílána na společné technické 
zařízení správce daně. 
Každé evidované tržbě odpovídá právě jedna 
datová zpráva evidované tržby, pokud se 
nejedná o opakované zaslání téže evidované 
tržby. 
Potvrzovací datová zpráva  
Datová struktura v zákonem definovaném 
tvaru dle tohoto dokumentu, která obsahuje 
potvrzovací kód (POK) a současně slouží jako 
potvrzení přijetí a formální správnosti )* 
zaslané datové zprávy evidované tržby. 
Chybová datová zpráva 
Datová struktura v zákonem definovaném 
tvaru dle tohoto dokumentu, která obsahuje 
chybový kód a jeho případný slovní popis pro 
případ, že  
− 
přijatá datová zpráva obsahující údaje 
o evidované tržbě obsahuje kritické 
chyby, které neumožňují její 
zpracování 
− 
nebo došlo k jiné chybě, znemožňující 
další zpracování na straně správce 
daně 
− 
nebo byla datová zpráva obsahující 
údaje o evidované tržbě bez kritických 
chyb zaslána v tzv. ověřovacím módu. 
Pokladní zařízení poplatníka   
Zařízení na straně poplatníka, které zasílá 
údaje o evidované tržbě. Může tím být dle 
kontextu myšleno samotné koncové zařízení, 
například pokladna, ale i následný SW a HW, 
který datové zprávy o tržbě skutečně zasílá.  
V datové zprávě je položka „Označení 
pokladního zařízení“, která identifikuje 
koncové zařízení (pokladnu). Jinde v textu je 
většinou myšleno koncové zařízení i následný 
SW a HW zasílající datovou zprávu. 

--- PAGE 7 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
7//37 
Pojem 
Definice 
Evidovaná tržba 
Evidovanou tržbou je platba, která splňuje 
formální náležitosti evidované tržby a která 
zakládá rozhodný příjem.  
Evidovanou tržbou je také platba, která 
splňuje formální náležitosti evidované tržby a 
je určena k následnému čerpání nebo 
zúčtování, které zakládají rozhodný příjem, 
nebo následným čerpáním nebo zúčtováním 
té platby, která zakládá rozhodný příjem.  
Systém EET 
Informační systém, který sestává ze 
společného technického zařízení správce 
daně pro přijímání datových zpráv 
obsahujících údaje o evidované tržbě a dále 
z částí zajišťujících návazné zpracování dat 
EET 
)* Formální správností datové zprávy se rozumí její shoda s předepsanou datovou strukturou a 
splnění veřejně dokumentovaných kritických kontrol, které jsou podmínkou přijetí datové zprávy 
evidované tržby, nikoliv věcná správnost údajů o příslušné evidované tržbě. 
 

--- PAGE 8 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
8//37 
2 KOMUNIKAČNÍ SCÉNÁŘ ZASÍLÁNÍ DATOVÝCH ZPRÁV 
2.1 ZÁKLADNÍ SCHÉMA KOMUNIKACE 
Pokladní zařízení zasílá jednotlivé datové zprávy evidovaných tržeb na společné technické 
zařízení správce daně určené správcem daně. V případě, že datová zpráva evidované tržby 
odeslaná pokladním zařízením poplatníka vyhovuje kritickým kontrolám – viz kapitola 2.2.3 
Kritické kontroly – a je možno na straně finanční správy datovou zprávu uložit, je na straně 
společného technického zařízení správce daně bezprostředně vytvořena potvrzovací datová 
zpráva, kterou toto zařízení odešle zpět na pokladní zařízení poplatníka, jež datovou zprávu 
evidované tržby předtím odeslalo. 
Komunikace tedy probíhá v režimu: požadavek/odpověď (request/response). Účelem potvrzovací 
datové zprávy je potvrdit přijetí a formální správnost přijaté datové zprávy pokladnímu zařízení 
poplatníka. Potvrzovací datová zpráva je vracena jako synchronní odpověď, a kromě toho je 
s původní datovou zprávou svázána číslem datové zprávy přiděleným poplatníkem (pomocí tzv. 
UUID) – viz 3 Struktura datových zpráv – a obsahuje potvrzovací kód (POK) generovaný společným 
technickým zařízením správce daně. POK je pro každou správně přijatou datovou zprávu 
evidované tržby unikátní. 
V případě, že datová zpráva evidované tržby nevyhoví kritickým kontrolám nebo nastane 
technická chyba na straně společného technického zařízení správce daně, která znemožní další 
zpracování datové zprávy, bude pokladní zařízení poplatníka, jež datovou zprávu evidované tržby 
předtím odeslalo, informováno chybovou datovou zprávou, pokud to povaha chyby umožní. 
Kromě výše popsaného ostrého módu existuje možnost odeslat datovou zprávu v ověřovacím 
módu, kdy se pouze ověřuje její zpracovatelnost, ale není přijata jako datová zpráva evidované 
tržby – viz dále v kapitole 2.2 Módy odesílání datových zpráv, produkční a neprodukční prostředí. 
Komunikační scénář pro ostrý mód je znázorněn na Obr. 1. 

--- PAGE 9 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
9//37 
 
 
Obr. 1 Komunikační scénář 
2.2 MÓDY ODESÍLÁNÍ DATOVÝCH ZPRÁV, PRODUKČNÍ A NEPRODUKČNÍ PROSTŘEDÍ 
2.2.1 Mód odeslání datové zprávy 
Poplatník EET má mít možnost odeslat datovou zprávu s údaji o evidované tržbě v jednom ze dvou 
módů. Požadovaný mód lze zvolit nastavením příznaku ověřovacího módu odesílání (atribut 
overeni) v hlavičce datové zprávy: 
• 
Ostrý mód slouží pro běžné odesílání datových zpráv s údaji o evidované tržbě (tj. pro 
standardní plnění evidenční povinnosti podle ZoET) a získání potvrzovacího kódu. 
V ostrém módu hlavička datové zprávy buď neobsahuje příznak ověřovacího módu 
odesílání, nebo je atribut nastaven na hodnotu false. 
• 
Ověřovací mód slouží poplatníkům EET k ověření správného nastavení a funkčnosti 
spojení pokladního zařízení se systémem EET. Datová zpráva v takovém případě musí 
obsahovat příznak ověřovacího módu odesílání s hodnotou true. Zasláním datové zprávy 
v ověřovacím módu není splněna povinnost zaslat údaje o evidované tržbě ve smyslu 
ZoET. 

--- PAGE 10 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
10//37 
2.2.2 Produkční a neprodukční prostředí 
GFŘ zveřejní adresy webové služby v produkčním prostředí a v jednom nebo více neprodukčních 
prostředích systému EET: 
• 
Produkční prostředí je určeno pro poplatníky EET a slouží pro rutinní provoz, tj. 
především příjem a potvrzování datových zpráv s údaji o evidovaných tržbách. Certifikáty 
pro evidenci tržeb (pokladní certifikáty a certifikáty společného technického zařízení 
správce daně) použité v produkčním prostředí se dále také nazývají „produkční 
certifikáty.“ 
• 
Neprodukční prostředí (playground) slouží výhradně vývojářům softwaru pro pokladní 
zařízení, tedy nikoli koncovým uživatelům pokladních zařízení. Zasláním datové zprávy 
do neprodukčního prostředí není splněna povinnost zaslat údaje o evidované tržbě ve 
smyslu ZoET, tj. POK vrácený neprodukčním prostředím není platným potvrzovacím 
kódem. 
V neprodukčním prostředí mohou být certifikáty pro evidenci tržeb (pokladní certifikáty a 
certifikáty společného technického zařízení správce daně) vydávány zjednodušeným 
způsobem. Tyto certifikáty neprodukčních prostředí se dále též nazývají „testovací 
certifikáty.“ 
S oběma prostředími je možné komunikovat jak v ostrém, tak v ověřovacím módu. Následující 
tabulka popisuje, jaká odpověď bude společným technickým zařízením správce daně odeslána 
v závislosti na: 
1. Módu, ve kterém byla datová zpráva odeslána. Mód je určen hodnotou atributu overeni 
v elementu Hlavicka datové zprávy s údaji o evidované tržbě.  
2. Cílovém prostředí. Prostředí je určeno adresou webové služby, na kterou byla datová 
zpráva odeslána. Adresy jednotlivých prostředí budou zveřejněny správcem daně. 
3. Validitě datové zprávy, tj. zda datová zpráva obsahuje kritické chyby. 

--- PAGE 11 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
11//37 
Mód datové zprávy 
evidované tržby 
Cílové 
prostředí 
Scénář použití 
Validita datové 
zprávy evidované 
tržby 
Odpověď systému EET 
Ostrý 
Datová zpráva 
v elementu 
Hlavicka 
neobsahuje atribut 
overeni, nebo 
obsahuje atribut 
overeni="false" 
Produkční 
Poplatník EET zasílá 
datovou zprávou 
údaje o evidované 
tržbě 
Validní 
- 
potvrzovací datová zpráva, obsahuje POK a ev. i varování o propustných chybách 
- 
přidělený POK je unikátní a je platným potvrzovacím kódem 
- 
odpověď obsahuje el. podpis (podepsáno produkčním certifikátem) 
- 
evidovaná tržba byla přijata, zaevidována a bude dále uchovávána systémem EET 
)* 
Nevalidní 
- 
chybová datová zpráva 
- 
nenulový kód chyby, textový popis chyby 
- 
odpověď neobsahuje el. podpis 
Neprodukční 
(playground) 
Vývojář SW testuje 
svou aplikaci 
v ostrém módu 
Validní 
- 
potvrzovací datová zpráva, obsahuje POK a ev. i varování o propustných chybách 
- 
přidělený POK bude mít specifickou hodnotu („-ff“, na konci), ale není platný 
- 
odpověď obsahuje příznak neprodukčního prostředí (test="true") 
- 
odpověď obsahuje el. podpis (podepsáno testovacím certifikátem) 
Nevalidní 
- 
chybová datová zpráva 
- 
nenulový kód chyby, textový popis chyby  
- 
odpověď obsahuje příznak neprodukčního prostředí (test="true") 
- 
odpověď neobsahuje el. podpis 
Ověřovací 
Datová zpráva 
v elementu 
Hlavicka obsahuje 
atribut  
overeni="true" 
Produkční 
Poplatník EET ověřuje 
funkčnost spojení 
mezi svým pokladním 
zařízením a 
systémem EET 
Validní 
- 
chybová datová zpráva, obsahuje kód chyby 0, a ev. i varování o propustných chybách 
- 
kód chyby 0 – tj. žádné formální chyby nebyly nalezeny 
- 
popis chyby „Datovou zpravu evidovane trzby v overovacim modu se podarilo 
zpracovat“ 
- 
odpověď neobsahuje el. podpis 
Nevalidní 
- 
chybová datová zpráva 
- 
nenulový kód chyby, textový popis chyby 
- 
odpověď neobsahuje el. podpis 
Neprodukční 
(playground) 
Vývojář SW testuje 
svou aplikaci v módu 
ověření funkčnosti 
spojení mezi 
pokladním zařízením 
a systémem EET 
Validní 
- 
chybová datová zpráva, obsahuje kód chyby 0, a ev. i varování o propustných chybách 
- 
kód chyby 0 – tj. žádné formální chyby nebyly nalezeny 
- 
popis chyby „Datovou zpravu evidovane trzby v overovacim modu se podarilo 
zpracovat“ 
- 
odpověď obsahuje příznak neprodukčního prostředí (test="true") 
- 
odpověď neobsahuje el. podpis 
Nevalidní 
- 
chybová datová zpráva 
- 
nenulový kód chyby, textový popis chyby  
- 
odpověď obsahuje příznak neprodukčního prostředí (test="true") 
- 
odpověď neobsahuje el. podpis 
)* ve všech ostatních případech v této tabulce evidovaná tržba byla přijata systémem EET, ale nebude zaevidována ani dále uchovávána systémem EET 
Tabulka 1: Varianty odpovědi systému EET

--- PAGE 12 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
12//37 
2.2.3 Kritické kontroly (kritické chyby) 
V systému EET jsou na přijatých datových zprávách evidovaných tržeb prováděny tzv. kritické 
kontroly. 
Pokud jakákoliv z kritických kontrol neprojde, datová zpráva o evidované tržbě nebude přijata a 
POK nebude vydán. 
Systém EET vrací při nalezení kritické chyby chybovou datovou zprávu obsahující číselný kód 
chyby a textový popis chyby – viz odst. 3.5.4 Seznam chybových kódů a chybových zpráv. Podle 
povahy chyby se může zpracování dané datové zprávy na straně systému EET zastavit již při 
výskytu první kritické chyby. Mezi chybové stavy patří i možné technické poruchy zpracování – 
jejich výskyt je diagnostikován příslušným chybovým kódem popsaným v kapitole 3.5.4 níže. 
Při nalezení chyb, které by systém EET mohl vyhodnotit jako kybernetický útok, systém EET 
žádnou odpověď klientovi (tedy pokladnímu zařízení) nedává. 
Kritické kontroly jsou následující: 
 
1. kontrola kódování XML dokumentu – předepsáno je kódování UTF-8 
2. kontrola na konkrétní XML schéma (*.xsd) datové zprávy evidované tržby, které obsahuje 
přesnou definici struktury dat a formátů jednotlivých datových položek a kontrola 
přítomnosti povinných položek 
3. kontrola elektronického podpisu datové zprávy (certifikát poplatníka je součástí SOAP 
obálky datové zprávy dle standardu WS-Security): 
a. kontrola vydavatele pokladního certifikátu 
b. kontrola platnosti pokladního certifikátu včetně kontroly CRL, které jsou 
aktuálně technickému zařízení dostupné 
c. kryptografická kontrola vlastního elektronického podpisu vůči pokladnímu 
certifikátu 
4. kontrola integrity EIČ poplatníka 
5. kontrola na celkovou délku datové zprávy evidované tržby (tj. zpráva včetně SOAP 
obálky), která nesmí přesáhnout 12 kB 
2.2.4 Propustné kontroly (propustné chyby) 
Propustné kontroly prováděné transakčním systémem EET nejsou důvodem k odmítnutí vydání 
POK. Jedná se tedy o kontroly, jejichž výsledek bude pouze uložen do úložiště datových zpráv pro 
další případné zpracování. 
Propustné kontroly jsou následující: 
1. kontrola shodnosti EIČ poplatníka uvedeného v datové struktuře e-tržba (XML element 
<Trzba>) s EIČ uvedeným v certifikátu, pomocí kterého byla podepsána datová zpráva 
evidované tržby 
2. kontrola integrity EIČ pověřujícího poplatníka (pokud je uvedeno) 
3. kontrola, že EIČ poplatníka je různé od EIČ pověřujícího poplatníka (pokud je uvedeno) 
4. kontrola data a času uskutečnění tržby (uvedené v datové zprávě) vůči datu a času přijetí 
zprávy na společné technické zařízení správce daně. Pokud bude datum a čas 
uskutečnění tržby o více než 2 hodiny novější, nebo naopak bude o více než 2 roky starší 
než datum a čas přijetí zprávy, bude označeno kontrolou jako chybné. Jako chybné bude 
označeno i datum a čas uskutečnění tržby starší než minimální datum a čas uskutečnění 
tržby vztahující se k příslušnému cílovému prostředí ve smyslu odst. 2.2.2 Produkční a 
neprodukční prostředí. 

--- PAGE 13 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
13//37 
 
Předpokládané minimální datumy a časy uskutečnění tržby dle cílových prostředí: 
a. neprodukční prostředí (playground) verze 4:  
01.07.2026 
b. produkční prostředí před 01.01.2027: 
 
01.11.2026 
c. produkční prostředí:  
 
 
 
01.01.2027 
5. Kontrola čísla evidenční jednotky, zda její tvar odpovídá tvaru přidělovanému 
evidenčním jednotkám na portálu MOJE Daně v DIS+ (musí mít alespoň dvě dekadické 
cifry a poslední pozice musí být jedna z hodnot 1, 2, 3 nebo 4) 
Pokud jakákoliv z propustných kontrol neprojde (a současně nenastane žádná kritická chyba), 
datová zpráva o evidované tržbě bude přijata a POK bude vydán, jako kdyby všechny kontroly 
prošly. 
Chyby spočívající v nesplnění propustných kontrol se nazývají propustné. Potvrzovací datová 
zpráva je v případě, že nastane jedna nebo více propustných chyb, doplněna o příslušná textová 
varování a jim odpovídající číselné kódy. Stejným způsobem jsou příslušná varování zařazena i do 
chybové odpovědi s kódem 0 v ověřovacím módu. 
2.3 STANDARDY SÍŤOVÉ KOMUNIKACE 
2.3.1 HTTPS/TLS 
Použití protokolu HTTPS je povinné, bez autentizace klientskými certifikáty. Podporované verze 
TLS jsou TLS 1.2 a vyšší.  
2.3.2 HTTP 
Použití protokolu HTTP/1.1 je povinné. 
2.3.3 Podpora CORS ochrany 
Společné technické zařízení správce daně umožňuje přímé volání služby odeslání datové zprávy 
evidované tržby prostřednictvím JavaScript kódu z WWW prohlížeče, tedy z domény WWW 
aplikace pokladního systému poplatníka. Společné technické zařízení správce daně za tímto 
účelem poskytuje Cross Origin Resource Sharing (CORS) informace, aby WWW prohlížeče mohly 
provést potřebné CORS kontroly. Vzhledem k tomu, že je potřeba při volání webové služby zasílat 
hlavičky HTTP protokolu Content-Type a SOAPAction a nejedná se o tzv. jednoduchý 
požadavek, posílá www prohlížeč předem ověřovací požadavek, tzv. preflight požadavek. Tento 
ověřovací požadavek odesílá www prohlížeč automaticky, podle nastavení způsobu volání 
koncového bodu služby. Pro odeslání tržby je třeba požadovat následující vlastnosti komunikace: 
• 
Využití HTTP metody POST 
• 
Odeslání HTTP hlaviček: 
o Content-Type s hodnotou "text/xml; charset=utf-8" 
o SOAPAction dle WSDL služby 
WWW prohlížeč automaticky (dle nastavení HTTP volání v JavaScriptu WWW prohlížeče) 
vygeneruje volání preflight požadavku v následujícím tvaru: 

--- PAGE 14 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
14//37 
OPTIONS https://...1/eet/services/EETServiceSOAP/v4 HTTP/1.1 
Access-Control-Request-Method: POST 
Access-Control-Request-Headers: Content-Type, SOAPAction  
Origin: https://...2 
 
Pokud jsou podmínky pro přímé volání služby splněny (tak, jak je specifikováno v požadavku 
výše), vrací koncový bod povolovací zprávu uvozenou HTTP status kódem 204 No Content: 
 
HTTP/1.1 204 No Content 
... 
X-Global-Transaction-ID: ... 
Access-Control-Allow-Origin: * 
Access-Control-Allow-Methods: POST, OPTIONS 
Access-Control-Allow-Headers: Content-Type, SOAPAction 
Access-Control-Expose-Headers: X-Global-Transaction-Id 
Access-Control-Max-Age: 3600 
 
Pokud www prohlížeč dostane výše zmíněnou povolovací zprávu, může na koncový bod 
společného technického zařízení správce daně metodou POST odeslat vlastní SOAP zprávu 
evidované tržby. Podpora CORS nic nemění na využití protokolu SOAP a WS-Security pro vlastní 
výměnu zpráv při elektronické evidenci tržeb dle popisu v ostatních částech tohoto dokumentu. 
V odpovědi webové služby pro příjem datové zprávy evidované tržby, ať už se bude jednat o 
chybovou nebo potvrzovací datovou zprávu, budou také uvedeny CORS hlavičky: 
 
HTTP/1.1 200 OK 
... 
X-Global-Transaction-Id: ... 
Access-Control-Allow-Origin: * 
Access-Control-Expose-Headers: X-Global-Transaction-Id 
 
V odpovědi, a to zejména chybové, je důležitá hlavička Access-Control-Expose-Headers, 
která zpřístupňuje JavaScriptu ve WWW prohlížeči hodnotu telemetrické hlavičky X-Global-
Transaction-Id – viz kapitola 5.4 Pomocné technické informace pro trasování níže. 
 
Pokud pokladní systém poplatníka nesplní kontrakt služby (zejména požaduje nesprávnou HTTP 
metodu nebo nesprávně uvede požadované HTTP hlavičky), dostane WWW prohlížeč zamítavou 
zprávu: 
 
HTTP/1.1 405 Method Not Allowed 
... 
X-Global-Transaction-Id: ... 
Access-Control-Expose-Headers: X-Global-Transaction-Id 
 
 
1 Adresa společného technického zařízení dle dokumentu „Přístupové a provozní informace“ příslušného 
pro dané prostředí. 
2 WWW adresa dané pokladní aplikace 

--- PAGE 15 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
15//37 
V tomto případě www prohlížeč následně vůbec neodešle SOAP datovou zprávu evidované tržby 
na koncový bod společného technického zařízení správce daně (neproběhne žádná síťová 
komunikace). 
Význam jednotlivých CORS hlaviček HTTP protokolu je sumarizován níže: 
 
Hlavička 
Směr 
komunikace 
Hodnota 
(nebo její příklad) 
Popis 
Access-Control-
Request-Method 
Požadavek 
POST 
Metoda, kterou WWW prohlížeč 
chce použít pro odeslání zprávy. 
Pro odesílání SOAP zpráv je nutno 
požadovat operaci POST 
Origin 
Požadavek 
https://mojeapl.cz 
Doména, ve které běží web (a 
příslušný JavaScript) pokladního 
systému poplatníka (v příkladu je 
smyšlená hodnota) 
Access-Control-
Request-Headers 
Požadavek 
Content-Type, 
SOAPAction  
Hlavičky, které WWW prohlížeč 
potřebuje odeslat s požadavkem. 
Tyto HTTP hlavičky jsou potřeba 
pro zpracování SOAP zprávy 
evidované tržby 
Access-Control-
Allow-Origin 
Odpověď 
* 
Standardně je volání společného 
technického zařízení správce daně 
povoleno z libovolné internetové 
domény 
Access-Control-
Allow-Methods 
Odpověď 
POST, OPTIONS 
Povolené HTTP metody koncového 
bodu společného technického 
zařízení správce daně. Pro odeslání 
elektronické tržby je důležitá 
podpora metody POST 
Access-Control-
Allow-Headers 
Odpověď 
Content-Type, 
SOAPAction 
Povolené speciální HTTP hlavičky 
nutné pro odeslání SOAP zprávy 
evidované tržby 
Access-Control-
Expose-Headers 
Odpověď 
X-Global-
Transaction-Id 
Zpřístupnění telemetrické HTTP 
hlavičky X-Global-
Transaction-Id ve WWW 
prohlížeči. Tato hlavička je 
potřebná pro efektivní diagnostiku 
případných problémů 
Access-Control-
Max-Age 
Odpověď 
3600 
Nastavení, po jaké době se musí 
www prohlížeč znovu ověřit, zda 
stále smí odesílat SOAP požadavky 
pro elektronickou evidenci tržeb. 
Nastaveno na 1 hod. 
X-Global-
Transaction-Id 
Odpověď 
452ba7806a71df6100
036b61 
Telemetrická hlavička – viz 
kapitola 5.4 Pomocné technické 
informace pro trasování níže – 
uveden je příklad hodnoty 

--- PAGE 16 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
16//37 
2.4 CERTIFIKÁTY 
Certifikáty používané pro účely zabezpečení HTTPS spojení, pro podpis datových zpráv evidované 
tržby a potvrzovacích datových zpráv jsou popsány v dokumentu „Přístupové a provozní 
informace“ příslušném pro dané prostředí. 

--- PAGE 17 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
17//37 
3 
STRUKTURA DATOVÝCH ZPRÁV 
3.1 KÓDOVÁNÍ DATOVÝCH POLOŽEK 
Všechny položky ve všech datových zprávách využívají pouze vybrané znaky kódované jedním 
bajtem ve standardní ASCII znakové sadě. Dekadické kódy povolených znaků mají hodnoty 9, 10, 
13 nebo od 32 do 126. 
Kódování datových zpráv jakožto XML dokumentů je povinně UTF-8, tj. klient musí deklarovat 
správně Content-Type v HTTP hlavičce odesílané datové zprávy: 
 
Content-Type: text/xml; charset=utf-8 
Popřípadě, pokud není tento Content-Type uveden, první řádek XML SOAP obálky musí mít 
vždy tvar: 
<?xml version="1.0" encoding="UTF-8"?> 
Všechny XML elementy e-tržby patří do jmenného prostoru (namespace), který je specifikován 
v definici webové služby (WSDL), např.: 
xmlns:tns="http://fs.gov.cz/eet/schema/v4" 
Maskou datového formátu jednotlivých položek, která je uvedena u jejich detailního popisu níže, 
rozumíme regulární výraz ve smyslu XML schématu, který přesně definuje požadovanou syntaxi 
položky. Pro jednoznačnost je v tomto dokumentu navíc explicitně uveden metaznak pro začátek 
textového řetězce (^) a pro konec textového řetězce ($). 
Hexadecimální číslice větší než 9 („a“ až „f“) je možno uvádět malými nebo velkými písmeny, tj. 
alternativně „A“ až „F“. 
3.2 PŘEHLED STRUKTURY DATOVÝCH ZPRÁV 
Všechny 3 datové zprávy (datová zpráva evidované tržby, potvrzovací datová zpráva, chybová 
datová zpráva) mají společný základní datový formát daný protokolem SOAP (Simple Object 
Access Protocol), tj. aplikační XML datové struktury jsou vloženy do tzv. těla SOAP obálky 
(<SOAP Body>). 
Datová zpráva evidované tržby (viz Obr. 2) a potvrzovací datová zpráva jsou elektronicky 
podepsány (viz Obr. 3), chybová datová zpráva nikoliv (viz Obr. 4). 
 

--- PAGE 18 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
18//37 
 
Obr. 2 Struktura datové zprávy evidované tržby 

--- PAGE 19 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
19//37 
 
 
Obr. 3 Struktura potvrzovací datové zprávy 
 

--- PAGE 20 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
20//37 
 
Obr. 4 Struktura chybové datové zprávy 
3.3 DATOVÁ ZPRÁVA EVIDOVANÉ TRŽBY 
Datová zpráva včetně SOAP obálky je SOAP XML struktura obsahující všechny údaje, které jsou 
stanoveny pro odeslání údajů o evidované tržbě. Vlastní data evidované tržby jsou uložena ve 
vnořené struktuře e-tržby (XML element <Trzba>), která je obsažena v XML elementu <SOAP 
Body>. 
V XML elementu <SOAP Header> je uložen XML signature a pokladní certifikát, k němuž příslušný 
privátní klíč byl použit k vytvoření XML signature. V situaci, kdy certifikát klíče použitý v době 
příjmu tržby již není k okamžiku odesílání datové zprávy evidované tržby platný, použije poplatník 
pro XML signature aktuálně platný certifikát. 
Datová zpráva evidované tržby je formálně přesně popsána v definici příslušné webové služby – 
viz 5 Upřesnění XML zprávy ve tvaru SOAP a její zabezpečení 
Vlastní datová zpráva evidované tržby je uložena v XML elementu <SOAP Body> jako element 
<Trzba>. 
Tento element obsahuje 2 vnořené elementy, které reprezentují datové oblasti: <Hlavicka> a 
<Data>. 
Tyto datové oblasti obsahují vlastní datové položky – viz odstavec 3.3.2 Přehled položek datové 
zprávy o evidované tržbě.  

--- PAGE 21 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
21//37 
3.3.1 XML formát e-tržby 
XML formát e-tržby v přehledu: 
<tns:Trzba> 
 
<tns:Hlavicka atributy … /> 
 
<tns:Data atributy …  /> 
</tns:Trzba> 
 
Atributy a hodnoty XML elementů jsou podrobně popsány níže. 
3.3.2 Přehled položek datové zprávy o evidované tržbě 
Datová 
oblast 
Název položky 
Povinná 
)** 
XML jméno )* 
Hlavička 
1 
UUID zprávy  
Ano 
uuid_zpravy 
2 
Datum a čas odeslání zprávy 
Ano 
dat_odesl 
 
3 
První zaslání údajů o tržbě 
Ano 
prvni_zaslani 
 
4 
Příznak ověřovacího módu odesílání 
Ne 
overeni 
Data 
5 
EIČ poplatníka 
Ano 
eic_popl 
6 
EIČ pověřujícího poplatníka 
Ne 
eic_poverujiciho 
 
7 
Pověření více poplatníky 
Ne 
povereni_vice_popl 
8 
Označení evidenční jednotky 
Ano 
id_jednotky 
9 
Označení pokladního zařízení poplatníka 
Ano 
id_pokl 
10 
Pořadové číslo tržby 
Ano 
porad_cis 
11 
Datum a čas uskutečnění tržby 
Ano 
dat_trzby 
12 
Celková částka tržby 
Ano 
celk_trzba 
 
13 
Celková částka plateb určená 
k následnému čerpání nebo zúčtování 
Ne 
urceno_cerp_zuct 
 
14 
Celková částka plateb, které jsou 
následným čerpáním nebo zúčtováním 
platby 
Ne 
cerp_zuct 
)* XML jméno znamená buď jméno XML elementu, nebo XML atributu. 
)** Položky označené jako povinné musí být vyplněny v každé datové zprávě. Položky označené 
jako nepovinné musí být vyplněny, pokud jsou k evidované tržbě relevantní (např. je-li poplatník 
pověřen evidencí tržeb jiného poplatníka, musí vyplnit položku EIČ pověřujícího poplatníka). 
Nejsou-li nepovinné položky uvedeny, jsou považovány za prázdné. Položky s prázdnou hodnotou 
jsou v XML zprávě nepřípustné. 
Příklad: 
Uvedení následující prázdné položky ve zprávě je chybné: 
eic_poverujiciho="" 
3.3.3 Podrobný popis položek e-tržby 
V této kapitole jsou popsány položky e-tržby z hlediska technického formátu a struktury.  Další 
informace k jejich věcnému obsahu budou obsaženy v dokumentu „Popis položek datové zprávy 
a příklady situací při evidenci tržeb“. Jako příklady konkrétních EIČ byly v dalším textu použity 
EIČ=CZ00000019, EIČ=CZ683555118 a EIČ=CZ8551015704. 

--- PAGE 22 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
22//37 
3.3.3.1 
UUID zprávy (uuid_zpravy) 
Je atributem XML elementu <Hlavicka>. UUID (Universally Unique Identifier) datové zprávy 
evidované tržby je generováno pokladním zařízením poplatníka. UUID má mít formát dle RFC 
9562: 
xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx 
kde „x“, „M“ a „N“ značí hexadecimální číslici. Číslice „M“ značí verzi UUID a má povolené 
hodnoty 1 až 5. Doporučená verze UUID je 4. Jde o univerzální jedinečný identifikátor v hlavičce 
datové zprávy evidované tržby, který je generován pokladním zařízením poplatníka. Jednoznačně 
identifikuje datovou zprávu (nikoli e-tržbu). I při opakovaném zaslání datové zprávy má být 
vytvořeno nové UUID zprávy. Hodnota dvou nejvyšších bitů číslice N je povinně 1 0 (označuje 
variantu UUID), tj. tato číslice má povolené hexadecimální hodnoty: 8, 9, A, B. 
Maska datového formátu: 
^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-
F]{3}-[0-9a-fA-F]{12}$ 
kde znak "-"  je pomlčka (znak s dekadickým kódem 45 v ASCII znakové sadě). 
Délka: 36 znaků. 
Příklad: 
b3a09b52-7c87-4014-a496-4c7a53cf9125 
3.3.3.2 
Datum a čas odeslání zprávy (dat_odesl) 
Je atributem XML elementu <Hlavicka>. Datum a čas odeslání zprávy je okamžik, kdy pokladní 
zařízení odeslalo datovou zprávu evidované tržby. 
Datový formát je určen datovým typem DateTime dle ISO 8601, jak je předpokládá příslušná 
W3C specifikace: https://www.w3.org/TR/xmlschema11-2/#dateTime: 
rrrr-mm-ddThh:mm:ss±hh:mm 
kde „rrrr-mm-dd“ je datum ve tvaru „rok-měsíc-den“, „hh:mm:ss“ je čas ve tvaru 
„hodina:minuta:sekunda“ a „±hh:mm“ značí časovou zónu jako rozdíl vůči světovému času 
(UTC/GMT) v hodinách a minutách. Znak „±“ je buď „+“ (plus) nebo „-“ (minus) podle toho, zda 
rozdíl proti světovému času je kladný nebo záporný. Jako speciální hodnotu rozdílu lze uvést 
řetězec „Z“, který má stejný význam jako „+00:00“. 
Datum a čas odeslání datové zprávy se uvádí jako lokální čas v dané časové zóně s povinným 
vyznačením časové zóny podle následujícího pravidla: 
 
• 
+01:00 v případě, že hodnota spadá do období zimního času v ČR – tj. časová zóna je 
SEČ 
• 
+02:00 v případě, že hodnota spadá do období letního času v ČR – tj. časová zóna je 
SELČ 
• 
+hh:mm, nebo –hh:mm nebo Z v případě, že hodnota je uvedena v jiné časové zóně 
(mimo ČR). 
Délka: 25 znaků. 
Příklad – zimní čas: 
2027-01-09T04:25:28+01:00 

--- PAGE 23 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
23//37 
Tento časový okamžik znamená 4 hodiny, 25 minut a 28 sekund SEČ, tedy 3 hodiny 25 minut 28 
sekund UTC/GMT. 
Příklad – letní čas: 
2027-06-09T05:25:28+02:00 
Tento časový okamžik znamená 5 hodin, 25 minut a 28 sekund SELČ, tedy 3 hodiny 25 minut 28 
sekund UTC/GMT. 
3.3.3.3 
První zaslání údajů o tržbě (prvni_zaslani) 
Je atributem XML elementu <Hlavicka>. Je to příznak s hodnotami true nebo false (též 1 nebo 0), 
který určuje, zda jde o první zaslání konkrétní evidované tržby (hodnota: true nebo 1) nebo o 
opakované zaslání téže tržby (hodnota: false nebo 0). 
Datový 
formát 
je 
určen 
příslušnou 
W3C 
specifikací, 
viz: 
https://www.w3.org/TR/xmlschema11-2/#boolean. 
Délka: 1 až 5 znaků. 
Příklad: 
true 
3.3.3.4 
Příznak ověřovacího módu odesílání (overeni) 
Je atributem XML elementu <Hlavicka>. Je to příznak, kterým si pokladní zařízení poplatníka může 
nastavit ověřovací mód odesílání datových zpráv evidovaných tržeb. 
Je-li tento příznak uveden a má-li hodnotu true (nebo 1), je datová zpráva zpracována 
v ověřovacím módu – viz 2.2 Módy odesílání datových zpráv, produkční a neprodukční prostředí. 
Není-li tento příznak uveden nebo má-li hodnotu false (nebo 0), je datová zpráva zpracována 
v ostrém módu. 
Datový 
formát 
je 
určen 
příslušnou 
W3C 
specifikací, 
viz 
https://www.w3.org/TR/xmlschema11-2/#boolean. 
Délka: 1 až 5 znaků. 
Příklad: 
true 
3.3.3.5 
EIČ poplatníka (eic_popl) 
Je atributem XML elementu <Data>. Je to EIČ poplatníka, který odesílá datovou zprávu evidované 
tržby, platné k okamžiku uskutečnění tržby nebo vydání příkazu k jejímu provedení, pokud byl 
tento příkaz vydán dříve. Povinnou součástí EIČ je kód státu: CZ. Hodnota atributu se shoduje 
s EIČ uvedeným v certifikátu použitém pro elektronický podpis datové zprávy (certifikát je 
součástí SOAP obálky datové zprávy evidované tržby). Poplatník EET, kterému bylo změněno EIČ, 
může odesílat datové zprávy evidovaných tržeb s novým EIČ v atributu eic_popl podepsané 
původním certifikátem, dokud mu není vystaven certifikát nový. 
Maska datového formátu: 
^CZ[0-9]{8,10}$ 
Délka: 10 až 12 znaků. 
Příklady: 

--- PAGE 24 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
24//37 
CZ00000019 
CZ683555118 
CZ8551015704 
3.3.3.6 
EIČ pověřujícího poplatníka (eic_poverujiciho) 
Je nepovinným atributem XML elementu <Data>. Je to platné EIČ poplatníka, kterému tržba 
plyne a který pověřil jiného poplatníka, aby za něj tuto tržbu evidoval. Datový formát je identický 
jako pro EIČ poplatníka. 
3.3.3.7 
Pověření více poplatníky (povereni_vice_popl) 
Je nepovinným atributem XML elementu <Data>. Tento příznak s hodnotami true nebo false (též 
1 nebo 0) určuje, zda je tržba evidována v pověření za více poplatníků, kterým tato evidovaná tržba 
plyne (např. z titulu sdružení bez právní subjektivity/spoluvlastnictví, kdy tržba plyne všem 
členům sdružení/spoluvlastníkům a tito členové/spoluvlastníci pověří evidováním této tržby 
jednoho poplatníka, typicky jednoho ze členů/spoluvlastníků). 
Pokud položka není uvedena, má to stejný význam, jako by byla uvedena s hodnotou false/0. 
Datový 
formát 
je 
určen 
příslušnou 
W3C 
specifikací, 
viz: 
https://www.w3.org/TR/xmlschema11-2/#boolean. 
Délka: 1 až 5 znaků. 
Příklad: 
true 
3.3.3.8 
Označení evidenční jednotky (id_jednotky) 
Je atributem XML elementu <Data>. Jedná se o číselné označení evidenční jednotky, které bylo 
přiděleno poplatníkovi na portálu MOJE Daně v DIS+. Označení evidenční jednotky je unikátní 
v rámci poplatníka. Čísla evidenčních jednotek mají obvykle alespoň 2 dekadická místa a 
poslední dekadickou číslici 1, 2, 3 a nebo 4. 
Maska datového formátu: 
 
^[1-9][0-9]{0,8}$ 
Délka: 1 až 9 znaků, tj. číselný rozsah je od 1 do 999 999 999. 
Příklad: 
 
24 
 
164968741 
3.3.3.9 
Označení pokladního zařízení poplatníka (id_pokl) 
Je atributem XML elementu <Data>. Je to identifikační kód pokladního zařízení poplatníka, které 
zasílá datovou zprávu evidované tržby na společné technické zařízení správce daně. Tento kód je 
tvořen na straně poplatníka alfanumerickými znaky a vybranými speciálními znaky. Pro 
konkrétního poplatníka musí být označení pokladního zařízení unikátní v jedné evidenční 
jednotce v jednom okamžiku. Přesně to znamená, že musí být unikátní čtveřice položek:  
 
(eic_popl, id_jednotky, id_pokl, dat_trzby) 
 

--- PAGE 25 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
25//37 
Maska datového formátu: 
 
^[0-9a-zA-Z\.,:;/#\-_ ]{1,20}$ 
kde poslední znak v hranaté závorce je mezera (znak " " s dekadickým kódem 32 v ASCII znakové 
sadě) a znak "-" je pomlčka (znak s dekadickým kódem 45 v ASCII znakové sadě). 
Délka: 1 až 20 znaků. 
Příklad: 
 
5a/A-q/5:22d_2 
3.3.3.10 
Pořadové číslo tržby (porad_cis) 
Je atributem XML elementu <Data>.  Jde o pořadové číslo tržby, které je tvořeno na straně 
poplatníka. Tento kód je tvořen alfanumerickými znaky a vybranými speciálními znaky. 
Pro konkrétního poplatníka musí být pořadové číslo tržby unikátní v jedné evidenční jednotce, pro 
jedno pokladní zařízení v jednom okamžiku. Přesně to znamená, že musí být unikátní pětice 
položek: 
(eic_popl, id_jednotky, id_pokl, porad_cis, dat_trzby). 
Typicky je pořadové číslo tržby číslem, které poplatník uvede jako číslo účtenky, pokud vydává 
účtenku k danému plnění (např. podle zákona o ochraně spotřebitele). 
 
Maska datového formátu: 
 
^[0-9a-zA-Z\.,:;/#\-_ ]{1,25}$ 
kde poslední znak v hranaté závorce je mezera (znak " " s dekadickým kódem 32 v ASCII znakové 
sadě) a znak "-" je pomlčka (znak s dekadickým kódem 45 v ASCII znakové sadě). 
Délka: 1 až 25 znaků. 
Příklad: 
 
#25/c-12/1A_2/2027 
3.3.3.11 
Datum a čas uskutečnění tržby (dat_trzby) 
Je atributem XML elementu <Data>. Jde o datum a čas uskutečnění evidované tržby, tj. přijetí 
evidované tržby nebo vydání příkazu k jejímu provedení, pokud byl tento příkaz vydán dříve. 
Formát je identický jako u položky – viz 3.3.3.2 Datum a čas odeslání zprávy, tj. uvádí se datum a 
čas rozhodného okamžiku v lokální časové zóně, ve které se tržba uskutečnila, a k tomu povinně 
jednoznačné určení této časové zóny. 
3.3.3.12 
Finanční položky tržby 
Všechny finanční položky tržby jsou atributy XML elementu <Data>.  Jedná se o následující číselné 
položky, které představují finanční hodnoty v českých korunách: 
 
12 
Celková částka tržby 
13 
Celková částka plateb určená k následnému čerpání nebo zúčtování 
14 
Celková částka plateb, které jsou následným čerpáním nebo zúčtováním platby 
 

--- PAGE 26 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
26//37 
Číselné hodnoty všech částek jsou uvedeny v dekadické soustavě s právě dvěma povinnými 
desetinnými 
místy 
a 
řádovou 
tečkou 
v souladu 
se 
specifikací 
https://www.w3.org/TR/xmlschema11-2/#decimal. Hodnoty mohou být kladné, nulové nebo 
záporné. 
Aby byla zaručena jednoznačná korespondence mezi číselnou hodnotou finanční položky a 
řetězcem znaků dekadické reprezentace této hodnoty, jsou zakázány číselně nevýznamné 
vedoucí nuly a znak minus (znak pomlčky s dekadickým kódem 45 v ASCII znakové sadě) před 
nulovou hodnotou. 
Finanční položky, které datová zpráva neobsahuje, nebo nemají vyplněnou hodnotu, jsou 
považovány za prázdné, tj. nedefinované (pozor: takové položky nebudou považovány za číselnou 
hodnotu 0). Položky s prázdnou hodnotou jsou v XML zprávě nepřípustné – viz 3.3.2 Přehled 
položek datové zprávy o evidované tržbě. 
Maska datového formátu: 
 
^((0|-?[1-9]\d{0,7})\.\d\d|-0\.(0[1-9]|[1-9]\d))$ 
Délka:  
• 
pro nezáporné hodnoty: 4 až 11 znaků, tj. minimální nezáporná hodnota je 0,00 Kč a 
maximální nezáporná hodnota je 99 999 999,99 Kč 
• 
pro záporné hodnoty: 5 až 12 znaků, tj. minimální záporná hodnota je -99 999 999,99 Kč 
a maximální záporná hodnota je -0,01 Kč. 
To znamená, že finanční položky jsou v absolutní hodnotě omezeny na čísla menší než 100 
milionů Kč. 
Příklady: 
 
250.00 
 
-187.20 
 
0.56  
Příklady chybné textové reprezentace: 
 
Číselná hodnota 
Chybná reprezentace 
Správná reprezentace 
20,45 
020.45 
20.45 
10,25 
00010.25 
10.25 
0 
-0.00 
0.00 
0 
-00.00 
0.00 
0,2 
.20 
0.20 
-100 
-00100.00 
-100.00 
 
3.3.4 Příklad e-tržby 
V následujícím textu uvádíme příklad XML elementu <Trzba> zasílaného v běžném produkčním 
módu: 
 

--- PAGE 27 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
27//37 
<tns:Trzba> 
 
<tns:Hlavicka  
uuid_zpravy="e23e5a5a-08d7-4a08-844d-2b6c6b60621d"  
 
dat_odesl="2027-01-08T21:19:40+01:00" 
 
prvni_zaslani="true" /> 
<tns:Data eic_popl="CZ8551015704" eic_poverujiciho="CZ00000019" 
povereni_vice_popl="true"  id_jednotky="181" id_pokl="00/2535/CN58" 
porad_cis="0/2482/IE25"  
dat_trzby="2027-01-07T22:01:00+01:00" 
celk_trzba="87988.00"  
urceno_cerp_zuct="343.00" 
cerp_zuct="237.00" /> 
</tns:Trzba> 
 
Dále uvádíme příklad XML elementu <Trzba> zasílaného v ověřovacím módu: 
 
<tns:Trzba> 
 
<tns:Hlavicka  
uuid_zpravy="e23e5a5a-08d7-4a08-844d-2b6c6b60621d"  
 
dat_odesl="2027-01-08T21:19:40+01:00" 
 
prvni_zaslani="true" overeni="true" /> 
<tns:Data eic_popl="CZ8551015704" eic_poverujiciho="CZ00000019" 
povereni_vice_popl="true" id_jednotky="181" id_pokl="00/2535/CN58" 
porad_cis="0/2482/IE25"  
dat_trzby="2027-01-07T22:01:00+01:00" 
celk_trzba="87988.00"  
urceno_cerp_zuct="343.00" 
cerp_zuct="237.00" /> 
</tns:Trzba> 
3.4 POTVRZOVACÍ DATOVÁ ZPRÁVA 
Potvrzovací datová zpráva je SOAP XML struktura obsahující potvrzovací údaje o přijetí evidované 
tržby společným technickým zařízením správce daně. Potvrzovací data evidované tržby jsou 
uložena v XML elementu <SOAP Body>. 
V XML elementu <SOAP Header> je uložen XML signature a certifikát společného technického 
zařízení správce daně, k němuž příslušný privátní klíč byl použit k vytvoření XML signature. 
Vlastní potvrzení je uloženo v XML elementu <SOAP Body> jako element <Odpoved>. Tento 
element obsahuje 2 vnořené elementy, které reprezentují datové oblasti: <Hlavicka> a 
<Potvrzeni>. Tyto datové oblasti obsahují vlastní datové položky – viz odstavec 3.4.2 Přehled 
datových položek potvrzení. 
Jednotlivé varianty odpovědi systému EET v závislosti na módu, validitě datové zprávy a cílovém 
prostředí jsou popsány v tabulce Tabulka 1: Varianty odpovědi systému EET. 
V případě, že nastane jedna či více propustných chyb (viz odst. 2.2.4 Propustné kontroly 
(propustné chyby)), je potvrzovací datová zpráva doplněna o textová varování a příslušné číselné 
kódy varování. 
3.4.1 XML formát potvrzení 
XML formát potvrzení v přehledu: 
<tns:Odpoved> 
 
 
<tns:Hlavicka atributy … /> 
 
 
<tns:Potvrzeni atributy …  />  

--- PAGE 28 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
28//37 
 
<tns:Varovani atributy ... > 
 
 
hodnoty ... 
 
</tns:Varovani> 
 
... 
</tns:Odpoved>  
 
Nepovinný XML element <Varovani> může být uveden vícekrát pro různá varování. Atributy a 
hodnoty XML elementů jsou podrobně popsány níže. 
3.4.2 Přehled datových položek potvrzení 
Datová oblast 
Název položky 
Povinná XML jméno )* 
Hlavička 
1 UUID zprávy  
Ano 
uuid_zpravy 
2 Datum a čas přijetí zprávy 
Ano 
dat_prij 
Potvrzeni 
3 Potvrzovací kód 
Ano 
pok 
 
4 Příznak neprodukčního prostředí 
Ne 
test 
Varování 
5 Kód varování 
Ne 
kod_varov )** 
 
6 Textový popis varování 
Ne 
Varovani )** 
)* XML jméno znamená buď jméno XML elementu, nebo XML atributu. 
)** XML element <Varovani> s atributem kod_varov se v potvrzovací zprávě může vícekrát 
opakovat. 
3.4.2.1 
UUID zprávy (uuid_zpravy) 
Je atributem XML elementu <Hlavicka>. Jedná se o UUID datové zprávy evidované tržby, která byla 
zaslána pokladním zařízením poplatníka – popis viz 3.3.3.1 UUID zprávy. 
3.4.2.2 
Datum a čas přijetí zprávy (dat_prij) 
Je atributem XML elementu <Hlavicka>. Datum a čas přijetí potvrzované zprávy je okamžik, kdy 
společné technické zařízení správce daně přijalo datovou zprávu evidované tržby. 
Datový formát této položky je identický s formátem data a času odeslání zprávy – viz 3.3.3.2 
Datum a čas odeslání zprávy. 
3.4.2.3 
Potvrzovací kód (pok) 
Je atributem XML elementu <Potvrzeni>. Jedná se o potvrzovací kód (POK) generovaný společným 
technickým zařízením správce daně, který je unikátní pro každou potvrzovanou datovou zprávu 
evidované tržby, jež byla zaslána pokladním zařízením poplatníka. 
Datový formát POK je následující: 
uuid_prijem-Id_zarizeni 
Kde uuid_prijem je UUID číslo generované konkrétním zařízením transakčního systému EET, 
které zprávu přijalo, a Id_zarizeni je 2-místné hexadecimální číslo tohoto zařízení.  
Maska datového formátu: 
^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-
F]{3}-[0-9a-fA-F]{12}-[0-9a-fA-F]{2}$ 
Délka: 39 znaků. 

--- PAGE 29 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
29//37 
Příklad: 
b3a09b52-7c87-4014-a496-4c7a53cf9125-03 
 
Pokud je POK přidělen v neprodukčním prostředí a nejedná se tedy o skutečný POK dle ZoET, 
potom mají poslední dva znaky POK speciální hodnotu ff (mnemotechnická pomůcka: Fiktivní 
Fiktivní=ff) 
Příklad: 
 
b3a09b52-7c87-4014-a496-4c7a53cf9125-ff 
3.4.2.4 
Příznak neprodukčního prostředí (test) 
Je atributem XML elementu <Potvrzeni>. Je to příznak, kterým společné technické zařízení 
správce daně informuje pokladní zařízení poplatníka, zda datová zpráva evidované tržby byla 
zaslána do produkčního nebo neprodukčního prostředí. 
Je-li tento příznak uveden a má-li hodnotu true (nebo 1), byla datová zpráva přijata do 
neprodukčního prostředí – viz 2.2 Módy odesílání datových zpráv, produkční a neprodukční 
prostředí. 
Není-li tento příznak uveden, byla datová zpráva přijata do produkčního prostředí. 
Datový 
formát 
je 
určen 
příslušnou 
W3C 
specifikací, 
viz: 
https://www.w3.org/TR/xmlschema11-2/#boolean. 
Délka: 1 až 5 znaků. 
Příklad: 
true 
3.4.2.5 
Kód varování (kod_varov) 
Je atributem XML elementu <Varovani>. Jedná se o celé max. 3-ciferné kladné dekadické číslo, 
které dle stanoveného číselníku označuje konkrétní varování. 
Maska datového formátu: 
 
^[1-9]\d{0,2}$ 
Délka: 1 až 3 znaky. 
Příklady: 
 
1 
 
3 
3.4.2.6 
Textový popis varování (Varovani) 
Je hodnotou XML elementu <Varovani>. Jedná se o znakový řetězec, který v českém jazyce 
stručně popisuje, k jaké propustné chybě při zpracování datové zprávy evidované tržby došlo. 
Z důvodu konzistence všech datových zpráv jsou povolené znaky v dolní ASCII sadě XML 
povolených znaků, tj. jejich dekadické kódy mají hodnoty 9, 10, 13 nebo od 32 do 126. To 
znamená, že textový popis chyby nepoužívá diakritiku. 
Délka: max. 100 znaků. 

--- PAGE 30 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
30//37 
3.4.3 Příklad potvrzení 
V následujícím textu uvádíme příklad XML elementu <Odpoved> z produkčního prostředí, bez 
propustných chyb: 
<tns:Odpoved> 
 
<tns:Hlavicka uuid_zpravy="123e4567-e89b-42d3-a456-
426655440000" 
 
dat_prij="2027-03-04T18:25:21+01:00" /> 
 
<tns:Potvrzeni pok="987a6be5-6af5-44f3-b4fc-987654321000-02" /> 
</tns:Odpoved> 
 
Dále uvádíme příklad XML elementu <Odpoved> z neprodukčního prostředí, kde odpověď 
obsahuje varování o propustných chybách: 
<tns:Odpoved> 
 
<tns:Hlavicka uuid_zpravy="123e4567-e89b-42d3-a456-
426655440000" 
 
dat_prij="2027-03-04T18:25:21+01:00" /> 
 
<tns:Potvrzeni pok="987a6be5-6af5-44f3-b4fc-987654321000-ff"  
 
test="true" /> 
 
<tns:Varovani kod_varov="1" > 
 
 
EIC poplatnika v datove zprave se neshoduje s EIC 
v certifikatu 
   
</tns:Varovani>  
 
<tns:Varovani kod_varov="2" > 
 
 
Chybny format EIC poverujiciho poplatnika 
   
</tns:Varovani> 
</tns:Odpoved> 
3.4.4 Seznam kódů a textů varování 
 
Kód varování 
Text varování )* 
1 
EIC poplatnika v datove zprave se neshoduje s EIC v certifikatu 
2 
Chybny format EIC poverujiciho poplatnika 
3 
)*** 
4 
Datum a cas uskutecneni trzby je novejsi nez datum a cas prijeti 
zpravy 
5 
Datum a cas uskutecneni trzby je vyrazne v minulosti   
6 
id_jednotky neodpovida formatem pridelenemu c. evidencni jednotky 
7 
EIC poverujiciho se shoduje s EIC poplatnika 
8 – 999 
)** 
)* Texty varování jsou v souladu s kódováním znaků ve všech datových zprávách EET uváděny bez 
diakritiky – viz 3.1 Kódování datových položek. 
)** Rezervováno pro budoucí použití. 
)*** Bylo používáno před verzí datové zprávy 4 

--- PAGE 31 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
31//37 
3.5 CHYBOVÁ DATOVÁ ZPRÁVA 
Chybová datová zpráva je SOAP XML struktura obsahující chybový kód a textové chybové 
hlášení o: 
 
1. kritické chybě přijaté datové zprávy evidované tržby  
 
nebo 
2. dočasné technické chybě zpracování na straně společného technického zařízení 
správce daně (nutnost odeslat datovou zprávu evidované tržby později). 
Data chybové datové zprávy jsou uložena v XML elementu <SOAP Body> jako element 
<Odpoved>. Tento element obsahuje 2 vnořené elementy, které reprezentují datové oblasti: 
<Hlavicka> a <Chyba>. Tyto datové oblasti obsahují vlastní datové položky – viz odstavec 3.5.2 
Přehled datových položek chyby. 
V tomto případě <SOAP Header>  neobsahuje ani XML signature ani certifikát. 
Jednotlivé varianty odpovědi systému EET v závislosti na módu, validitě datové zprávy a cílovém 
prostředí jsou popsány v tabulce Tabulka 1: Varianty odpovědi systému EET. 
V ověřovacím módu v chybové datové zprávě s chybovým kódem 0 (Datovou zpravu evidovane 
trzby v overovacim modu se podarilo zpracovat) je v případě, že nastane jedna či více propustných 
chyb (viz odst. 2.2.4 Propustné kontroly (propustné chyby)), chybová datová zpráva doplněna o 
textová varování a příslušné číselné kódy varování stejným způsobem, jako potvrzovací datová 
zpráva. 
3.5.1 XML formát chyby 
XML formát chyby v přehledu: 
<tns:Odpoved> 
 
 
<tns:Hlavicka atributy … /> 
 
 
<tns:Chyba atributy …>  
 
 
hodnoty … 
 
 
</tns:Chyba> 
 
<tns:Varovani atributy …> 
 
 
 
hodnoty … 
 
 
</tns:Varovani> 
</tns:Odpoved>  
 
Atributy a hodnoty XML elementů jsou podrobně popsány níže. 
3.5.2 Přehled datových položek chyby 
Datová 
oblast 
Název položky 
Povinná 
XML jméno )* 
Hlavička 
1 UUID zprávy  
Ne 
uuid_zpravy 
2 Datum a čas odmítnutí zprávy 
Ne 
dat_odmit 
Chyba 
3 Chybový kód 
Ano 
kod 
 
4 Textový popis chyby 
Ano 
Chyba 
 
5 Příznak neprodukčního prostředí 
Ne 
test 
Varování 
6 Kód varování 
Ne 
kod_varov )** 

--- PAGE 32 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
32//37 
Datová 
oblast 
Název položky 
Povinná 
XML jméno )* 
 
7 Textový popis varování 
Ne 
Varovani )** 
)* XML jméno znamená buď jméno XML elementu, nebo XML atributu. 
)** XML element <Varovani> je relevantní v případě chybové zprávy pouze pro chybový kód 0 
(„Datovou zpravu evidovane trzby v overovacim modu se podarilo zpracovat“). XML element 
<Varovani> s atributem kod_varov se v chybové zprávě může vícekrát opakovat. 
3.5.2.1 
UUID zprávy (uuid_zpravy) 
Je atributem XML elementu <Hlavicka>. Jedná se o UUID datové zprávy evidované tržby obsahující 
chybu, která byla zaslána pokladním zařízením poplatníka – popis viz 3.3.3.1 UUID zprávy. 
3.5.2.2 
Datum a čas odmítnutí zprávy  (dat_odmit) 
Je atributem XML elementu <Hlavicka>. Datum a čas odmítnutí zprávy, která obsahuje chybu, je 
okamžik zpracování chybné datové zprávy evidované tržby na společném technickém zařízení 
správce daně. 
Datový formát této položky je identický s formátem data a času odeslání zprávy – viz 3.3.3.2 
Datum a čas odeslání zprávy. 
3.5.2.3 
Chybový kód (kod) 
Je atributem XML elementu <Chyba>. Jedná se o celé max. 3-ciferné dekadické číslo, které dle 
stanoveného číselníku označuje konkrétní kritickou chybu. Hodnoty chybového kódu mohou být 
kladné, nulové nebo záporné. 
Maska datového formátu: 
 
^-?\d{1,3}$ 
Délka:  
• 
pro nezáporné hodnoty: 1 až 3 znaky, tj. minimální nezáporná hodnota je 0, maximální 
nezáporná hodnota je 999 
• 
pro záporné hodnoty: 2 až 4 znaky, tj. minimální záporná hodnota je -999, maximální 
záporná hodnota je -1 
Příklady: 
 
10 
 
-1 
 
560 
3.5.2.4 
Textový popis chyby (Chyba) 
Je hodnotou XML elementu <Chyba>. Jedná se o znakový řetězec, který v českém jazyce stručně 
popisuje, k jaké chybě při zpracování datové zprávy evidované tržby došlo. 
Z důvodu konzistence všech datových zpráv jsou povolené znaky v dolní ASCII sadě XML 
povolených znaků, tj. jejich dekadické kódy mají hodnoty 9, 10, 13 nebo od 32 do 126. To 
znamená, že textový popis chyby nepoužívá diakritiku. 
Délka: max. 100 znaků. 

--- PAGE 33 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
33//37 
3.5.2.5 
Příznak neprodukčního prostředí (test) 
Je atributem XML elementu <Chyba>. Je to příznak, kterým společné technické zařízení správce 
daně informuje pokladní zařízení poplatníka, zda datová zpráva evidované tržby byla zaslána do 
produkčního nebo neprodukčního prostředí. 
Je-li tento příznak uveden a má-li hodnotu true (nebo 1), byla datová zpráva přijata do 
neprodukčního prostředí – viz 2.2 Módy odesílání datových zpráv, produkční a neprodukční 
prostředí. 
Není-li tento příznak uveden, byla datová zpráva přijata do produkčního prostředí. 
Datový 
formát 
je 
určen 
příslušnou 
W3C 
specifikací, 
viz: 
https://www.w3.org/TR/xmlschema11-2/#boolean. 
Délka: 1 až 5 znaků. 
Příklad: 
true 
3.5.3 Příklad chyby 
V následujícím textu uvádíme příklady chybové odpovědi ve tvaru XML elementu <Odpoved> 
obsahujícího informaci o chybě. 
Zde jsou příklady odpovědí produkčního prostředí ve tvaru XML elementu <Odpoved> 
obsahujícího informaci o chybě: 
 
Příklad 1 (velikost datové zprávy přesáhla dokumentovaný limit): 
<tns:Odpoved> 
 
<tns:Hlavicka 
 
 
uuid_zpravy="123e4567-e89b-42d3-a456-426655440000" 
 
 
dat_odmit="2027-03-04T18:25:21+01:00" /> 
 
<tns:Chyba kod="7"> 
 
 
Datova zprava je prilis velka 
 
</tns:Chyba> 
</tns:Odpoved> 
 
Příklad 2 (datovou zprávu evidované tržby se nepovedlo analyzovat): 
<tns:Odpoved> 
 
<tns:Hlavicka dat_odmit="2027-03-04T18:25:21+01:00" /> 
 
<tns:Chyba kod="3"> 
 
 
XML zprava nevyhovela kontrole XML schematu 
</tns:Chyba> 
</tns:Odpoved> 
 
Příklad 3 (technický problém na straně společného zařízení správce daně): 
<tns:Odpoved> 
 
<tns:Hlavicka dat_odmit="2027-03-04T18:25:21+01:00" /> 
 
<tns:Chyba kod="-1"> 
Docasna technicka chyba zpracovani – odeslete prosim 
datovou zpravu pozdeji 
</tns:Chyba> 
</tns:Odpoved> 

--- PAGE 34 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
34//37 
 
Dále uvádíme příklad chybové odpovědi ve tvaru XML elementu <Odpoved> z neprodukčního 
prostředí: 
<tns:Odpoved> 
 
<tns:Hlavicka 
 
 
uuid_zpravy="123e4567-e89b-42d3-a456-426655440000"  
 
 
dat_odmit="2027-03-04T18:25:21+01:00" /> 
 
<tns:Chyba kod="7" test="true" > 
 
 
Datova zprava je prilis velka 
 
</tns:Chyba> 
</tns:Odpoved> 
 
3.5.4 Seznam chybových kódů a chybových zpráv 
 
Kód 
Text chybové zprávy )* 
-999 – -2 )** 
-1 
Docasna technicka chyba zpracovani – odeslete prosim 
datovou zpravu pozdeji 
0 
Datovou zpravu evidovane trzby v overovacim modu se 
podarilo zpracovat 
1 
)** 
2 
Kodovani XML neni platne )**** 
3 
XML zprava nevyhovela kontrole XML schematu 
4 
Neplatny podpis SOAP zpravy 
5 
)*** 
6 
EIC poplatnika ma chybnou strukturu 
7 
Datova zprava je prilis velka 
8 
Datova zprava nebyla zpracovana kvuli technicke chybe 
nebo chybe dat 
9 – 999 )** 
)* Texty chybových zpráv jsou v souladu s kódováním znaků ve všech datových zprávách EET 
uváděny bez diakritiky – viz 3.1 Kódování datových položek. 
)** Rezervováno pro budoucí použití. 
)*** Bylo používáno před verzí datové zprávy 4 
)**** Podle situace je možné na tuto chybu reagovat i navrácením technické chyby, např. tzv. 
SOAP fault, nebo dokonce ignorováním datové zprávy, pokud je podezření, že se jedná o 
kybernetický útok. 

--- PAGE 35 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
35//37 
4 JEDNOZNAČNÝ KÓD TRŽBY – URČENÍ UNIKÁTNOSTI DANÉ TRŽBY 
Evidovaná tržba je jednoznačně identifikována normalizovanými (kanonizovanými) hodnotami 
základních datových položek XML elementu <Data> e-tržby, které jsou uvedeny v následující 
tabulce. 
Bude-li přijata datová zpráva evidované tržby se stejnými hodnotami základních datových položek 
jako některá již dříve přijatá zpráva, bude nová zpráva považována za zaslání údajů o téže 
evidované tržbě. 
Níže uvedené zpracování nemusí pokladní zařízení provádět; popis je zde uveden proto, aby bylo 
zřejmé, jak je unikátnost tržby určována. 
 
Datová oblast 
Název položky – základní 
Povinná 
XML jméno 
Data 
5 
EIČ poplatníka 
Ano 
eic_popl 
8 
Označení evidenční jednotky 
Ano 
id_jednotky 
9 
Označení pokladního zařízení 
Ano 
id_pokl 
10 Pořadové číslo tržby 
Ano 
porad_cis 
11 Datum a čas uskutečnění tržby 
Ano 
dat_trzby 
12 Celková částka tržby 
Ano 
celk_trzba 
Jednoznačný kombinovaný údaj, který určuje unikátnost dané tržby, je sestaven jako textový 
řetězec (plaintext) zřetězením výše uvedených položek datové zprávy evidované tržby 
v uvedeném pořadí v kódování ASCII s použitím oddělovače „|“ (ASCII znak s dekadickou 
hodnotou 124) mezi jednotlivými položkami. 
Pokud nebude nepovinná položka uvedena, musí do textu vstupovat jako prázdný řetězec (""). 
Příklad: 
Nechť příslušné hodnoty výše uvedených položek jsou následující: 
 
Název položky – základní 
XML jméno 
Hodnota 
5 
EIČ poplatníka 
eic_popl 
CZ00000019 
8 
Označení evidenční jednotky 
id_jednotky 
243 
9 
Označení pokladního zařízení 
id_pokl 
24/A-6/Brno_2 
10 Pořadové číslo tržby 
porad_cis 
#135433c/11/2027 
11 Datum a čas uskutečnění tržby dat_trzby 
2027-01-09T16:45:36+01:00 
12 Celková částka tržby 
celk_trzba 
3264.50 
 
Potom text ("plaintext"), z něhož je počítán jednoznačný kód tržby, bude mít hodnotu: 
CZ00000019|243|24/A-6/Brno_2|#135433c/11/2027|2027-01-09T16:45:36+01:00|3264.50 

--- PAGE 36 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
36//37 
5 UPŘESNĚNÍ XML ZPRÁVY VE TVARU SOAP A JEJÍ ZABEZPEČENÍ 
Rozhraní webové služby je formálně definováno formou WSDL (Web Services Description 
Language).  WSDL dokument odkazuje na příslušný dokument XML schéma, který popisuje vlastní 
XML strukturu e-tržby. XML struktura e-tržby je jediným obsahem SOAP elementu <soap:Body>. 
Soubory XML schéma a WSDL jsou přílohou tohoto dokumentu. 
Zabezpečení webové služby je realizováno v souladu se standardem Web Services Security (WSS) 
v následujících oblastech. 
5.1 ŠIFROVÁNÍ KOMUNIKACE PROTOKOLEM HTTPS 
Společné technické zařízení správce daně se prokazuje TLS certifikátem serveru. Pokladní 
zařízení musí v rámci navázání spojení TLS (TLS handshake) se společným technickým zařízením 
povinně kontrolovat platnost TLS certifikátu serveru, zda byl vystaven důvěryhodnou autoritou a 
zda se shoduje jméno, na které byl vydán, s adresou společného technického zařízení. 
Autentizace klienta TLS (tedy pokladního zařízení) není v rámci navázání TLS spojení požadována. 
5.2 PODPIS DATOVÝCH ZPRÁV EVIDOVANÝCH TRŽEB 
Každá datová zpráva evidované tržby musí být povinně podepsána klíčem, k němuž je vydán X509 
certifikát poplatníka. Certifikát poplatníka musí být platný k okamžiku zpracování datové zprávy 
evidované tržby na straně společného technického zařízení správce daně. 
Do elektronického podpisu SOAP zprávy musí být zahrnut právě jeden element, a to element 
<soap:Body> obsahující XML strukturu e-tržby (element <tns:Trzba>) sestavený dle platného XML 
schéma (XSD). Elektronický podpis musí být realizován dle standardu XML Signature Syntax and 
Processing (Second Edition) https://www.w3.org/TR/xmldsig-core2/ s následujícími požadavky: 
 
• 
Pro realizaci elektronického podpisu zprávy je využito standardu WS-Security a XML 
Digital Signature 
• 
Vlastní digitální podpis musí být vložen do SOAP obálky datové zprávy, a to v sekci 
hlaviček WS-Security. Odkaz na podepisovaný objekt (element <soap:Body>) je 
realizován referencí s využitím relativního odkazu v rámci SOAP zprávy. 
• 
Je požadován algoritmus „Exclusive C14N“ kanonizace podepisovaného objektu 
(Exclusive XML Canonicalization Version 1.0, https://www.w3.org/TR/xml-exc-c14n/, 
identifikátor "http://www.w3.org/2001/10/xml-exc-c14n#") 
• 
Pro výpočet otisku (digest) podepisovaného objektu (element <soap:Body>) pro 
elektronický podpis SOAP zprávy je požadován hashovací algoritmus SHA256 
(https://www.w3.org/TR/xmlenc-core/#sec-SHA256, identifikátor 
"http://www.w3.org/2001/04/xmlenc#sha256") 
• 
Pro elektronický podpis SOAP zprávy je požadován algoritmus RSA-SHA256 (identifikátor 
"http://www.w3.org/2001/04/xmldsig-more#rsa-sha256") 
 
• 
X509 certifikát náležející k privátnímu klíči použitému pro realizaci elektronického 
podpisu datové zprávy evidované tržby včetně SOAP obálky musí být přiložen v elementu 

--- PAGE 37 ---
Elektronická evidence tržeb 2.0 – Popis datového rozhraní 
25.08.2026 
 
37//37 
BinarySecurityToken v rámci sekce WS-Security hlavičky SOAP zprávy (typ 
"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-
1.0#Base64Binary") ve formátu X509v3 (typ "http://docs.oasis-
open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"). 
Z digitálního podpisu je tento certifikát referencován standardními prostředky. 
Datová zpráva by neměla obsahovat další hlavičky (jako např. Timestamp a WS-Addressing) a 
neměly by být podepisovány jiné elementy než <soap:Body>. V opačném případě roste velikost 
datové zprávy a takové zprávy by mohly být považovány za útok a následně odmítány. 
Příklad očekávané struktury datové zprávy je zachycen na následujícím obrázku: 
 
 
5.3 ELEKTRONICKÝ PODPIS POTVRZOVACÍCH DATOVÝCH ZPRÁV 
Potvrzovací datové zprávy ve formátu SOAP jsou opatřeny elektronickým podpisem společného 
technického zařízení správce daně. 
5.4 POMOCNÉ TECHNICKÉ INFORMACE PRO TRASOVÁNÍ 
Společné technické zařízení bude v odpovědích protokolu HTTP (potvrzovací datová zpráva, 
chybová datová zpráva, některé technické chyby) uvádět následující HTTP hlavičku: 
X-Global-Transaction-Id: XXXX 
jejíž hodnota XXXX bude unikátní pro každou zpracovávanou transakci a bude využitelná zejména 
v případech, kdy bude potřeba dohledat technické chyby či jiné chyby ve zpracování. Je vhodné, 
aby výrobci pokladního zařízení měli možnost tuto hodnotu logovat nebo uložit a použít ji, pokud 
se budou dohledávat příčiny konkrétního nekorektního chování. 
Využití této položky se předpokládá zejména v případě neprodukčního prostředí (playground), při 
případném řešení problémů komunikace. 
Hodnota XXXX je řetězec alfanumerických a interpunkčních znaků. Typická délka je méně než 32 
znaků, maximálně 64 znaků. 
