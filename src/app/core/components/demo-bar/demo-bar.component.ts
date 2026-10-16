import { Component } from '@angular/core';

@Component({
  selector: 'app-demo-bar',
  template: `
    <div class="demo-bar" role="note">
      Not actually a Gap site — internal demo only, not affiliated with, endorsed by, or a real Gap
      product.
    </div>
  `,
  styles: [
    `
      @use 'tokens' as t;
      .demo-bar {
        background: #6b21a8;
        color: t.$white;
        font-size: t.$fs-11;
        line-height: 1.3;
        text-align: center;
        padding: 4px 12px;
        letter-spacing: 0.2px;
      }
    `,
  ],
})
export class DemoBarComponent {}
