import { Injectable } from '@angular/core';
import { OrderConfirmation } from '../../core/models';

const KEY = 'gap-storefront.lastOrder';

/** Holds the most recent order confirmation (sessionStorage so refresh works). */
@Injectable({ providedIn: 'root' })
export class OrderDraftService {
  private order: OrderConfirmation | null = null;

  save(o: OrderConfirmation): void {
    this.order = o;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(o));
    } catch {
      /* ignore */
    }
  }

  get last(): OrderConfirmation | null {
    if (this.order) {
      return this.order;
    }
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as OrderConfirmation) : null;
    } catch {
      return null;
    }
  }
}
