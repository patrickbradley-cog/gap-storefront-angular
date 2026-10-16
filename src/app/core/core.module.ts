import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';
import { DemoBarComponent } from './components/demo-bar/demo-bar.component';
import { BrandBarComponent } from './components/brand-bar/brand-bar.component';
import { PromoBannerComponent } from './components/promo-banner/promo-banner.component';
import { SiteHeaderComponent } from './components/site-header/site-header.component';
import { SiteFooterComponent } from './components/site-footer/site-footer.component';
import { BagDrawerComponent } from './components/bag-drawer/bag-drawer.component';
import { SignInModalComponent } from './components/sign-in-modal/sign-in-modal.component';

@NgModule({
  declarations: [
    DemoBarComponent,
    BrandBarComponent,
    PromoBannerComponent,
    SiteHeaderComponent,
    SiteFooterComponent,
    BagDrawerComponent,
    SignInModalComponent,
  ],
  imports: [SharedModule, FormsModule, ReactiveFormsModule],
  exports: [
    DemoBarComponent,
    BrandBarComponent,
    PromoBannerComponent,
    SiteHeaderComponent,
    SiteFooterComponent,
    BagDrawerComponent,
    SignInModalComponent,
  ],
})
export class CoreModule {}
