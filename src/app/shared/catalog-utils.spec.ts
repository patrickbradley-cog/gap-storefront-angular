import { facetsFor, filterCatalog, sortCatalog, sortSizes } from './catalog-utils';
import { makeProduct } from '../testing/fixtures';

describe('catalog-utils', () => {
  const products = [
    makeProduct({ id: 'a', name: 'Alpha Sweater', price: 79.95, sizes: ['S', 'M', 'L'] }),
    makeProduct({
      id: 'b',
      name: 'Beta Tee',
      price: 24.95,
      sizes: ['XS', 'S'],
      colors: [
        {
          ccId: 'c1',
          name: 'Red',
          regularPrice: '24.95',
          effectivePrice: '24.95',
          flag: '',
          badge: '',
          swatch: '',
          images: [],
        },
      ],
    }),
    makeProduct({ id: 'c', name: 'Gamma Jean', price: 59.95, sizes: ['M', 'XL'] }),
  ];

  describe('facetsFor', () => {
    it('collects sizes, color names and max price', () => {
      const f = facetsFor(products);
      expect(f.sizes).toEqual(jasmine.arrayContaining(['XS', 'XL']));
      expect(f.colors).toContain('Red');
      expect(f.maxPrice).toBe(79.95);
    });
  });

  describe('filterCatalog', () => {
    it('filters by size', () => {
      const out = filterCatalog(products, { sizes: ['XS'], colors: [], priceMax: null });
      expect(out.map((p) => p.id)).toEqual(['b']);
    });

    it('filters by color name', () => {
      const out = filterCatalog(products, { sizes: [], colors: ['Red'], priceMax: null });
      expect(out.map((p) => p.id)).toEqual(['b']);
    });

    it('filters by max price', () => {
      const out = filterCatalog(products, { sizes: [], colors: [], priceMax: 50 });
      expect(out.map((p) => p.id)).toEqual(['b']);
    });

    it('combines filters', () => {
      const out = filterCatalog(products, { sizes: ['XS'], colors: ['Blue'], priceMax: 80 });
      expect(out.map((p) => p.id)).toEqual([]);
      const out2 = filterCatalog(products, { sizes: ['M'], colors: ['Blue'], priceMax: 30 });
      expect(out2.map((p) => p.id)).toEqual([]);
      const out3 = filterCatalog(products, { sizes: ['XL'], colors: ['Blue'], priceMax: 60 });
      expect(out3.map((p) => p.id)).toEqual(['c']);
    });
  });

  describe('sortCatalog', () => {
    it('sorts by price ascending and descending', () => {
      expect(sortCatalog(products, 'price-asc').map((p) => p.price)).toEqual([24.95, 59.95, 79.95]);
      expect(sortCatalog(products, 'price-desc').map((p) => p.price)).toEqual([
        79.95, 59.95, 24.95,
      ]);
    });

    it('sorts by name', () => {
      expect(sortCatalog(products, 'name').map((p) => p.id)).toEqual(['a', 'b', 'c']);
    });

    it('does not mutate the input', () => {
      const copy = [...products];
      sortCatalog(products, 'price-asc');
      expect(products).toEqual(copy);
    });
  });

  describe('sortSizes', () => {
    it('orders standard apparel sizes', () => {
      expect(sortSizes(['XL', 'XS', 'M', 'S'])).toEqual(['XS', 'S', 'M', 'XL']);
    });
  });
});
