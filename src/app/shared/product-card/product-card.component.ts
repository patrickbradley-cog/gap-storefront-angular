import { Component, Input } from '@angular/core';
import { Product } from '../../core/models';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
})
export class ProductCardComponent {
  @Input() product!: Product;
  selectedColor = 0;

  get link(): string[] {
    return ['/browse/product', this.product.id];
  }

  get image(): string {
    const c = this.product.colors[this.selectedColor] || this.product.colors[0];
    return c?.images[0] || c?.swatch || '';
  }

  selectColor(i: number, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.selectedColor = i;
  }
}
