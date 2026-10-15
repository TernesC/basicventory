import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast {{ t.tipo }}">{{ t.mensagem }}</div>
      }
    </div>
  `,
})
export class ToastsComponent {
  protected readonly toastService = inject(ToastService);
}
