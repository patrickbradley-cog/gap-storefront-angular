import { Component } from '@angular/core';

interface BrandLink {
  label: string;
  active: boolean;
}

// Mirrors the black multi-brand strip on gap.com (46px, 12px links, #999 inactive).
@Component({
  selector: 'app-brand-bar',
  template: `
    <nav class="brand-bar" aria-label="Gap Inc brands">
      <a
        *ngFor="let b of brands"
        href="#"
        class="brand-bar__link"
        [class.brand-bar__link--active]="b.active"
        [attr.aria-current]="b.active ? 'true' : null"
        (click)="$event.preventDefault()"
      >
        {{ b.label }}
      </a>
      <div class="brand-bar__right">
        <a href="#" class="brand-bar__link" (click)="$event.preventDefault()">United States</a>
      </div>
    </nav>
  `,
  styles: [
    `
      @use 'tokens' as t;
      .brand-bar {
        display: flex;
        align-items: stretch;
        height: t.$header-h;
        background: t.$black;
        border-bottom: 1px solid t.$gray-200;

        &__link {
          display: inline-flex;
          align-items: center;
          padding: 0 16px;
          min-height: t.$tap-target;
          color: t.$gray-999;
          font-size: t.$fs-12;
          letter-spacing: t.$ls-brand;
          text-decoration: none;

          &--active {
            color: t.$white;
          }

          &:hover {
            color: t.$white;
          }
        }

        &__right {
          margin-left: auto;
          display: flex;
        }
      }
      @media (max-width: 640px) {
        .brand-bar {
          overflow-x: auto;
          &__right {
            display: none;
          }
        }
      }
    `,
  ],
})
export class BrandBarComponent {
  brands: BrandLink[] = [
    { label: 'Gap', active: true },
    { label: 'Gap Factory', active: false },
    { label: 'Old Navy', active: false },
    { label: 'Banana Republic', active: false },
    { label: 'Athleta', active: false },
  ];
}
