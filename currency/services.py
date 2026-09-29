from __future__ import annotations

import hashlib
import ipaddress
import json
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache


class CurrencyServiceError(Exception):
    """Raised when currency detection or exchange-rate lookup fails."""


CURRENCY_SYMBOLS = {
    "AED": "د.إ",
    "AUD": "A$",
    "CAD": "C$",
    "CHF": "CHF",
    "CNY": "¥",
    "EUR": "€",
    "GBP": "£",
    "HKD": "HK$",
    "INR": "₹",
    "JPY": "¥",
    "KRW": "₩",
    "MYR": "RM",
    "NZD": "NZ$",
    "SGD": "S$",
    "USD": "$",
    "ZAR": "R",
}


def _setting(name: str, default: Any) -> Any:
    return getattr(settings, name, default)


def _cache_key(prefix: str, value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"currency:{prefix}:{digest}"


def _http_get_json(url: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Student-LMS-Currency/1.0",
        },
        method="GET",
    )
    timeout = float(_setting("CURRENCY_HTTP_TIMEOUT", 5))
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
        raise CurrencyServiceError("Currency provider request failed.") from exc
    if not isinstance(payload, dict):
        raise CurrencyServiceError("Currency provider returned an invalid response.")
    return payload


def get_client_ip(request) -> str | None:
    """Use proxy headers only when the deployment explicitly trusts them."""
    if bool(_setting("CURRENCY_TRUST_PROXY_HEADERS", False)):
        cloudflare_ip = request.META.get("HTTP_CF_CONNECTING_IP", "").strip()
        if cloudflare_ip:
            return cloudflare_ip

        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "").strip()
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

    remote_addr = request.META.get("REMOTE_ADDR", "").strip()
    return remote_addr or None


def _parse_ip(value: str | None) -> ipaddress._BaseAddress | None:
    if not value:
        return None
    try:
        return ipaddress.ip_address(value.strip())
    except ValueError:
        return None


def is_public_ip(value: str | None) -> bool:
    address = _parse_ip(value)
    return bool(address and address.is_global)


def _validate_currency_code(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    code = value.strip().upper()
    if len(code) != 3 or not code.isalpha():
        return None
    return code


def get_ip_location(ip_address: str) -> dict[str, Any]:
    if not is_public_ip(ip_address):
        raise CurrencyServiceError("A public IP address is required for IP geolocation.")

    cache_key = _cache_key("ip", ip_address)
    cached = cache.get(cache_key)
    if cached:
        return cached

    template = _setting(
        "CURRENCY_IP_LOOKUP_URL",
        "https://ipapi.co/{ip}/json/",
    )
    payload = _http_get_json(template.format(ip=ip_address))

    currency = _validate_currency_code(payload.get("currency"))
    country_code = str(
        payload.get("country_code") or payload.get("country") or ""
    ).strip().upper() or None
    country_name = str(payload.get("country_name") or "").strip() or None

    if not currency:
        raise CurrencyServiceError("IP geolocation did not return a valid currency.")

    result = {
        "country_code": country_code,
        "country_name": country_name,
        "currency": currency,
    }
    cache.set(
        cache_key,
        result,
        timeout=int(_setting("CURRENCY_IP_CACHE_TTL", 86400)),
    )
    return result


def get_exchange_rates(base_currency: str) -> dict[str, Any]:
    base = _validate_currency_code(base_currency)
    if not base:
        raise CurrencyServiceError("Invalid base currency.")

    cache_key = _cache_key("rates", base)
    cached = cache.get(cache_key)
    if cached:
        return cached

    template = _setting(
        "CURRENCY_RATES_URL",
        "https://open.er-api.com/v6/latest/{base}",
    )
    payload = _http_get_json(template.format(base=base))

    if payload.get("result") != "success":
        raise CurrencyServiceError("Exchange-rate provider returned an error.")

    rates = payload.get("rates")
    if not isinstance(rates, dict):
        raise CurrencyServiceError("Exchange-rate provider returned invalid rates.")

    result = {
        "base_code": str(payload.get("base_code") or base).upper(),
        "rates": rates,
        "last_update_utc": payload.get("time_last_update_utc"),
        "next_update_utc": payload.get("time_next_update_utc"),
    }
    cache.set(
        cache_key,
        result,
        timeout=int(_setting("CURRENCY_RATE_CACHE_TTL", 86400)),
    )
    return result


def get_currency_context(request, override_ip: str | None = None) -> dict[str, Any]:
    base_currency = _validate_currency_code(
        _setting("CURRENCY_BASE_CODE", "INR")
    ) or "INR"
    default_currency = _validate_currency_code(
        _setting("CURRENCY_DEFAULT_CODE", base_currency)
    ) or base_currency

    client_ip = override_ip or get_client_ip(request)
    location = None
    source = "ip"

    if client_ip and is_public_ip(client_ip):
        try:
            location = get_ip_location(client_ip)
        except CurrencyServiceError:
            source = "fallback"
    else:
        source = "fallback"

    detected_currency = location["currency"] if location else default_currency
    country_code = location["country_code"] if location else None
    country_name = location["country_name"] if location else None

    if detected_currency == base_currency:
        rate = Decimal("1")
        rate_data = {"last_update_utc": None, "next_update_utc": None}
    else:
        rates = get_exchange_rates(base_currency)
        raw_rate = rates["rates"].get(detected_currency)

        if raw_rate is None:
            detected_currency = default_currency
            if detected_currency == base_currency:
                rate = Decimal("1")
                rate_data = {"last_update_utc": None, "next_update_utc": None}
            else:
                raw_rate = rates["rates"].get(detected_currency)
                if raw_rate is None:
                    raise CurrencyServiceError(
                        "No exchange rate is available for the detected currency."
                    )
                rate = Decimal(str(raw_rate))
                rate_data = rates
        else:
            rate = Decimal(str(raw_rate))
            rate_data = rates

    if rate <= 0:
        raise CurrencyServiceError("Exchange rate must be greater than zero.")

    return {
        "base_currency": base_currency,
        "currency": detected_currency,
        "currency_symbol": CURRENCY_SYMBOLS.get(
            detected_currency, detected_currency
        ),
        "rate": rate,
        "country_code": country_code,
        "country_name": country_name,
        "source": source,
        "rate_last_update_utc": rate_data.get("last_update_utc"),
        "rate_next_update_utc": rate_data.get("next_update_utc"),
    }


def convert_amount(amount: Any, rate: Decimal) -> Decimal:
    try:
        value = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise CurrencyServiceError("Invalid amount.") from exc

    if value < 0:
        raise CurrencyServiceError("Amount cannot be negative.")

    return (value * rate).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
