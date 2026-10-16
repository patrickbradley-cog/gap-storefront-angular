import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProductCardComponent } from './product-card/product-card.component';
import { ImgFallbackDirective } from './img-fallback.directive';

@NgModule({
  declarations: [ProductCardComponent, ImgFallbackDirective],
  imports: [CommonModule, RouterModule],
  exports: [CommonModule, RouterModule, ProductCardComponent, ImgFallbackDirective],
})
export class SharedModule {}
