import { Directive, ElementRef, HostListener, Input } from '@angular/core';

// Generic Unsplash apparel fallbacks — used only when a hotlinked image fails.
const FALLBACKS = [
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80&auto=format&fit=crop',
];

/**
 * appImgFallback — swap to a deterministic Unsplash image if the primary
 * (hotlinked) src fails to load.
 */
@Directive({ selector: 'img[appImgFallback]' })
export class ImgFallbackDirective {
  @Input() appImgFallback = '';
  private failed = false;

  constructor(private el: ElementRef<HTMLImageElement>) {}

  @HostListener('error')
  onError(): void {
    if (this.failed) {
      return;
    }
    this.failed = true;
    const seed = this.appImgFallback || this.el.nativeElement.alt || 'gap';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    this.el.nativeElement.src = FALLBACKS[hash % FALLBACKS.length];
  }
}
