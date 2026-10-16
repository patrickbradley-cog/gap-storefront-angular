import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { CheckoutComponent } from './checkout.component';
import { ConfirmationComponent } from './confirmation.component';

const routes: Routes = [
  { path: '', component: CheckoutComponent },
  { path: 'confirmation', component: ConfirmationComponent },
];

@NgModule({
  declarations: [CheckoutComponent, ConfirmationComponent],
  imports: [SharedModule, ReactiveFormsModule, RouterModule.forChild(routes)],
})
export class CheckoutModule {}
