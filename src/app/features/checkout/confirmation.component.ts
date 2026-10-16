import { Component, OnInit } from '@angular/core';
import { OrderConfirmation } from '../../core/models';
import { OrderDraftService } from './order-draft.service';

@Component({
  selector: 'app-confirmation',
  templateUrl: './confirmation.component.html',
  styleUrls: ['./confirmation.component.scss'],
})
export class ConfirmationComponent implements OnInit {
  order: OrderConfirmation | null = null;

  constructor(private orders: OrderDraftService) {}

  ngOnInit(): void {
    this.order = this.orders.last;
  }
}
