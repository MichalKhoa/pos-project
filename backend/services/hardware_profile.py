import logging
from dataclasses import dataclass
from typing import Optional

try:
    import psutil
except ImportError:
    psutil = None

logger = logging.getLogger("pos-hardware-profile")


@dataclass
class HardwareProfile:
    tier: int
    ram_gb: float
    sqlite_cache_size: int  # negative for KiB
    mmap_size: int  # bytes
    lru_receipt_cache_size: int
    prewarm_months: int


_cached_profile: Optional[HardwareProfile] = None


def get_hardware_profile(force_refresh: bool = False) -> HardwareProfile:
    """Detect total system RAM and return hardware-tuned profile.

    Results are cached in a module-level variable to avoid repeated psutil calls.
    """
    global _cached_profile
    if _cached_profile is not None and not force_refresh:
        return _cached_profile

    try:
        if psutil is None:
            raise RuntimeError("psutil is not installed")

        total_bytes = psutil.virtual_memory().total
        ram_gb = round(total_bytes / (1024 ** 3), 2)

        if ram_gb < 6.0:
            profile = HardwareProfile(
                tier=1,
                ram_gb=ram_gb,
                sqlite_cache_size=-16384,
                mmap_size=67108864,
                lru_receipt_cache_size=200,
                prewarm_months=6,
            )
        elif ram_gb <= 16.0:
            profile = HardwareProfile(
                tier=2,
                ram_gb=ram_gb,
                sqlite_cache_size=-65536,
                mmap_size=268435456,
                lru_receipt_cache_size=1000,
                prewarm_months=12,
            )
        else:
            profile = HardwareProfile(
                tier=3,
                ram_gb=ram_gb,
                sqlite_cache_size=-131072,
                mmap_size=536870912,
                lru_receipt_cache_size=2500,
                prewarm_months=36,
            )
    except Exception as e:
        logger.warning(f"Could not determine hardware profile via psutil: {e}. Defaulting to Tier 2.")
        profile = HardwareProfile(
            tier=2,
            ram_gb=8.0,
            sqlite_cache_size=-65536,
            mmap_size=268435456,
            lru_receipt_cache_size=1000,
            prewarm_months=12,
        )

    _cached_profile = profile
    return _cached_profile
