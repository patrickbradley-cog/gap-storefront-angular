/**
 * Server-side pricing — the authoritative copy of the rules that the
 * frontend PricingService mirrors. Keep them in sync.
 */

export const FRIENDS_FAMILY_RATE = 0.4;
export const FREE_SHIPPING_THRESHOLD = 50;
export const FLAT_SHIPPING = 7;
export const TAX_RATE = 0.085;

const PROMO_CODES: Record<string, number> = {
  EXTRA10: 0.1,
  GAPMORE: 0.15,
};

export interface CatalogColorway {
  ccId: string;
  effectivePrice: string | number | null;
  flag: string | null;
}

export interface CatalogProduct {
  id: string;
  price: number;
  promo: string;
  colors: CatalogColorway[];
  sizes: string[];
}

/** Friends & Family applies only to colourways flagged "... at checkout". */
export function isPromoEligible(flag: string | null | undefined): boolean {
  return /\bat checkout\b/i.test(flag || '');
}

/** The colourway's own selling price, or null if it is missing/invalid. */
export function colorwayPrice(colorway: CatalogColorway): number | null {
  const price =
    typeof colorway.effectivePrice === 'number'
      ? colorway.effectivePrice
      : parseFloat(String(colorway.effectivePrice ?? ''));
  return Number.isFinite(price) && price > 0 ? price : null;
}

export interface RequestLine {
  productId: string;
  ccId: string;
  size: string;
  qty: number;
}

export interface PriceQuote {
  subtotal: number;
  markdown: number;
  promoCode: string | null;
  promoDiscount: number;
  promoError: string | null;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
}

const money = (n: number): number => Math.round(n * 100) / 100;

export function priceBag(
  lines: RequestLine[],
  catalog: Map<string, CatalogProduct>,
  promoCode?: string | null,
): { quote: PriceQuote; errors: string[] } {
  const MAX_LINES = 200;
  const errors: string[] = [];
  if (lines.length > MAX_LINES) {
    errors.push(`Bag exceeds maximum of ${MAX_LINES} lines`);
  }
  let subtotal = 0;
  let markdown = 0;
  let itemCount = 0;

  for (const line of lines.slice(0, MAX_LINES)) {
    const qty = Math.floor(Number(line.qty));
    const product = catalog.get(String(line.productId));
    if (!product) {
      errors.push(`Unknown product ${line.productId}`);
      continue;
    }
    if (!Number.isFinite(qty) || qty < 1 || qty > 9) {
      errors.push(`Invalid qty for ${product.id}`);
      continue;
    }
    const colorway = product.colors.find((c) => c.ccId === line.ccId);
    if (!colorway) {
      errors.push(`Unknown colour ${line.ccId} for ${product.id}`);
      continue;
    }
    const price = colorwayPrice(colorway);
    if (price === null) {
      errors.push(`No price for colour ${line.ccId} of ${product.id}`);
      continue;
    }
    if (!product.sizes.includes(line.size)) {
      errors.push(`Unknown size ${line.size} for ${product.id}`);
      continue;
    }
    subtotal += price * qty;
    if (isPromoEligible(colorway.flag)) {
      markdown += price * FRIENDS_FAMILY_RATE * qty;
    }
    itemCount += qty;
  }

  subtotal = money(subtotal);
  markdown = money(markdown);

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
  const shipping = subtotal === 0 || afterDiscounts >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const tax = money(Math.max(afterDiscounts, 0) * TAX_RATE);
  const total = money(Math.max(afterDiscounts, 0) + shipping + tax);

  return {
    quote: {
      subtotal,
      markdown,
      promoCode: code || null,
      promoDiscount,
      promoError,
      shipping,
      tax,
      total,
      itemCount,
    },
    errors,
  };
}
