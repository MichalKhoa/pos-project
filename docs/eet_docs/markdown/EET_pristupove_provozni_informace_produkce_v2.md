--- PAGE 1 ---
Elektronická evidence tržeb 2.0 
Produkční prostředí 
Přístupové a provozní informace 
Verze: 1.1  
Datum poslední verze dokumentu: 10.7. 2026 
Vymezení obsahu dokumentu 
Dokument obsahuje doplňující informace provozního charakteru k informacím zveřejněným 
v dokumentu „Formát a struktura údajů o evidované tržbě“. Dokument obsahuje informace 
potřebné pro použití produkčního prostředí EET 2.0, informace o použitých certifikátech a 
další důležité provozní informace. 
 

--- PAGE 2 ---
HISTORIE ZMĚN DOKUMENTU 
Přehled změn dokumentu 
Verze 
Datum 
Popis 
1.0  
2. 6. 2026 
První pracovní verze dokumentu pro EET 2.0. 
Předpokládané spuštění produkčního prostředí pro 
veřejnost: do 1. 1. 2027. 
1.1 
10.7.2026 
Úprava kapitoly 3.1 – odstranění limitu certifikátů 
Úprava kapitoly 3.3 – změna vydávající autority 
Úprava kapitoly 4.1 – doplnění okna pro údržbu a 
změna minimálního data a času přijetí tržby 
 

--- PAGE 3 ---
Obsah 
Vymezení obsahu dokumentu .............................................................................................. 1 
HISTORIE ZMĚN DOKUMENTU ............................................................................................. 2 
Přehled změn dokumentu .................................................................................................... 2 
Obsah ...................................................................................................................................... 3 
1 ÚVODNÍ INFORMACE ......................................................................................................... 4 
1.1 VAZBA NA DOKUMENT „FORMÁT A STRUKTURA …“ .............................................. 4 
1.2 PŘEHLED ZKRATEK ..................................................................................................... 4 
1.3 PŘEHLED ZÁKLADNÍCH POJMŮ ................................................................................. 4 
2 PŘÍSTUPOVÉ INFORMACE PRODUKČNÍHO PROSTŘEDÍ .............................................. 5 
2.1 URL A DNS JMÉNO ....................................................................................................... 5 
2.2 IMPLEMENTOVANÁ VERZE ROZHRANÍ ..................................................................... 5 
2.3 SOUBĚH VERZÍ ROZHRANÍ ......................................................................................... 5 
3 CERTIFIKÁTY PRODUKČNÍHO PROSTŘEDÍ ..................................................................... 6 
3.1 CERTIFIKÁTY POPLATNÍKA – EET CA 2 .................................................................... 6 
3.1.1 Hierarchie certifikační autority ................................................................................. 6 
3.1.2 Profil pokladního certifikátu ...................................................................................... 6 
3.1.3 CRL distribuční body ............................................................................................... 6 
3.2 SSL CERTIFIKÁT ........................................................................................................... 6 
3.3 PODPISOVÝ CERTIFIKÁT ............................................................................................ 7 
4 PROVOZNÍ PARAMETRY PRODUKČNÍHO PROSTŘEDÍ .................................................. 8 
4.1 PROVOZNÍ DOBA ......................................................................................................... 8 
4.2 PODPORA ..................................................................................................................... 8 
 
 

--- PAGE 4 ---
1 ÚVODNÍ INFORMACE 
1.1 VAZBA NA DOKUMENT „FORMÁT A STRUKTURA …“ 
Tento dokument obsahuje doplňující informace provozního charakteru k informacím 
zveřejněným v dokumentu „Formát a struktura údajů o evidované tržbě a popis datového 
rozhraní pro příjem datových zpráv evidovaných tržeb“. Tento dokument používá zkratky a 
pojmy definované v dokumentu „Formát a struktura údajů o evidované tržbě a popis 
datového rozhraní pro příjem datových zpráv evidovaných tržeb“ a dále doplňující zkratky a 
pojmy uvedené v této kapitole. 
Tento dokument se vztahuje vždy k aktuální zveřejněné verzi dokumentu „Formát a struktura 
údajů o evidované tržbě a popis datového rozhraní pro příjem datových zpráv evidovaných 
tržeb“. V momentě zveřejnění tohoto dokumentu je aktuální verze 1 dokumentu „Formát a 
struktura údajů o evidované tržbě a popis datového rozhraní pro příjem datových zpráv 
evidovaných tržeb“. 
Produkční prostředí je určeno pro poplatníky EET a bude sloužit pro rutinní provoz, tj. 
především příjem a potvrzování datových zpráv s údaji o evidovaných tržbách. 
Informace o neprodukčním prostředí (playground), které slouží výhradně vývojářům softwaru 
pro pokladní zařízení, jsou uvedeny v samostatném dokumentu. 
1.2 PŘEHLED ZKRATEK 
Níže uvádíme definice doplňujících zkratek, které jsou používány v textu tohoto dokumentu. 
Zkratka 
Definice 
CA 
Certifikační autorita 
 
1.3 PŘEHLED ZÁKLADNÍCH POJMŮ 
Níže uvádíme definice doplňujících základních pojmů, které jsou používány v textu tohoto 
dokumentu. 
Pojem 
Definice 
Poplatník 
Povinný subjekt dle ZoET 
 

--- PAGE 5 ---
2 PŘÍSTUPOVÉ INFORMACE PRODUKČNÍHO PROSTŘEDÍ 
2.1 URL A DNS JMÉNO 
Produkční prostředí je přístupné na URL 
https://trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4 
resp. na URL odpovídajícím aktuální verzi rozhraní. 
Mechanismy vysoké dostupnosti produkčního prostředí využívají DNS balancování. DNS 
záznam vrací několik IP adres podle aktuální dostupnosti částí produkčního prostředí. 
Implementace pokladních zařízení musí používat DNS jméno a respektovat TTL DNS 
záznamů. Při navazování nových spojení musí pokladní zařízení vždy znovu pokládat dotaz 
na DNS záznam. 
2.2 IMPLEMENTOVANÁ VERZE ROZHRANÍ 
Implementovaná verze rozhraní aktuální k momentu zveřejnění tohoto dokumentu je verze 
4.1. 
Informace o nasazení a platnosti nových verzí rozhraní budou vždy zveřejněny na stránkách 
https://eet.gov.cz 
2.3 SOUBĚH VERZÍ ROZHRANÍ 
Souběh nové a předchozí verze rozhraní je na produkčním prostředí podporován pro 
zajištění podpory hladkého přechodu klientů na novou hlavní verzi rozhraní. To se týká verzí 
od 4.0 výš.  
 

--- PAGE 6 ---
3 CERTIFIKÁTY PRODUKČNÍHO PROSTŘEDÍ 
3.1 CERTIFIKÁTY POPLATNÍKA – EET CA 2 
Na produkčním prostředí jsou používány certifikáty produkční Certifikační autority EET. 
Obslužný portál CA EET je dostupný poplatníkům prostřednictvím portálu MOJE daně (v 
aplikaci Daňová informační schránka plus - DIS+). 
V souladu se ZoET může každý poplatník požádat o jeden nebo více pokladních certifikátů. 
Rozhodnutí o počtu certifikátů a jejich přiřazení pokladnám je plně v kompetenci poplatníka. 
3.1.1 Hierarchie certifikační autority 
Certifikační autorita má dvouúrovňovou hierarchii: 
• 
Kořenová CA (Root CA EET): EETv2 NCA Root CA RSA MM/RRRR (RSA 4096, 
platnost 10 let) 
• 
Vydavatel pokladních certifikátů (SubCA): EETv2 NCA SubCA RSA MM/RRRR 
(RSA 2048, platnost 4 roky) 
• 
Pokladní certifikát: RSA 2048, platnost 366 dnů 
3.1.2 Profil pokladního certifikátu 
• 
CN = EIČ poplatníka 
• 
description (volitelně) = poznámka zadaná poplatníkem, max. 64 znaků 
• 
C = CZ 
• 
KeyUsage (kritické) = digitalSignature, nonRepudiation 
• 
Politika (OID) = 1.2.203.19122063.10.1.102.x.y (PROD) 
3.1.3 CRL distribuční body 
CRL je dostupné na CRL distribučním bodě: 
• 
• https://caeet.gov.cz/crldp 
Frekvence vydávání CRL: každých 8 hodin, navíc okamžitě (do 1 minuty) po zneplatnění 
libovolného certifikátu. 
Platnost CRL: 24 hodin (pro CRL vydavatele pokladních certifikátů); 365 dnů (pro CRL 
kořenové CA, vydáváno každých 180 dnů). 
3.2 SSL CERTIFIKÁT 
Pro zabezpečení HTTPS spojení s produkčním prostředím je použit SSL certifikát od 
důvěryhodné komerční certifikační autority. 
Konkrétní vydavatel SSL certifikátu: Digicert 
Jde o SSL certifikát typu EV  
pro doménu trzbyeet.gov.cz. 
Použití protokolu HTTPS je povinné, bez autentizace klientskými certifikáty na úrovni TLS. 
Podporované verze protokolu TLS jsou TLS 1.2 a vyšší. 
Konkrétní SSL certifikát produkčního prostředí se může kdykoliv změnit, vždy ale budou 
zachovány bezpečnostní atributy (důvěryhodná CA, typ EV, produkční doména EET). Pro 
zajištění maximální ochrany dat evidovaných tržeb je doporučeno při navázání spojení 
kontrolovat tyto atributy SSL certifikátu. 
 

--- PAGE 7 ---
3.3 PODPISOVÝ CERTIFIKÁT 
Pro elektronický podpis potvrzovacích datových zpráv je použit certifikát vydaný autoritou: 
 
C = CZ 
2.5.4.97 = NTRCZ-26439395 
O = První certifikační autorita, a.s. 
CN = I.CA Public CA/RSA 06/2022 
 
Certifikáty autority I. CA jsou dostupné zde: https://www.ica.cz/korenove-certifikaty 
• CN: 100000002 a 100001063 
 

--- PAGE 8 ---
4 PROVOZNÍ PARAMETRY PRODUKČNÍHO PROSTŘEDÍ 
4.1 PROVOZNÍ DOBA 
Provozní doba produkčního prostředí je 24x7. Servisní okno pro údržbu je zpravidla každý 
čtvrtek mezi 20:00 a 6:00 hodin. 
Celková roční dostupnost produkčního prostředí je nastavena na úroveň 99,99 % s dobou 
vyřešení kritické závady do 4 hodin. 
Další informace o provozní době budou na informačním webu EET 2.0 https://eet.gov.cz. 
Vysoká dostupnost produkčního prostředí je zajištěna provozem ve dvou nezávislých 
geograficky oddělených datových centrech SPCSS v režimu Active-Active s globálním load 
balancingem a globálním DNS. 
Minimální datum a čas přijetí tržby na produkčním prostředí: 01.01.2027, 0:00 (před 
tímto datem v přechodném režimu od 01.11.2026). 
4.2 PODPORA 
Podpora provozu produkčního prostředí je poskytována prostřednictvím e-mailové adresy 
epodpora@fs.gov.cz, popř. kontaktního formuláře na stránkách https://eet.gov.cz.  
 
