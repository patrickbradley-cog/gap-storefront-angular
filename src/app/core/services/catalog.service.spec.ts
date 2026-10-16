import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import { makeProduct } from '../../testing/fixtures';

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;
  const products = [
    makeProduct(),
    makeProduct({ id: 'p2', name: 'High-Rise Jean', department: 'women', category: 'jeans' }),
    makeProduct({ id: 'p3', name: 'Logo Tee', department: 'girls', category: 't-shirts' }),
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the catalog from the API once and shares it', () => {
    let a: unknown, b: unknown;
    service.getCatalog().subscribe((ps) => (a = ps));
    service.getCatalog().subscribe((ps) => (b = ps));
    const req = http.expectOne('/api/catalog');
    req.flush(products);
    expect(a).toEqual(products);
    expect(b).toEqual(products);
  });

  it('falls back to the bundled asset when the API is down', () => {
    let got: unknown;
    service.getCatalog().subscribe((ps) => (got = ps));
    http.expectOne('/api/catalog').error(new ProgressEvent('error'));
    const fallback = http.expectOne('assets/data/catalog.json');
    fallback.flush(products);
    expect(got).toEqual(products);
  });

  it('fetches a single product from the API', () => {
    let got: unknown;
    service.getProduct('907280').subscribe((p) => (got = p));
    http.expectOne('/api/products/907280').flush(products[0]);
    expect(got).toEqual(products[0]);
  });

  it('filters by department and category', () => {
    let womens: unknown, jeans: unknown;
    service.getByDepartment('women').subscribe((ps) => (womens = ps));
    service.getByCategory('women', 'jeans').subscribe((ps) => (jeans = ps));
    // catalog$ is shared — a single request feeds both subscribers
    http.expectOne('/api/catalog').flush(products);
    expect(womens).toEqual([products[1]]);
    expect(jeans).toEqual([products[1]]);
  });
});
