import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ConfirmationComponent } from './confirmation.component';
import { OrderDraftService } from './order-draft.service';

describe('ConfirmationComponent', () => {
  let fixture: ComponentFixture<ConfirmationComponent>;

  beforeEach(async () => {
    const orders = jasmine.createSpyObj<OrderDraftService>('OrderDraftService', ['save'], {
      last: { orderNumber: 'GAP-12345678', email: 'ada@example.com', total: 51.19, itemCount: 1 },
    });

    await TestBed.configureTestingModule({
      declarations: [ConfirmationComponent],
      imports: [RouterTestingModule],
      providers: [{ provide: OrderDraftService, useValue: orders }],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationComponent);
    fixture.detectChanges();
  });

  it('shows the order number', () => {
    expect(fixture.nativeElement.textContent).toContain('GAP-12345678');
  });
});
