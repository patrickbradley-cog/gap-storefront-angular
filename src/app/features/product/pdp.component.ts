import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { CatalogService } from '../../core/services/catalog.service';
import { BagStore } from '../../core/services/bag-store.service';
import { Colorway, Product } from '../../core/models';
import { categoryLabel, departmentLabel, sortSizes } from '../../shared/catalog-utils';

@Component({
  selector: 'app-pdp',
  templateUrl: './pdp.component.html',
  styleUrls: ['./pdp.component.scss'],
})
export class PdpComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  product$!: Observable<Product | undefined>;
  related$!: Observable<Product[]>;

  product: Product | null = null;
  selectedColor: Colorway | null = null;
  selectedFit = '';
  selectedSize = '';
  qty = 1;
  activeImage = 0;
  sizeError = false;
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private catalog: CatalogService,
    private bag: BagStore,
  ) {}

  ngOnInit(): void {
    this.product$ = this.route.paramMap.pipe(
      switchMap((params) => this.catalog.getProduct(params.get('id') || '')),
      tap((p) => {
        if (!p) {
          this.notFound = true;
          return;
        }
        this.notFound = false;
        this.product = p;
        this.selectedColor = p.colors[0];
        this.selectedFit = p.fits[0] || 'Regular';
        this.selectedSize = '';
        this.sizeError = false;
        this.qty = 1;
        this.activeImage = 0;
      }),
      takeUntil(this.destroy$),
    );

    this.related$ = this.product$.pipe(
      switchMap((p) =>
        p
          ? this.catalog
              .getByCategory(p.department, p.category)
              .pipe(map((ps) => ps.filter((x) => x.id !== p.id).slice(0, 4)))
          : [],
      ),
    );

    // The template reads `product`/`related$`, not `product$` directly —
    // subscribe so the tap above actually runs.
    this.product$.subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectColor(c: Colorway): void {
    this.selectedColor = c;
    this.activeImage = 0;
  }

  selectSize(s: string): void {
    this.selectedSize = s;
    this.sizeError = false;
  }

  bumpQty(d: number): void {
    this.qty = Math.min(9, Math.max(1, this.qty + d));
  }

  addToBag(): void {
    if (!this.selectedSize) {
      this.sizeError = true;
      return;
    }
    if (!this.product || !this.selectedColor) {
      return;
    }
    this.bag.add(
      this.product,
      this.selectedColor.ccId,
      this.selectedColor.name,
      this.selectedFit,
      this.selectedSize,
      this.qty,
    );
  }

  get gallery(): string[] {
    return this.selectedColor?.images || [];
  }

  get sortedSizes(): string[] {
    return this.product ? sortSizes(this.product.sizes) : [];
  }

  stars(score: number | null): number {
    return score ? Math.round(score) : 0;
  }

  catLabel = categoryLabel;
  deptLabel = departmentLabel;
}
