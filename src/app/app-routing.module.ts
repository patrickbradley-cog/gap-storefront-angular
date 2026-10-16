import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/home/home.module').then((m) => m.HomeModule),
  },
  {
    path: 'browse/product/:id',
    loadChildren: () => import('./features/product/product.module').then((m) => m.ProductModule),
  },
  {
    path: 'browse',
    loadChildren: () => import('./features/catalog/catalog.module').then((m) => m.CatalogModule),
  },
  {
    path: 'browse/:department',
    loadChildren: () => import('./features/catalog/catalog.module').then((m) => m.CatalogModule),
  },
  {
    path: 'browse/:department/:category',
    loadChildren: () => import('./features/catalog/catalog.module').then((m) => m.CatalogModule),
  },
  {
    path: 'bag',
    loadChildren: () => import('./features/bag/bag.module').then((m) => m.BagModule),
  },
  {
    path: 'checkout',
    loadChildren: () => import('./features/checkout/checkout.module').then((m) => m.CheckoutModule),
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
