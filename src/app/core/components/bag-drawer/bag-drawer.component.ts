import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BagStore } from '../../services/bag-store.service';

@Component({
  selector: 'app-bag-drawer',
  templateUrl: './bag-drawer.component.html',
  styleUrls: ['./bag-drawer.component.scss'],
})
export class BagDrawerComponent {
  lines$ = this.bag.lines$;
  open$ = this.bag.drawerOpen;
  quote$ = this.bag.quote$;

  constructor(private bag: BagStore, private router: Router) {}

  close(): void {
    this.bag.closeDrawer();
  }

  goToBag(): void {
    this.close();
    this.router.navigate(['/bag']);
  }

  checkout(): void {
    this.close();
    this.router.navigate(['/checkout']);
  }

  remove(key: string): void {
    this.bag.remove(key);
  }
}
