import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const KEY = 'gap-storefront.user';

export interface User {
  email: string;
  firstName: string;
}

/** Mock sign-in: any e-mail + password (>= 6 chars) "authenticates". */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly user$ = new BehaviorSubject<User | null>(this.load());
  readonly user = this.user$.asObservable();
  readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  signIn(email: string): void {
    const firstName = email.split('@')[0].replace(/^\w/, (c) => c.toUpperCase());
    const user = { email, firstName };
    this.user$.next(user);
    try {
      localStorage.setItem(KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    this.modalOpen$.next(false);
  }

  signOut(): void {
    this.user$.next(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  openModal(): void {
    this.modalOpen$.next(true);
  }

  closeModal(): void {
    this.modalOpen$.next(false);
  }

  private load(): User | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
