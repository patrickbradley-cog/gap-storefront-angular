import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BagStore } from './bag-store.service';
import { PricingService } from './pricing.service';
import { makeProduct } from '../../testing/fixtures';

describe('BagStore', () => {
  let store: BagStore;
  const newStore = () => new BagStore(TestBed.inject(HttpClient), new PricingService());

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    store = newStore();
  });

  it('adds lines and merges same product/color/fit/size', () => {
    const p = makeProduct();
    store.add(p, '907280012', 'Blue', 'Regular', 'M', 1);
    store.add(p, '907280012', 'Blue', 'Regular', 'M', 2);
    expect(store.lines.length).toBe(1);
    expect(store.lines[0].qty).toBe(3);
  });

  it('keeps different sizes as separate lines', () => {
    const p = makeProduct();
    store.add(p, '907280012', 'Blue', 'Regular', 'M', 1);
    store.add(p, '907280012', 'Blue', 'Regular', 'L', 1);
    expect(store.lines.length).toBe(2);
  });

  it('updates qty and removes at zero', () => {
    const p = makeProduct();
    store.add(p, '907280012', 'Blue', 'Regular', 'M', 1);
    const key = store.lines[0].key;
    store.setQty(key, 4);
    expect(store.lines[0].qty).toBe(4);
    store.setQty(key, 0);
    expect(store.lines.length).toBe(0);
  });

  it('persists to localStorage', () => {
    const p = makeProduct();
    store.add(p, '907280012', 'Blue', 'Regular', 'M', 2);
    const raw = localStorage.getItem('gap-storefront.bag');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).lines.length).toBe(1);
  });

  it('restores state from localStorage on construction', () => {
    const p = makeProduct();
    store.add(p, '907280012', 'Blue', 'Regular', 'M', 2);
    const fresh = newStore();
    expect(fresh.lines.length).toBe(1);
    expect(fresh.lines[0].qty).toBe(2);
  });

  it('survives corrupted localStorage', () => {
    localStorage.setItem('gap-storefront.bag', '{not json');
    const fresh = newStore();
    expect(fresh.lines.length).toBe(0);
  });
});
