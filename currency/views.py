from decimal import Decimal, InvalidOperation

from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import CurrencyServiceError, convert_amount, get_currency_context


class CurrencyContextAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        override_ip = None
        if settings.DEBUG:
            override_ip = request.query_params.get("ip", "").strip() or None

        try:
            context = get_currency_context(request, override_ip=override_ip)
        except CurrencyServiceError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "base_currency": "INR",
                },
                status=503,
            )

        response = {
            "base_currency": context["base_currency"],
            "currency": context["currency"],
            "currency_symbol": context["currency_symbol"],
            "rate": str(context["rate"]),
            "country_code": context["country_code"],
            "country_name": context["country_name"],
            "source": context["source"],
            "rate_last_update_utc": context["rate_last_update_utc"],
            "rate_next_update_utc": context["rate_next_update_utc"],
        }

        amount = request.query_params.get("amount")
        if amount is not None:
            try:
                parsed_amount = Decimal(amount)
            except (InvalidOperation, TypeError, ValueError):
                return Response(
                    {"detail": "Amount must be a valid number."},
                    status=400,
                )

            try:
                converted = convert_amount(parsed_amount, context["rate"])
            except CurrencyServiceError as exc:
                return Response({"detail": str(exc)}, status=400)

            response["amount"] = str(parsed_amount)
            response["converted_amount"] = str(converted)

        return Response(response)
