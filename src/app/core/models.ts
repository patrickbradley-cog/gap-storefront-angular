export interface Colorway {
  ccId: string;
  name: string;
  regularPrice: string;
  effectivePrice: string;
  flag: string;
  badge: string;
  swatch: string;
  images: string[];
}

export interface Product {
  id: string;
  name: string;
  department: Department;
  category: string;
  price: number;
  regularPrice: number | null;
  promo: string;
  badge: string;
  reviewScore: number | null;
  reviewCount: number | null;
  colors: Colorway[];
  sizes: string[];
  fits: string[];
  description: string;
}

export type Department = 'men' | 'women' | 'girls' | 'boys' | 'baby';

export interface BagLine {
  key: string;
  productId: string;
  ccId: string;
  name: string;
  color: string;
  fit: string;
  size: string;
  qty: number;
  price: number;
  promoEligible: boolean;
  image: string;
  department: Department;
  category: string;
}

export interface BagState {
  lines: BagLine[];
}

export interface PriceQuote {
  subtotal: number;
  markdown: number;
  promoCode: string | null;
  promoDiscount: number;
  promoError: string | null;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
}

export interface OrderRequest {
  shipping: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  payment: {
    cardLast4: string;
  };
  lines: Array<{ productId: string; ccId: string; size: string; qty: number }>;
  promoCode?: string | null;
}

export interface OrderConfirmation {
  orderNumber: string;
  email: string;
  total: number;
  itemCount: number;
}

export interface Facets {
  sizes: string[];
  colors: string[];
  maxPrice: number;
}

export interface CatalogFilter {
  sizes: string[];
  colors: string[];
  priceMax: number | null;
}

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';
