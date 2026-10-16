import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [RouterTestingModule, HttpClientTestingModule, CoreModule],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  });

  it('creates the app shell', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('always carries the not-a-Gap disclaimer bar', () => {
    expect(fixture.nativeElement.textContent).toContain('Not actually a Gap site');
  });

  it('renders the brand bar, promo banner and nav', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand-bar')).toBeTruthy();
    expect(el.textContent).toContain('Banana Republic');
    expect(el.textContent).toContain('Friends & Family');
    expect(el.textContent).toContain('Baby & Toddler');
  });
});
