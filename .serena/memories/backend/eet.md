# EET 2.0 Fiscalization Engine

Czech Republic EET 2.0 fiscal signing and SOAP communication services in `/backend/services`.

## Components
- [eet_crypto.py](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_crypto.py): 
  - PKCS#12 (`.p12`) certificate parsing via `cryptography`.
  - RSA-SHA256 PKP (Podpisový Kód Poplatníka) signature generation.
  - SHA-1 BKP (Bezpečnostní Kód Poplatníka) formatted hex code generation.
- [eet_soap.py](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_soap.py): 
  - WS-Security 1.0 SOAP envelope builder.
  - Dispatcher to Finanční správa ČR (Playground: `https://pg.eet.cz/eet/services/EETServiceSOAP/v3`, Production: `https://prod.eet.cz/eet/services/EETServiceSOAP/v3`).
  - Handles FIK (Fiskální Identifikační Kód) responses and fault handling.
- [eet_service.py](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_service.py): High-level orchestrator; stores transaction status (`EVD_OK`, `OFFLINE_PENDING`, `REJECTED`).
- [eet_resend_daemon.py](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_resend_daemon.py): 
  - Background daemon thread running every 60 seconds auto-flushing offline pending sales.
  - Generates audit trails in `eet_audit_logs`.

## Hardening & Security Features
- **Fernet AES-256 Password Encryption**: Certificate passwords encrypted at rest using machine key stored in `backend/.secret_key` with `0o600` restricted permissions.
- **Audit Logging API**: Endpoints `/api/v1/eet/audit-logs`, `/api/v1/eet/offline-queue`, `/api/v1/eet/force-resend`.
- **Receipt Legal Formatting**:
  - Online sales print `FIK` + `BKP`.
  - Offline pending sales print `PKP` + `BKP` + notice `Vystaveno ve zjednodušeném (neonline) režimu EET`.

## Related Memories
- Sales database storage: `mem:database`
