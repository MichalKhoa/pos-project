import logging
from typing import Dict, Any

logger = logging.getLogger("pos-qr-bank")


class CzechBankQRPaymentService:
    """
    Service template for verifying incoming Czech QR Bank Payments.
    Compatible with Fio Bank API, ČSOB, KB, Air Bank, or payment gateway webhooks.
    """

    def __init__(self, api_token: str = "", account_iban: str = ""):
        self.api_token = api_token
        self.account_iban = account_iban

    def generate_qr_string(
        self,
        amount: float,
        variable_symbol: str = "",
        message: str = "Nákup v obchodu",
        constant_symbol: str = "0008",
        specific_symbol: str = "",
        recipient_name: str = ""
    ) -> str:
        """
        Generates official Czech Banking Association (ČBA) Short Payment Descriptor (SPD v1.0).
        Format spec: SPD*1.0*ACC:CZ...*AM:...*CC:CZK*X-VS:...*X-KS:...*MSG:...*RN:...
        """
        clean_iban = (self.account_iban.replace(" ", "").upper()) if self.account_iban else "CZ6508000000001234567890"
        parts = ["SPD", "1.0", f"ACC:{clean_iban}", f"AM:{amount:.2f}", "CC:CZK"]

        if variable_symbol:
            parts.append(f"X-VS:{variable_symbol[:10]}")
        if constant_symbol:
            parts.append(f"X-KS:{constant_symbol[:4]}")
        if specific_symbol:
            parts.append(f"X-SS:{specific_symbol[:10]}")
        if message:
            parts.append(f"MSG:{message[:60]}")
        if recipient_name:
            parts.append(f"RN:{recipient_name[:35]}")

        return "*".join(parts)

    def check_payment_status(self, variable_symbol: str, expected_amount: float) -> Dict[str, Any]:
        """
        Checks if the bank account has received a transaction matching the variable symbol and amount.
        Checks real-time payment cache populated by bank email listener or webhooks.
        """
        logger.info(f"Checking QR payment arrival for VS: {variable_symbol}, Amount: {expected_amount} CZK")

        try:
            from services.email_payment_listener import payment_cache
            cached = payment_cache.get_payment(variable_symbol)
            if cached and cached.get("amount", 0) >= expected_amount:
                logger.info(f"🎉 QR Payment Verified via Email Listener! VS: {variable_symbol}, Amount: {cached['amount']} CZK")
                return {
                    "status": "PAID",
                    "variable_symbol": variable_symbol,
                    "expected_amount": expected_amount,
                    "received_amount": cached["amount"],
                    "message": "Platba úspěšně ověřena a přijata!"
                }
        except Exception as e:
            logger.warning(f"Error checking email payment cache: {e}")

        # Return pending status if not yet received
        return {
            "status": "PENDING", # Options: 'PENDING', 'PAID', 'EXPIRED', 'FAILED'
            "variable_symbol": variable_symbol,
            "expected_amount": expected_amount,
            "received_amount": 0.0,
            "message": "Čeká se na provedení okamžité platby zákazníkem..."
        }
