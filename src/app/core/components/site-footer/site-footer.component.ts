import { Component } from '@angular/core';

interface FooterCol {
  title: string;
  links: string[];
}

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.component.html',
  styleUrls: ['./site-footer.component.scss'],
})
export class SiteFooterComponent {
  cols: FooterCol[] = [
    {
      title: 'Our Brands',
      links: ['Gap', 'Gap Factory', 'Old Navy', 'Banana Republic', 'Athleta'],
    },
    {
      title: 'Customer Service',
      links: ['Help', 'Order Status', 'Returns', 'Shipping', 'Size Charts', 'Gift Cards'],
    },
    {
      title: 'About Us',
      links: ['Our Story', 'Careers', 'Sustainability', 'Gap Inc. for Good', 'Press'],
    },
    {
      title: 'Legal',
      links: [
        'Privacy Policy',
        'Terms of Use',
        'CA Privacy Rights',
        'Accessibility',
        'Do Not Sell',
      ],
    },
  ];
}
