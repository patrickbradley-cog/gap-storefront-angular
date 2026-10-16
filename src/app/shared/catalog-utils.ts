import { CatalogFilter, Facets, Product, SortKey } from '../core/models';

/** Facets available for a product list (drives the PLP filter UI). */
export function facetsFor(products: Product[]): Facets {
  const sizes = new Set<string>();
  const colors = new Set<string>();
  let maxPrice = 0;
  for (const p of products) {
    p.sizes.forEach((s) => sizes.add(s));
    p.colors.forEach((c) => colors.add(c.name));
    if (p.price > maxPrice) {
      maxPrice = p.price;
    }
  }
  return { sizes: Array.from(sizes), colors: Array.from(colors).sort(), maxPrice };
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function filterCatalog(products: Product[], filter: CatalogFilter): Product[] {
  return products.filter((p) => {
    if (filter.sizes.length && !filter.sizes.some((s) => p.sizes.includes(s))) {
      return false;
    }
    if (filter.colors.length && !p.colors.some((c) => filter.colors.includes(c.name))) {
      return false;
    }
    if (filter.priceMax != null && p.price > filter.priceMax) {
      return false;
    }
    return true;
  });
}

export function sortCatalog(products: Product[], sort: SortKey): Product[] {
  const sorted = [...products];
  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
}

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) {
      return a.localeCompare(b);
    }
    if (ia === -1) {
      return 1;
    }
    if (ib === -1) {
      return -1;
    }
    return ia - ib;
  });
}

export function departmentLabel(d: string): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function categoryLabel(c: string): string {
  return c
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
