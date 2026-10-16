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
