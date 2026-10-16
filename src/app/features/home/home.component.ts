import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CatalogService } from '../../core/services/catalog.service';
import { Product } from '../../core/models';
import { categoryLabel } from '../../shared/catalog-utils';

interface CategoryTile {
  label: string;
  image: string;
  link: string[];
}

const MEN_TILES: Array<[string, string]> = [
  ['Shop all', ''],
  ['Jeans', 'jeans'],
  ['Sweaters', 'sweaters'],
  ['Tees', 't-shirts'],
  ['Sweats', 'sweatshirts-and-sweatpants'],
  ['Shirts', 'shirts'],
];

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  @ViewChild('rail') rail!: ElementRef<HTMLElement>;

  menTiles$!: Observable<CategoryTile[]>;
  featured$!: Observable<Product[]>;

  heroImage = 'https://content.gapinc.com/d/l3s6g0107m0n36lwo70a107v4ihcep0c.jpg';
  pjsImage = 'https://content.gapinc.com/d/6132bo4m2ej85lq6os6ypp47tgq08qtd.jpg';
  bagImage = 'https://content.gapinc.com/d/qqpel6m5l17h8pyy64jb16vjdm42wxbx.jpg';

  departmentTiles = [
    { label: 'Women', route: ['/browse', 'women'] },
    { label: 'Girls', route: ['/browse', 'girls'] },
    { label: 'Boys', route: ['/browse', 'boys'] },
    { label: 'Baby & Toddler', route: ['/browse', 'baby'] },
  ];

  constructor(private catalog: CatalogService) {}

  ngOnInit(): void {
    this.menTiles$ = this.catalog.getByDepartment('men').pipe(
      map((products) =>
        MEN_TILES.map(([label, cat]) => {
          const pool = cat ? products.filter((p) => p.category === cat) : products;
          const p = pool[0];
          return {
            label,
            image: p ? p.colors[0].images[0] || p.colors[0].swatch : '',
            link: cat ? ['/browse', 'men', cat] : ['/browse', 'men'],
          };
        }),
      ),
    );

    this.featured$ = this.catalog
      .getCatalog()
      .pipe(map((ps) => ps.filter((p) => p.promo && p.department !== 'baby').slice(0, 8)));
  }

  scrollRail(dir: number): void {
    this.rail.nativeElement.scrollBy({ left: dir * 320, behavior: 'smooth' });
  }

  catLabel = categoryLabel;
}
