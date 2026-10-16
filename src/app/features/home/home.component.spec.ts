import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { CatalogService } from '../../core/services/catalog.service';
import { SharedModule } from '../../shared/shared.module';
import { makeProduct } from '../../testing/fixtures';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    const products = [makeProduct()];
    const catalog = jasmine.createSpyObj<CatalogService>('CatalogService', [
      'getCatalog',
      'getByDepartment',
    ]);
    catalog.getCatalog.and.returnValue(of(products));
    catalog.getByDepartment.and.returnValue(of(products));

    await TestBed.configureTestingModule({
      declarations: [HomeComponent],
      imports: [SharedModule, RouterTestingModule],
      providers: [{ provide: CatalogService, useValue: catalog }],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  });

  it('renders the hero with the Friends & Family headline', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.hero__title')?.textContent).toContain('40% off everything');
  });

  it('renders the men category rail with real category tiles', () => {
    const tiles = fixture.nativeElement.querySelectorAll('.tile');
    expect(tiles.length).toBe(6); // Shop all + 5 categories
    expect(tiles[1].textContent).toContain('Jeans');
  });

  it('renders featured products', () => {
    expect(fixture.nativeElement.querySelectorAll('app-product-card').length).toBe(1);
  });
});
