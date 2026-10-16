import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { PdpComponent } from './pdp.component';

const routes: Routes = [{ path: '', component: PdpComponent }];

@NgModule({
  declarations: [PdpComponent],
  imports: [SharedModule, FormsModule, RouterModule.forChild(routes)],
})
export class ProductModule {}
