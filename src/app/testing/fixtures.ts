import { BagLine, Product } from '../core/models';

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '907280',
    name: 'Relaxed Polo Sweater',
    department: 'men',
    category: 'sweaters',
    price: 79.95,
    regularPrice: null,
    promo: '40% off at checkout',
    badge: '',
    reviewScore: 5,
    reviewCount: 1,
    colors: [
      {
        ccId: '907280012',
        name: 'Blue',
        regularPrice: '79.95',
        effectivePrice: '79.95',
        flag: '40% off at checkout',
        badge: '',
        swatch: 'https://example.com/swatch.jpg',
        images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      },
      {
        ccId: '907280042',
        name: 'Black',
        regularPrice: '79.95',
        effectivePrice: '79.95',
        flag: '40% off at checkout',
        badge: '',
        swatch: 'https://example.com/swatch2.jpg',
        images: ['https://example.com/3.jpg'],
      },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    fits: ['Regular', 'Tall'],
    description: 'Soft knit cotton polo sweater.',
    ...overrides,
  };
}

export function makeLine(overrides: Partial<BagLine> = {}): BagLine {
  return {
    key: '907280|907280012|Regular|M',
    productId: '907280',
    ccId: '907280012',
    name: 'Relaxed Polo Sweater',
    color: 'Blue',
    fit: 'Regular',
    size: 'M',
    qty: 1,
    price: 79.95,
    promoEligible: true,
    image: 'https://example.com/1.jpg',
    department: 'men',
    category: 'sweaters',
    ...overrides,
  };
}
