import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { BagStore } from '../../core/services/bag-store.service';
import { CheckoutService } from '../../core/services/checkout.service';
import { BagLine } from '../../core/models';
import { luhnValidator } from './luhn.validator';
import { OrderDraftService } from './order-draft.service';

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
];

type Step = 'shipping' | 'payment' | 'review';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  step: Step = 'shipping';
  lines: BagLine[] = [];
  placing = false;
  placeError = '';
  states = US_STATES;

  lines$ = this.bag.lines$;
  quote$ = this.bag.serverQuote$;

  shipping = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    address: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
    zip: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
  });

  payment = this.fb.group({
    nameOnCard: ['', Validators.required],
    cardNumber: ['', [Validators.required, luhnValidator()]],
    expiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
  });

  constructor(
    private fb: FormBuilder,
    private bag: BagStore,
    private checkout: CheckoutService,
    private orders: OrderDraftService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.lines$.pipe(takeUntil(this.destroy$)).subscribe((ls) => (this.lines = ls));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toPayment(): void {
    this.shipping.markAllAsTouched();
    if (this.shipping.valid) {
      this.step = 'payment';
    }
  }

  toReview(): void {
    this.payment.markAllAsTouched();
    if (this.payment.valid) {
      this.step = 'review';
    }
  }

  back(to: Step): void {
    this.step = to;
  }

  get cardLast4(): string {
    return (this.payment.value.cardNumber || '').replace(/\D/g, '').slice(-4);
  }

  placeOrder(): void {
    if (!this.lines.length || this.placing) {
      return;
    }
    this.placing = true;
    this.placeError = '';
    this.bag.promoCode.pipe(take(1), takeUntil(this.destroy$)).subscribe((code) => {
      this.checkout
        .placeOrder({
          shipping: this.shipping.getRawValue() as never,
          payment: { cardLast4: this.cardLast4 },
          lines: this.lines.map((l) => ({
            productId: l.productId,
            ccId: l.ccId,
            size: l.size,
            qty: l.qty,
          })),
          promoCode: code,
        })
        .subscribe({
          next: (conf) => {
            this.orders.save(conf);
            this.bag.clear();
            this.router.navigate(['/checkout/confirmation']);
          },
          error: (err) => {
            this.placing = false;
            this.placeError =
              err?.error?.error || 'Something went wrong placing the order. Try again.';
          },
        });
    });
  }

  invalid(group: 'shipping' | 'payment', field: string): boolean {
    const c = (this[group] as typeof this.shipping).get(field);
    return !!c && c.invalid && c.touched;
  }
}
