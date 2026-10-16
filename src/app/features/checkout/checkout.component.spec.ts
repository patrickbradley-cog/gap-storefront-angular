import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { BagStore } from '../../core/services/bag-store.service';
import { CheckoutService } from '../../core/services/checkout.service';
import { PricingService } from '../../core/services/pricing.service';
import { SharedModule } from '../../shared/shared.module';
import { makeLine } from '../../testing/fixtures';

describe('CheckoutComponent', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let component: CheckoutComponent;
  let checkout: jasmine.SpyObj<CheckoutService>;
  let bag: jasmine.SpyObj<BagStore>;

  beforeEach(async () => {
    const line = makeLine();
    const quote = new PricingService().quote([line]);
    bag = jasmine.createSpyObj<BagStore>('BagStore', ['clear'], {
      lines$: of([line]),
      serverQuote$: of(quote),
      promoCode: of(null),
    });
    checkout = jasmine.createSpyObj<CheckoutService>('CheckoutService', ['placeOrder']);
    checkout.placeOrder.and.returnValue(
      of({ orderNumber: 'GAP-12345678', email: 'a@b.c', total: 50, itemCount: 1 }),
    );

    await TestBed.configureTestingModule({
      declarations: [CheckoutComponent],
      imports: [SharedModule, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: BagStore, useValue: bag },
        { provide: CheckoutService, useValue: checkout },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts on the shipping step', () => {
    expect(component.step).toBe('shipping');
    expect(fixture.nativeElement.textContent).toContain('Shipping address');
  });

  it('blocks step 2 until shipping is valid', () => {
    component.toPayment();
    expect(component.step).toBe('shipping');

    component.shipping.setValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      address: '1 Way',
      city: 'SF',
      state: 'CA',
      zip: '94105',
    });
    component.toPayment();
    expect(component.step).toBe('payment');
  });

  it('rejects a card that fails Luhn', () => {
    component.step = 'payment';
    component.payment.setValue({
      nameOnCard: 'Ada',
      cardNumber: '4111111111111112',
      expiry: '12/28',
      cvv: '123',
    });
    component.toReview();
    expect(component.step).toBe('payment');
    expect(component.payment.get('cardNumber')?.errors).toEqual({ luhn: true });
  });

  it('places the order and clears the bag', () => {
    component.step = 'payment';
    component.shipping.setValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      address: '1 Way',
      city: 'SF',
      state: 'CA',
      zip: '94105',
    });
    component.payment.setValue({
      nameOnCard: 'Ada',
      cardNumber: '4111111111111111',
      expiry: '12/28',
      cvv: '123',
    });
    component.toReview();
    component.placeOrder();
    expect(checkout.placeOrder).toHaveBeenCalled();
    expect(bag.clear).toHaveBeenCalled();
  });
});
