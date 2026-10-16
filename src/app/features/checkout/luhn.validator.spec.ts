import { FormControl } from '@angular/forms';
import { luhnValidator } from './luhn.validator';

describe('luhnValidator', () => {
  const v = luhnValidator();

  it('accepts a valid card number', () => {
    expect(v(new FormControl('4111111111111111'))).toBeNull();
  });

  it('accepts valid numbers with spaces/dashes', () => {
    expect(v(new FormControl('4111 1111 1111 1111'))).toBeNull();
    expect(v(new FormControl('4111-1111-1111-1111'))).toBeNull();
  });

  it('rejects a bad check digit', () => {
    expect(v(new FormControl('4111111111111112'))).toEqual({ luhn: true });
  });

  it('rejects non-numeric and too-short input', () => {
    expect(v(new FormControl('4111abcd'))).toEqual({ luhn: true });
    expect(v(new FormControl('42'))).toEqual({ luhn: true });
  });

  it('ignores empty values (required handles those)', () => {
    expect(v(new FormControl(''))).toBeNull();
  });
});
