import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { PdpComponent } from './pdp.component';
import { CatalogService } from '../../core/services/catalog.service';
import { BagStore } from '../../core/services/bag-store.service';
import { SharedModule } from '../../shared/shared.module';
import { Product } from '../../core/models';
import { makeProduct } from '../../testing/fixtures';

describe('PdpComponent', () => {
  let fixture: ComponentFixture<PdpComponent>;
  let component: PdpComponent;
  let bag: jasmine.SpyObj<BagStore>;

  beforeEach(async () => {
    const product = makeProduct();
    const catalog = jasmine.createSpyObj<CatalogService>('CatalogService', [
      'getProduct',
      'getByCategory',
    ]);
    catalog.getProduct.and.returnValue(of(product));
    catalog.getByCategory.and.returnValue(of([product]));

    bag = jasmine.createSpyObj<BagStore>('BagStore', ['add']);

    await TestBed.configureTestingModule({
      declarations: [PdpComponent],
      imports: [SharedModule, FormsModule, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: BagStore, useValue: bag },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '907280' })) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PdpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders name, price, fits, sizes and all six colourways', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.pdp__name')?.textContent).toContain('Relaxed Polo Sweater');
    expect(el.querySelector('.pdp__price')?.textContent).toContain('$79.95');
    expect(el.querySelectorAll('.pdp__sizes .size-chip').length).toBe(7); // XS–XXXL
    expect(el.querySelectorAll('.pdp__fits .fit-chip').length).toBe(2); // Regular/Tall
  });

  it('requires a size before adding to bag', () => {
    component.addToBag();
    expect(component.sizeError).toBeTrue();
    expect(bag.add).not.toHaveBeenCalled();

    component.selectSize('M');
    component.addToBag();
    expect(bag.add).toHaveBeenCalledWith(
      component.product as never,
      '907280012',
      'Blue',
      'Regular',
      'M',
      1,
    );
  });

  it('switches gallery when a colour is selected', () => {
    const other = (component.product as Product).colors[1];
    component.selectColor(other);
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('.pdp__main-img img') as HTMLImageElement;
    expect(img.src).toBe(other.images[0]);
  });

  it('shows the selected colourway price and flag', () => {
    const base = (component.product as Product).colors[1];
    component.selectColor({
      ...base,
      regularPrice: '89.95',
      effectivePrice: '49.97',
      flag: 'Final sale',
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.pdp__price .price')?.textContent).toContain('$49.97');
    expect(el.querySelector('.pdp__price .price-was')?.textContent).toContain('$89.95');
    expect(el.querySelector('.promo-flag')?.textContent).toContain('Final sale');
  });
});
