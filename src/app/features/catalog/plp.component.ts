import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, Subject, combineLatest, of } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { CatalogService } from '../../core/services/catalog.service';
import { CatalogFilter, Department, Facets, Product, SortKey } from '../../core/models';
import {
  categoryLabel,
  departmentLabel,
  facetsFor,
  filterCatalog,
  sortCatalog,
  sortSizes,
} from '../../shared/catalog-utils';

const PRICE_BUCKETS = [
  { label: 'Under $25', max: 25 },
  { label: 'Under $50', max: 50 },
  { label: 'Under $75', max: 75 },
  { label: 'Under $100', max: 100 },
];

@Component({
  selector: 'app-plp',
  templateUrl: './plp.component.html',
  styleUrls: ['./plp.component.scss'],
})
export class PlpComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  department = '';
  category = '';
  heading = '';
  searchTerm = '';

  filtersOpen = false;
  priceBuckets = PRICE_BUCKETS;

  private filter$ = new BehaviorSubject<CatalogFilter>({ sizes: [], colors: [], priceMax: null });
  private sort$ = new BehaviorSubject<SortKey>('featured');

  products$!: Observable<Product[]>;
  facets$!: Observable<Facets>;
  selectedSizes = new Set<string>();
  selectedColors = new Set<string>();
  priceMax: number | null = null;
  sort: SortKey = 'featured';
  facets: Facets = { sizes: [], colors: [], maxPrice: 0 };
  baseProducts: Product[] = [];
  categories: string[] = [];

  constructor(private route: ActivatedRoute, private catalog: CatalogService) {}

  ngOnInit(): void {
    const params$ = combineLatest([this.route.paramMap, this.route.queryParamMap]);

    const base$ = params$.pipe(
      switchMap(([params, query]) => {
        this.department = params.get('department') || '';
        this.category = params.get('category') || '';
        this.searchTerm = (query.get('q') || '').trim();
        this.resetFilters();

        if (this.searchTerm) {
          this.heading = `Results for "${this.searchTerm}"`;
          const q = this.searchTerm.toLowerCase();
          return this.catalog
            .getCatalog()
            .pipe(
              map((ps) =>
                ps.filter((p) =>
                  (p.name + ' ' + p.department + ' ' + p.category).toLowerCase().includes(q),
                ),
              ),
            );
        }
        if (this.department && this.category) {
          this.heading = categoryLabel(this.category);
          return this.catalog
            .getByCategory(this.department as Department, this.category)
            .pipe(
              switchMap((ps) =>
                ps.length ? of(ps) : this.catalog.getByDepartment(this.department as Department),
              ),
            );
        }
        if (this.department) {
          this.heading = `${departmentLabel(this.department)} — Shop all`;
          return this.catalog.getByDepartment(this.department as Department);
        }
        this.heading = 'Shop all';
        return this.catalog.getCatalog();
      }),
      takeUntil(this.destroy$),
    );

    this.products$ = combineLatest([base$, this.filter$, this.sort$]).pipe(
      map(([ps, f, s]) => sortCatalog(filterCatalog(ps, f), s)),
    );

    this.facets$ = base$.pipe(map(facetsFor));
    this.facets$.pipe(takeUntil(this.destroy$)).subscribe((f) => (this.facets = f));
    base$.pipe(takeUntil(this.destroy$)).subscribe((ps) => (this.baseProducts = ps));

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const d = params.get('department');
          return d ? this.catalog.categoriesFor(d as Department) : of([]);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((cats) => (this.categories = cats));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get sortedFacetSizes(): string[] {
    return sortSizes(this.facets.sizes);
  }

  toggleSize(s: string): void {
    this.selectedSizes.has(s) ? this.selectedSizes.delete(s) : this.selectedSizes.add(s);
    this.pushFilter();
  }

  toggleColor(c: string): void {
    this.selectedColors.has(c) ? this.selectedColors.delete(c) : this.selectedColors.add(c);
    this.pushFilter();
  }

  setPrice(max: number | null): void {
    this.priceMax = this.priceMax === max ? null : max;
    this.pushFilter();
  }

  onSort(value: string): void {
    this.sort = value as SortKey;
    this.sort$.next(this.sort);
  }

  clearFilters(): void {
    this.resetFilters();
    this.pushFilter();
  }

  get hasActiveFilters(): boolean {
    return this.selectedSizes.size > 0 || this.selectedColors.size > 0 || this.priceMax != null;
  }

  catLink(cat: string): string[] {
    return ['/browse', this.department, cat];
  }

  catLabel = categoryLabel;
  deptLabel = departmentLabel;

  private pushFilter(): void {
    this.filter$.next({
      sizes: Array.from(this.selectedSizes),
      colors: Array.from(this.selectedColors),
      priceMax: this.priceMax,
    });
  }

  private resetFilters(): void {
    this.selectedSizes.clear();
    this.selectedColors.clear();
    this.priceMax = null;
    this.filter$.next({ sizes: [], colors: [], priceMax: null });
  }
}
