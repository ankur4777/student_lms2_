from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .services import (
    CurrencyServiceError,
    convert_amount,
    get_client_ip,
    get_currency_context,
    is_public_ip,
)


class CurrencyServiceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    def test_public_ip_detection(self):
        self.assertTrue(is_public_ip("8.8.8.8"))
        self.assertTrue(is_public_ip("2001:4860:4860::8888"))
        self.assertFalse(is_public_ip("127.0.0.1"))
        self.assertFalse(is_public_ip("10.0.0.5"))
        self.assertFalse(is_public_ip("not-an-ip"))

    def test_client_ip_uses_remote_addr_by_default(self):
        request = self.client.get("/api/currency/").wsgi_request
        request.META["REMOTE_ADDR"] = "8.8.8.8"
        request.META["HTTP_X_FORWARDED_FOR"] = "1.1.1.1"
        self.assertEqual(get_client_ip(request), "8.8.8.8")

    @override_settings(CURRENCY_TRUST_PROXY_HEADERS=True)
    def test_client_ip_can_use_cloudflare_header_when_trusted(self):
        request = self.client.get("/api/currency/").wsgi_request
        request.META["REMOTE_ADDR"] = "10.0.0.10"
        request.META["HTTP_CF_CONNECTING_IP"] = "8.8.8.8"
        self.assertEqual(get_client_ip(request), "8.8.8.8")

    def test_convert_amount_rounds_to_two_decimal_places(self):
        self.assertEqual(
            convert_amount("20000", Decimal("0.01125")),
            Decimal("225.00"),
        )

    def test_context_falls_back_to_base_currency_for_private_ip(self):
        request = self.client.get("/api/currency/").wsgi_request

        with patch("currency.services.get_exchange_rates") as rates:
            context = get_currency_context(request)
            rates.assert_not_called()

        self.assertEqual(context["currency"], "INR")
        self.assertEqual(context["rate"], Decimal("1"))
        self.assertEqual(context["source"], "fallback")

    @patch("currency.services._http_get_json")
    def test_context_uses_ip_currency_and_exchange_rate(self, http_get):
        http_get.side_effect = [
            {
                "country_code": "US",
                "country_name": "United States",
                "currency": "USD",
            },
            {
                "result": "success",
                "base_code": "INR",
                "time_last_update_utc": "Sat, 26 Sep 2026 00:00:00 +0000",
                "time_next_update_utc": "Sun, 27 Sep 2026 00:00:00 +0000",
                "rates": {"INR": 1, "USD": 0.01125},
            },
        ]
        request = self.client.get("/api/currency/").wsgi_request

        context = get_currency_context(request, override_ip="8.8.8.8")

        self.assertEqual(context["country_code"], "US")
        self.assertEqual(context["currency"], "USD")
        self.assertEqual(context["currency_symbol"], "$")
        self.assertEqual(context["rate"], Decimal("0.01125"))
        self.assertEqual(context["source"], "ip")
        self.assertEqual(http_get.call_count, 2)

    @patch("currency.services._http_get_json")
    def test_invalid_exchange_response_raises_service_error(self, http_get):
        http_get.side_effect = [
            {
                "country_code": "GB",
                "country_name": "United Kingdom",
                "currency": "GBP",
            },
            {"result": "error", "error-type": "quota-reached"},
        ]
        request = self.client.get("/api/currency/").wsgi_request

        with self.assertRaises(CurrencyServiceError):
            get_currency_context(request, override_ip="8.8.8.8")

    @override_settings(DEBUG=True)
    @patch("currency.services._http_get_json")
    def test_currency_api_returns_conversion_for_debug_ip_override(self, http_get):
        http_get.side_effect = [
            {
                "country_code": "GB",
                "country_name": "United Kingdom",
                "currency": "GBP",
            },
            {
                "result": "success",
                "base_code": "INR",
                "rates": {"INR": 1, "GBP": 0.0095},
            },
        ]

        response = self.client.get(
            "/api/currency/",
            {"ip": "1.1.1.1", "amount": "20000"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["country_code"], "GB")
        self.assertEqual(response.data["currency"], "GBP")
        self.assertEqual(response.data["converted_amount"], "190.00")
        self.assertEqual(response.data["rate"], "0.0095")
