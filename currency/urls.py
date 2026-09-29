from django.urls import path

from .views import CurrencyContextAPIView


urlpatterns = [
    path("", CurrencyContextAPIView.as_view(), name="currency-context"),
]
