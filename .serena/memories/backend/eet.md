# EET 2.0 Fiscalization Engine

Czech Republic EET 2.0 fiscal signing and SOAP communication services in `/backend/services`.

## Components
- [eet_crypto.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/eet_crypto.py): 
  - PKCS#12 (`.p12`) certificate parsing via `OpenSSL.crypto` / `cryptography`.
  - RSA-SHA256 PKP (Podpisový Kód Poplatníka) signature generation.
  - SHA-1 BKP (Bezpečnostní Kód Poplatníka) formatted hex code generation.
- [eet_soap.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/eet_soap.py): 
  - WS-Security 1.0 SOAP envelope builder.
  - Dispatcher to Finanční správa ČR (Playground: `https://pg.eet.cz/eet/services/EETServiceSOAP/v3`, Production: `https://prod.eet.cz/eet/services/EETServiceSOAP/v3`).
  - Handles FIK (Fiskální Identifikační Kód) responses and fault handling.
- [eet_service.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/eet_service.py): High-level orchestrator; stores transaction status (`COMPLETED_ONLINE`, `OFFLINE_PENDING`, `REJECTED`).

## Invariants & Offline Resilience
- Certificates reside in `backend/certs/`.
- If Finanční správa servers are unreachable or request times out, sale is marked `OFFLINE_PENDING` with valid PKP/BKP codes allowing postponed submission via `/api/v1/sales/{id}/resend-eet`.

## Related Memories
- Sales database storage: `mem:database`