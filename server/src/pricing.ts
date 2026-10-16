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

export interface CatalogProduct {
  id: string;
  price: number;
  promo: string;
  colors: Array<{ ccId: string }>;
  sizes: string[];
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
  const errors: string[] = [];
  let subtotal = 0;
  let markdown = 0;
  let itemCount = 0;

  for (const line of lines) {
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
    if (!product.colors.some((c) => c.ccId === line.ccId)) {
      errors.push(`Unknown colour ${line.ccId} for ${product.id}`);
      continue;
    }
    if (!product.sizes.includes(line.size)) {
      errors.push(`Unknown size ${line.size} for ${product.id}`);
      continue;
    }
    subtotal += product.price * qty;
    if (product.promo) {
      markdown += product.price * FRIENDS_FAMILY_RATE * qty;
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
