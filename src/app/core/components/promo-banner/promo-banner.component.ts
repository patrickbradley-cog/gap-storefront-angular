import { Component } from '@angular/core';

@Component({
  selector: 'app-promo-banner',
  template: `
    <a class="promo" routerLink="/browse/women/new-arrivals">
      <span class="promo__headline">Friends &amp; Family</span>
      <span class="promo__sub">40% off everything</span>
      <span class="promo__fine">Online &amp; in stores. Exclusions apply.</span>
      <span class="promo__details">Details</span>
    </a>
  `,
  styles: [
    `
      @use 'tokens' as t;
      .promo {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
        background: t.$gap-blue;
        color: t.$white;
        text-decoration: none;
        padding: 10px 16px;
        text-align: center;

        &__headline {
          font-size: t.$fs-16;
          font-weight: 700;
        }

        &__sub {
          font-size: t.$fs-14;
          font-weight: 700;
        }

        &__fine {
          font-size: t.$fs-12;
          opacity: 0.85;
        }

        &__details {
          font-size: t.$fs-12;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      }
      @media (max-width: 640px) {
        .promo {
          flex-direction: column;
          gap: 2px;
          align-items: center;
          padding: 8px;
        }
      }
    `,
  ],
})
export class PromoBannerComponent {}
