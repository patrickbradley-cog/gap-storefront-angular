import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, of } from 'rxjs';
import { BagPageComponent } from './bag-page.component';
import { BagStore } from '../../core/services/bag-store.service';
import { PricingService } from '../../core/services/pricing.service';
import { SharedModule } from '../../shared/shared.module';
import { makeLine } from '../../testing/fixtures';

describe('BagPageComponent', () => {
  let fixture: ComponentFixture<BagPageComponent>;
  let bag: jasmine.SpyObj<BagStore>;
  const lines$ = new BehaviorSubject([makeLine({ qty: 2 })]);

  beforeEach(async () => {
    const pricing = new PricingService();
    const quote = pricing.quote(lines$.value);
    bag = jasmine.createSpyObj<BagStore>('BagStore', ['setQty', 'remove', 'setPromoCode'], {
      lines$,
      serverQuote$: of(quote),
      promoCode: of(null),
    });

    await TestBed.configureTestingModule({
      declarations: [BagPageComponent],
      imports: [SharedModule, FormsModule, RouterTestingModule],
      providers: [{ provide: BagStore, useValue: bag }],
    }).compileComponents();

    fixture = TestBed.createComponent(BagPageComponent);
    fixture.detectChanges();
  });

  it('lists bag lines with colour/fit/size details', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bline__name')?.textContent).toContain('Relaxed Polo Sweater');
    expect(el.textContent).toContain('Size: M');
  });

  it('shows the Friends & Family markdown line in the summary', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Friends & Family 40% off (at checkout)');
    expect(el.textContent).toContain('-$63.96');
  });

  it('applies a promo code through the store', () => {
    const component = fixture.componentInstance;
    component.promoInput = 'EXTRA10';
    component.applyPromo();
    expect(bag.setPromoCode).toHaveBeenCalledWith('EXTRA10');
  });

  it('updates quantity and removes lines', () => {
    const component = fixture.componentInstance;
    const line = lines$.value[0];
    component.setQty(line, 5);
    expect(bag.setQty).toHaveBeenCalledWith(line.key, 5);
    component.remove(line);
    expect(bag.remove).toHaveBeenCalledWith(line.key);
  });
});
