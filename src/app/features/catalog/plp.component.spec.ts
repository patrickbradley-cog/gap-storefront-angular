import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { PlpComponent } from './plp.component';
import { CatalogService } from '../../core/services/catalog.service';
import { SharedModule } from '../../shared/shared.module';
import { makeProduct } from '../../testing/fixtures';

function makeRoute(department: string, category: string) {
  return {
    paramMap: of(convertToParamMap({ department, category })),
    queryParamMap: of(convertToParamMap({})),
  };
}

describe('PlpComponent', () => {
  let fixture: ComponentFixture<PlpComponent>;
  let component: PlpComponent;
  const products = [
    makeProduct({ id: 'a', price: 79.95, sizes: ['M', 'L'] }),
    makeProduct({ id: 'b', price: 24.95, name: 'Budget Tee', sizes: ['XS', 'S'] }),
  ];

  beforeEach(async () => {
    const catalog = jasmine.createSpyObj<CatalogService>('CatalogService', [
      'getCatalog',
      'getByDepartment',
      'getByCategory',
      'categoriesFor',
    ]);
    catalog.getCatalog.and.returnValue(of(products));
    catalog.getByDepartment.and.returnValue(of(products));
    catalog.getByCategory.and.returnValue(of(products));
    catalog.categoriesFor.and.returnValue(of(['sweaters', 'jeans']));

    await TestBed.configureTestingModule({
      declarations: [PlpComponent],
      imports: [SharedModule, FormsModule, RouterTestingModule],
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: ActivatedRoute, useValue: makeRoute('men', 'sweaters') },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the category heading and count', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.plp__title')?.textContent).toContain('Sweaters');
    expect(el.querySelector('.plp__count')?.textContent).toContain('2 items');
  });

  it('filters the grid by size', () => {
    component.toggleSize('XS');
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('app-product-card');
    expect(cards.length).toBe(1);
  });

  it('sorts by price', () => {
    component.onSort('price-asc');
    fixture.detectChanges();
    let prices: number[] = [];
    component.products$.subscribe((ps) => (prices = ps.map((p) => p.price)));
    expect(prices).toEqual([24.95, 79.95]);
  });
});
