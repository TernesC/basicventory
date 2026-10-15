import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastsComponent } from './core/toasts.component';
import { ConfirmDialogComponent } from './core/confirm-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastsComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
})
export class App {}
