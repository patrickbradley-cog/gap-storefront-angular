import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService, User } from '../../services/auth.service';
import { BagStore } from '../../services/bag-store.service';

interface NavEntry {
  label: string;
  route: string[];
}

@Component({
  selector: 'app-site-header',
  templateUrl: './site-header.component.html',
  styleUrls: ['./site-header.component.scss'],
})
export class SiteHeaderComponent implements OnInit, OnDestroy {
  readonly nav: NavEntry[] = [
    { label: 'Women', route: ['/browse/women'] },
    { label: 'Men', route: ['/browse/men'] },
    { label: 'Girls', route: ['/browse/girls'] },
    { label: 'Boys', route: ['/browse/boys'] },
    { label: 'Baby & Toddler', route: ['/browse/baby'] },
    { label: 'Accessories', route: ['/browse/men/accessories'] },
    { label: 'GapX', route: ['/browse/men'] },
  ];

  itemCount$ = this.bag.itemCount$;
  user$: Observable<User | null> = this.auth.user;
  mobileNavOpen = false;
  accountMenuOpen = false;
  searchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(private bag: BagStore, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.user$.pipe(takeUntil(this.destroy$)).subscribe(() => (this.accountMenuOpen = false));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  bagCountClick(): void {
    this.bag.openDrawer();
  }

  onSearch(): void {
    const q = this.searchTerm.trim();
    if (q) {
      this.router.navigate(['/browse'], { queryParams: { q } });
      this.mobileNavOpen = false;
    }
  }

  toggleMobileNav(): void {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  openSignIn(): void {
    this.auth.openModal();
    this.accountMenuOpen = false;
  }

  signOut(): void {
    this.auth.signOut();
    this.accountMenuOpen = false;
  }
}
