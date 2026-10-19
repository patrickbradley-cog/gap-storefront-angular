import { PricingService, isPromoEligible } from './pricing.service';
import { makeLine } from '../../testing/fixtures';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => (service = new PricingService()));

  it('computes subtotal across lines and quantities', () => {
    const q = service.quote([makeLine({ qty: 2 }), makeLine({ key: 'b', price: 20, qty: 1 })]);
    expect(q.subtotal).toBeCloseTo(179.9, 2);
    expect(q.itemCount).toBe(3);
  });

  it('applies Friends & Family 40% markdown only to promo-eligible lines', () => {
    const q = service.quote([
      makeLine({ price: 100, qty: 1, promoEligible: true }),
      makeLine({ key: 'b', price: 50, qty: 1, promoEligible: false }),
    ]);
    expect(q.markdown).toBeCloseTo(40, 2);
    // 150 - 40 = 110, free shipping, tax 8.5% of 110
    expect(q.shipping).toBe(0);
    expect(q.tax).toBeCloseTo(9.35, 2);
    expect(q.total).toBeCloseTo(119.35, 2);
  });

  it('charges flat shipping below the free threshold', () => {
    const q = service.quote([makeLine({ price: 20, qty: 1, promoEligible: false })]);
    expect(q.shipping).toBe(7);
  });

  it('keeps shipping free once discounted subtotal stays above $50', () => {
    const q = service.quote([makeLine({ price: 60, qty: 1, promoEligible: true })]);
    // 60 - 24 = 36 < 50 -> shipping applies because threshold is on post-discount
    expect(q.shipping).toBe(7);
  });

  it('applies a valid promo code on top of the markdown', () => {
    const q = service.quote([makeLine({ price: 100, qty: 1 })], 'EXTRA10');
    expect(q.promoDiscount).toBeCloseTo(10, 2);
    expect(q.promoError).toBeNull();
    expect(q.promoCode).toBe('EXTRA10');
  });

  it('flags unknown promo codes without applying a discount', () => {
    const q = service.quote([makeLine()], 'bogus');
    expect(q.promoDiscount).toBe(0);
    expect(q.promoError).toContain('BOGUS');
  });

  it('handles an empty bag without NaNs', () => {
    const q = service.quote([]);
    expect(q.subtotal).toBe(0);
    expect(q.total).toBe(0);
    expect(q.shipping).toBe(0);
  });

  it('treats only "... at checkout" colourway flags as promo-eligible', () => {
    expect(isPromoEligible('40% off at checkout')).toBeTrue();
    expect(isPromoEligible('Extra 40% off at checkout')).toBeTrue();
    expect(isPromoEligible('60% off: limited time')).toBeFalse();
    expect(isPromoEligible('Final sale')).toBeFalse();
    expect(isPromoEligible('Excluded from promotions')).toBeFalse();
    expect(isPromoEligible('')).toBeFalse();
  });
});
