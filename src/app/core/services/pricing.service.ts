import { Injectable } from '@angular/core';
import { BagLine, PriceQuote } from '../models';

export const FRIENDS_FAMILY_RATE = 0.4;
export const FREE_SHIPPING_THRESHOLD = 50;
export const FLAT_SHIPPING = 7;
export const TAX_RATE = 0.085;

const PROMO_CODES: Record<string, number> = {
  EXTRA10: 0.1,
  GAPMORE: 0.15,
};

const money = (n: number) => Math.round(n * 100) / 100;

/** Friends & Family applies only to colourways flagged "... at checkout". */
export function isPromoEligible(flag: string | null | undefined): boolean {
  return /\bat checkout\b/i.test(flag || '');
}

/**
 * Pure pricing rules — mirrors /api/bag/price on the server so the UI can
 * render instantly and still be verified against the HTTP boundary.
 *
 * "Friends & Family 40% off" is a checkout-time markdown: prices shown on
 * PDP/PLP are list prices, the 40% is applied to promo-eligible lines here.
 * Lines are priced at the colourway's effectivePrice; eligibility comes from
 * the colourway's own flag (see isPromoEligible).
 */
@Injectable({ providedIn: 'root' })
export class PricingService {
  quote(lines: BagLine[], promoCode?: string | null): PriceQuote {
    const subtotal = money(lines.reduce((s, l) => s + l.price * l.qty, 0));
    const markdown = money(
      lines.reduce((s, l) => s + (l.promoEligible ? l.price * FRIENDS_FAMILY_RATE : 0) * l.qty, 0),
    );

    const code = (promoCode || '').trim().toUpperCase();
    let promoDiscount = 0;
    let promoError: string | null = null;
    if (code) {
      const rate = PROMO_CODES[code];
      if (rate) {
        promoDiscount = money(subtotal * rate);
      } else {
        promoError = `Promo code "${code}" is not valid.`;
      }
    }

    const afterDiscounts = money(subtotal - markdown - promoDiscount);
    const shipping =
      subtotal === 0 || afterDiscounts >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    const tax = money(Math.max(afterDiscounts, 0) * TAX_RATE);
    const total = money(Math.max(afterDiscounts, 0) + shipping + tax);

    return {
      subtotal,
      markdown,
      promoCode: code || null,
      promoDiscount,
      promoError,
      shipping,
      tax,
      total,
      itemCount: lines.reduce((s, l) => s + l.qty, 0),
    };
  }
}
