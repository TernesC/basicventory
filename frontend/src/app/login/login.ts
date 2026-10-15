import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { AuthData } from '../core/auth-data';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-login',
  imports: [FormField],
  templateUrl: './login.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthData);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly model = signal({ username: '', senha: '' });

  protected readonly loginForm = form(this.model, (s) => {
    required(s.username, { message: 'Informe o usuário.' });
    required(s.senha, { message: 'Informe a senha.' });
  });

  protected readonly erro = signal('');
  protected readonly entrando = signal(false);

  protected onSubmit(): void {
    submit(this.loginForm, async () => {
      this.erro.set('');
      this.entrando.set(true);
      try {
        const usuario = await this.auth.login(this.model().username.trim(), this.model().senha);
        this.toast.show(`Bem-vindo(a), ${usuario.username}!`, 'success');
        await this.router.navigate(['/']);
      } catch (e) {
        this.erro.set(e instanceof Error ? e.message : 'Não foi possível entrar.');
      } finally {
        this.entrando.set(false);
      }
    });
  }
}
