"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const CURRENCY_TEST_IP = process.env.NEXT_PUBLIC_CURRENCY_TEST_IP;

export type CurrencyContext = {
  base_currency: string;
  currency: string;
  currency_symbol: string;
  rate: string;
  country_code: string | null;
  country_name: string | null;
  source: "ip" | "fallback" | string;
};

const FALLBACK_CONTEXT: CurrencyContext = {
  base_currency: "INR",
  currency: "INR",
  currency_symbol: "₹",
  rate: "1",
  country_code: null,
  country_name: null,
  source: "fallback",
};

export function useCurrency() {
  const [currencyContext, setCurrencyContext] =
    useState<CurrencyContext>(FALLBACK_CONTEXT);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrency() {
      try {
        const baseEndpoint = API_BASE
          ? `${API_BASE}/api/currency/`
          : "/api/currency/";

        const testIp =
          process.env.NODE_ENV !== "production"
            ? CURRENCY_TEST_IP?.trim()
            : undefined;

        const endpoint = testIp
          ? `${baseEndpoint}?ip=${encodeURIComponent(testIp)}`
          : baseEndpoint;

        const response = await fetch(endpoint, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as Partial<CurrencyContext>;
        const rate = Number(data.rate);

        if (
          !data.currency ||
          !data.currency_symbol ||
          !Number.isFinite(rate) ||
          rate <= 0
        ) {
          return;
        }

        if (!cancelled) {
          setCurrencyContext({
            base_currency: data.base_currency || "INR",
            currency: data.currency,
            currency_symbol: data.currency_symbol,
            rate: String(data.rate),
            country_code: data.country_code || null,
            country_name: data.country_name || null,
            source: data.source || "fallback",
          });
        }
      } catch {
        // Keep INR fallback when IP/currency lookup is temporarily unavailable.
      }
    }

    void loadCurrency();

    return () => {
      cancelled = true;
    };
  }, []);

  const formatCurrency = useCallback(
    (value: number | string) => {
      const baseAmount = Number(value || 0);
      const rate = Number(currencyContext.rate || 1);
      const convertedAmount =
        (Number.isFinite(baseAmount) ? baseAmount : 0) *
        (Number.isFinite(rate) && rate > 0 ? rate : 1);

      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: currencyContext.currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(convertedAmount);
      } catch {
        return `${currencyContext.currency_symbol}${convertedAmount.toLocaleString(
          undefined,
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )}`;
      }
    },
    [currencyContext],
  );

  return {
    ...currencyContext,
    formatCurrency,
  };
}
