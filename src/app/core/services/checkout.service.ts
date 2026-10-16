import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OrderConfirmation, OrderRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  constructor(private http: HttpClient) {}

  placeOrder(req: OrderRequest): Observable<OrderConfirmation> {
    return this.http.post<OrderConfirmation>('/api/checkout', req);
  }
}
