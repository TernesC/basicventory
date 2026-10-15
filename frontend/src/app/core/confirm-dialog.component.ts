import { Component, HostListener, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.confirm.state()?.aberto) {
      this.confirm.confirm(false);
    }
  }
}
