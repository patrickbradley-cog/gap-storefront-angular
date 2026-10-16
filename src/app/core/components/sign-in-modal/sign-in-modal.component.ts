import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sign-in-modal',
  templateUrl: './sign-in-modal.component.html',
  styleUrls: ['./sign-in-modal.component.scss'],
})
export class SignInModalComponent {
  open$ = this.auth.modalOpen$;
  submitted = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(private auth: AuthService, private fb: FormBuilder) {}

  close(): void {
    this.auth.closeModal();
  }

  submit(): void {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }
    this.auth.signIn(this.form.value.email as string);
    this.form.reset();
    this.submitted = false;
  }

  invalid(field: 'email' | 'password'): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && (c.touched || this.submitted);
  }
}
