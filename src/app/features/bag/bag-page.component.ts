import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BagStore } from '../../core/services/bag-store.service';
import { PricingService } from '../../core/services/pricing.service';
import { BagLine } from '../../core/models';

@Component({
  selector: 'app-bag-page',
  templateUrl: './bag-page.component.html',
  styleUrls: ['./bag-page.component.scss'],
})
export class BagPageComponent implements OnInit, OnDestroy {
  lines$ = this.bag.lines$;
  quote$ = this.bag.serverQuote$;
  promoInput = '';
  appliedCode: string | null = null;
  promoError: string | null = null;
  private destroy$ = new Subject<void>();

  readonly quantities = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  constructor(private bag: BagStore, private pricing: PricingService) {}

  ngOnInit(): void {
    this.bag.promoCode.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      this.appliedCode = c;
      this.promoInput = c || '';
    });
    this.quote$.pipe(takeUntil(this.destroy$)).subscribe((q) => (this.promoError = q.promoError));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setQty(line: BagLine, qty: number): void {
    this.bag.setQty(line.key, qty);
  }

  remove(line: BagLine): void {
    this.bag.remove(line.key);
  }

  applyPromo(): void {
    const code = this.promoInput.trim();
    this.bag.setPromoCode(code || null);
  }

  removePromo(): void {
    this.promoInput = '';
    this.bag.setPromoCode(null);
  }

  lineLink(l: BagLine): string[] {
    return ['/browse/product', l.productId];
  }
}
