import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Luhn (mod-10) check for card numbers. */
export function luhnValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = (control.value || '').replace(/[\s-]/g, '');
    if (!raw) {
      return null; // required handles empty
    }
    if (!/^\d{13,19}$/.test(raw)) {
      return { luhn: true };
    }
    let sum = 0;
    let dbl = false;
    for (let i = raw.length - 1; i >= 0; i--) {
      let d = raw.charCodeAt(i) - 48;
      if (dbl) {
        d *= 2;
        if (d > 9) {
          d -= 9;
        }
      }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0 ? null : { luhn: true };
  };
}

/** MM/YY expiry — format is enforced separately; this only rejects past dates. */
export function expiryValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec((control.value || '').trim());
    if (!m) {
      return null; // pattern validator owns bad formats
    }
    const now = new Date();
    const yy = now.getFullYear() % 100;
    const mm = now.getMonth() + 1;
    const mo = parseInt(m[1], 10);
    const y = parseInt(m[2], 10);
    return y > yy || (y === yy && mo >= mm) ? null : { expired: true };
  };
}
