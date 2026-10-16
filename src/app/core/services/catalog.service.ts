import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { Product, Department } from '../models';

/**
 * Loads the product catalog over a real HTTP boundary (Express API on :4201,
 * proxied by ng serve). Falls back to the bundled asset JSON so the UI still
 * works when the API isn't running.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private catalog$ = this.http.get<Product[]>('/api/catalog').pipe(
    catchError(() => this.http.get<Product[]>('assets/data/catalog.json')),
    shareReplay(1),
  );

  constructor(private http: HttpClient) {}

  getCatalog(): Observable<Product[]> {
    return this.catalog$;
  }

  getProduct(id: string): Observable<Product | undefined> {
    return this.http
      .get<Product>(`/api/products/${id}`)
      .pipe(catchError(() => this.catalog$.pipe(map((ps) => ps.find((p) => p.id === id)))));
  }

  getByDepartment(department: Department): Observable<Product[]> {
    return this.catalog$.pipe(map((ps) => ps.filter((p) => p.department === department)));
  }

  getByCategory(department: Department, category: string): Observable<Product[]> {
    return this.catalog$.pipe(
      map((ps) => ps.filter((p) => p.department === department && p.category === category)),
    );
  }

  categoriesFor(department: Department): Observable<string[]> {
    return this.getByDepartment(department).pipe(
      map((ps) => Array.from(new Set(ps.map((p) => p.category))).sort()),
    );
  }
}
