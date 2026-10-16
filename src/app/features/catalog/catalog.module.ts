import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { PlpComponent } from './plp.component';

const routes: Routes = [{ path: '', component: PlpComponent }];

@NgModule({
  declarations: [PlpComponent],
  imports: [SharedModule, FormsModule, RouterModule.forChild(routes)],
})
export class CatalogModule {}
