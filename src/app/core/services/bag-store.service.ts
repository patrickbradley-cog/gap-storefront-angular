import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { BagLine, BagState, PriceQuote, Product } from '../models';
import { PricingService } from './pricing.service';

const STORAGE_KEY = 'gap-storefront.bag';
const PROMO_KEY = 'gap-storefront.promo';

/**
 * NgRx-free bag store: a single BehaviorSubject persisted to localStorage.
 * The displayed quote is computed locally for instant feedback and then
 * reconciled against POST /api/bag/price.
 */
@Injectable({ providedIn: 'root' })
export class BagStore {
  private readonly state$ = new BehaviorSubject<BagState>(this.load());
  private readonly promoCode$ = new BehaviorSubject<string | null>(this.loadPromo());
  private readonly drawerOpen$ = new BehaviorSubject<boolean>(false);

  readonly lines$: Observable<BagLine[]> = this.state$.pipe(map((s) => s.lines));
  readonly itemCount$: Observable<number> = this.lines$.pipe(
    map((ls) => ls.reduce((s, l) => s + l.qty, 0)),
  );
  readonly drawerOpen = this.drawerOpen$.asObservable();
  readonly promoCode = this.promoCode$.asObservable();

  /** Local quote — instant, always available (even when the API is down). */
  readonly quote$: Observable<PriceQuote> = this.lines$.pipe(
    switchMap((lines) => this.promoCode$.pipe(map((code) => this.pricing.quote(lines, code)))),
  );

  /** Server-authoritative quote via the real HTTP boundary. */
  readonly serverQuote$: Observable<PriceQuote> = this.quote$.pipe(
    debounceTime(150),
    switchMap((local) =>
      this.lines$.pipe(
        map((lines) => ({
          lines: lines.map((l) => ({
            productId: l.productId,
            ccId: l.ccId,
            size: l.size,
            qty: l.qty,
          })),
          promoCode: this.promoCode$.value,
        })),
        switchMap((body) =>
          this.http.post<PriceQuote>('/api/bag/price', body).pipe(catchError(() => of(local))),
        ),
      ),
    ),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  );

  constructor(private http: HttpClient, private pricing: PricingService) {}

  get lines(): BagLine[] {
    return this.state$.value.lines;
  }

  add(product: Product, ccId: string, color: string, fit: string, size: string, qty: number): void {
    const key = `${product.id}|${ccId}|${fit}|${size}`;
    const lines = [...this.state$.value.lines];
    const existing = lines.find((l) => l.key === key);
    const colorway = product.colors.find((c) => c.ccId === ccId) || product.colors[0];
    if (existing) {
      existing.qty += qty;
    } else {
      lines.push({
        key,
        productId: product.id,
        ccId: colorway.ccId,
        name: product.name,
        color,
        fit,
        size,
        qty,
        price: product.price,
        promoEligible: !!product.promo,
        image: colorway.images[0] || colorway.swatch,
        department: product.department,
        category: product.category,
      });
    }
    this.commit(lines);
    this.drawerOpen$.next(true);
  }

  setQty(key: string, qty: number): void {
    const lines =
      qty <= 0
        ? this.state$.value.lines.filter((l) => l.key !== key)
        : this.state$.value.lines.map((l) => (l.key === key ? { ...l, qty } : l));
    this.commit(lines);
  }

  remove(key: string): void {
    this.commit(this.state$.value.lines.filter((l) => l.key !== key));
  }

  clear(): void {
    this.commit([]);
    this.setPromoCode(null);
  }

  setPromoCode(code: string | null): void {
    this.promoCode$.next(code);
    try {
      if (code) {
        localStorage.setItem(PROMO_KEY, code);
      } else {
        localStorage.removeItem(PROMO_KEY);
      }
    } catch {
      /* localStorage unavailable */
    }
  }

  openDrawer(): void {
    this.drawerOpen$.next(true);
  }

  closeDrawer(): void {
    this.drawerOpen$.next(false);
  }

  private commit(lines: BagLine[]): void {
    this.state$.next({ lines });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines }));
    } catch {
      /* localStorage unavailable */
    }
  }

  private load(): BagState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BagState;
        if (parsed && Array.isArray(parsed.lines)) {
          return { lines: parsed.lines.filter((l) => l && l.qty > 0) };
        }
      }
    } catch {
      /* corrupted state -> empty bag */
    }
    return { lines: [] };
  }

  private loadPromo(): string | null {
    try {
      return localStorage.getItem(PROMO_KEY);
    } catch {
      return null;
    }
  }
}
