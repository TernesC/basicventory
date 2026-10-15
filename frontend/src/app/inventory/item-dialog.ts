import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { Item, SECTIONS, Sugestao } from '../core/models';
import { InventoryApi } from '../core/inventory-api';
import { ToastService } from '../core/toast.service';

interface ItemModel {
  nome: string;
  quantidade: number;
  categoria: string;
  localizacao: string;
  serial: string;
  patrimonio: string;
  danificadoStr: string;
  atribuicao: string;
  observacao: string;
}

type CampoSugestao = 'nome' | 'localizacao';

const ERROS_PT: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

@Component({
  selector: 'app-item-dialog',
  imports: [FormField],
  templateUrl: './item-dialog.html',
})
export class ItemDialogComponent implements OnInit, OnDestroy {
  readonly item = input<Item | null>(null);
  readonly secaoAtual = input<string>('Notebooks');
  readonly fechado = output<void>();
  readonly salvo = output<string>();

  private readonly api = inject(InventoryApi);
  private readonly toast = inject(ToastService);

  protected readonly sections = SECTIONS;

  protected readonly model = signal<ItemModel>({
    nome: '',
    quantidade: 1,
    categoria: 'Notebooks',
    localizacao: '',
    serial: '',
    patrimonio: '',
    danificadoStr: 'nao',
    atribuicao: '',
    observacao: '',
  });

  protected readonly itemForm = form(this.model, (s) => {
    required(s.nome, { message: 'Informe o Nome do Item.' });
    maxLength(s.nome, 150, { message: 'Nome do Item deve ter até 150 caracteres.' });
    min(s.quantidade, 0);
    max(s.quantidade, 100000);
    required(s.categoria);
    maxLength(s.localizacao, 150);
    maxLength(s.serial, 100);
    maxLength(s.patrimonio, 100);
    maxLength(s.atribuicao, 150);
    maxLength(s.observacao, 2000);
  });

  protected readonly erro = signal('');
  protected readonly salvando = signal(false);

  protected readonly nomeLista = signal<Sugestao[]>([]);
  protected readonly nomeIndice = signal(-1);
  protected readonly locLista = signal<Sugestao[]>([]);
  protected readonly locIndice = signal(-1);
  private nomeTimer: ReturnType<typeof setTimeout> | null = null;
  private locTimer: ReturnType<typeof setTimeout> | null = null;
  private nomeSeq = 0;
  private locSeq = 0;

  private readonly quantInput = viewChild<ElementRef<HTMLInputElement>>('quantInput');
  private readonly serialInput = viewChild<ElementRef<HTMLInputElement>>('serialInput');

  ngOnInit(): void {
    const atual = this.item();
    this.model.set({
      nome: atual?.nome ?? '',
      quantidade: atual?.quantidade ?? 1,
      categoria: atual?.categoria ?? this.secaoAtual(),
      localizacao: atual?.localizacao ?? '',
      serial: atual?.serial ?? '',
      patrimonio: atual?.patrimonio ?? '',
      danificadoStr: atual ? (atual.danificado ? 'sim' : 'nao') : 'nao',
      atribuicao: atual?.atribuicao ?? '',
      observacao: atual?.observacao ?? '',
    });
  }

  ngOnDestroy(): void {
    if (this.nomeTimer) clearTimeout(this.nomeTimer);
    if (this.locTimer) clearTimeout(this.locTimer);
  }

  protected onSubmit(): void {
    this.erro.set('');
    submit(this.itemForm, async () => {
      const m = this.model();
      const payload = {
        nome: m.nome.trim(),
        quantidade: Number(m.quantidade) || 0,
        categoria: m.categoria,
        localizacao: m.localizacao.trim(),
        serial: m.serial.trim(),
        patrimonio: m.patrimonio.trim(),
        danificado: m.danificadoStr === 'sim',
        atribuicao: m.atribuicao.trim(),
        observacao: m.observacao.trim(),
      };
      this.salvando.set(true);
      try {
        const atual = this.item();
        if (atual) {
          await this.api.atualizarItem(atual.id, payload);
          this.toast.show('Item atualizado com sucesso.', 'success');
        } else {
          await this.api.criarItem(payload);
          this.toast.show('Item adicionado com sucesso.', 'success');
        }
        this.salvo.emit(payload.categoria);
      } catch (err) {
        this.erro.set(err instanceof Error ? err.message : 'Erro ao salvar o item.');
      } finally {
        this.salvando.set(false);
      }
    });
  }

  protected onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.fechado.emit();
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.fechado.emit();
  }

  protected onCategoriaChange(): void {
    setTimeout(() => {
      if (this.nomeLista().length > 0) this.buscarSugestoes('nome');
      if (this.locLista().length > 0) this.buscarSugestoes('localizacao');
    }, 0);
  }

  // ------------------------- autocomplete -------------------------

  protected agendaSugestao(campo: CampoSugestao): void {
    if (campo === 'nome') {
      if (this.nomeTimer) clearTimeout(this.nomeTimer);
      this.nomeTimer = setTimeout(() => this.buscarSugestoes('nome'), 200);
    } else {
      if (this.locTimer) clearTimeout(this.locTimer);
      this.locTimer = setTimeout(() => this.buscarSugestoes('localizacao'), 200);
    }
  }

  private async buscarSugestoes(campo: CampoSugestao): Promise<void> {
    const valor = (campo === 'nome' ? this.model().nome : this.model().localizacao).trim();
    if (valor.length < 2) {
      this.esconde(campo);
      return;
    }
    const seq = campo === 'nome' ? ++this.nomeSeq : ++this.locSeq;
    try {
      const lista = await this.api.sugestoes(valor, campo, this.model().categoria);
      const atual = campo === 'nome' ? this.nomeSeq : this.locSeq;
      if (seq !== atual) return;
      if (campo === 'nome') {
        this.nomeLista.set(lista);
        this.nomeIndice.set(-1);
      } else {
        this.locLista.set(lista);
        this.locIndice.set(-1);
      }
    } catch {
      const atual = campo === 'nome' ? this.nomeSeq : this.locSeq;
      if (seq === atual) this.esconde(campo);
    }
  }

  private esconde(campo: CampoSugestao): void {
    if (campo === 'nome') {
      this.nomeLista.set([]);
      this.nomeIndice.set(-1);
    } else {
      this.locLista.set([]);
      this.locIndice.set(-1);
    }
  }

  protected onSugestaoKeydown(event: KeyboardEvent, campo: CampoSugestao): void {
    const lista = campo === 'nome' ? this.nomeLista() : this.locLista();
    if (lista.length === 0) return;
    const indice = campo === 'nome' ? this.nomeIndice : this.locIndice;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const dir = event.key === 'ArrowDown' ? 1 : -1;
      indice.update((i) => (i + dir + lista.length) % lista.length);
    } else if (event.key === 'Enter' && indice() >= 0) {
      event.preventDefault();
      this.escolher(indice(), campo);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      this.esconde(campo);
    }
  }

  protected escolher(i: number, campo: CampoSugestao): void {
    const sug = (campo === 'nome' ? this.nomeLista() : this.locLista())[i];
    if (!sug) return;
    if (campo === 'nome') {
      this.model.update((m) => ({ ...m, nome: sug.valor }));
      this.esconde('nome');
      const el = this.quantInput()?.nativeElement;
      el?.focus();
      el?.select();
    } else {
      this.model.update((m) => ({ ...m, localizacao: sug.valor }));
      this.esconde('localizacao');
      this.serialInput()?.nativeElement.focus();
    }
  }

  protected metaNome(s: Sugestao): string {
    return s.repeticoes > 1 ? `${s.categoria} · ${s.repeticoes} cadastrados` : s.categoria;
  }

  protected metaLoc(s: Sugestao): string {
    return `${s.categoria} · em ${s.repeticoes} ${s.repeticoes === 1 ? 'item' : 'itens'}`;
  }

  protected destaque(texto: string, termo: string): string {
    const t = (termo ?? '').trim();
    if (!t) return ItemDialogComponent.esc(texto);
    const pos = texto.toLowerCase().indexOf(t.toLowerCase());
    if (pos < 0) return ItemDialogComponent.esc(texto);
    return (
      ItemDialogComponent.esc(texto.slice(0, pos)) +
      '<mark>' +
      ItemDialogComponent.esc(texto.slice(pos, pos + t.length)) +
      '</mark>' +
      ItemDialogComponent.esc(texto.slice(pos + t.length))
    );
  }

  private static esc(value: string): string {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ERROS_PT[ch] ?? ch);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const alvo = event.target as HTMLElement | null;
    if (!alvo?.closest?.('.autocomplete')) {
      this.esconde('nome');
      this.esconde('localizacao');
    }
  }
}
