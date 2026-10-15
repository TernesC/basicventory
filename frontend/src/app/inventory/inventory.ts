import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { httpResource } from '@angular/common/http';
import { map } from 'rxjs';
import { Item, SECTIONS } from '../core/models';
import { InventoryApi } from '../core/inventory-api';
import { ResumoStore } from '../core/resumo-store';
import { ToastService } from '../core/toast.service';
import { ConfirmService } from '../core/confirm.service';
import { ItemDialogComponent } from './item-dialog';

export type ColunaOrdenavel =
  | 'nome'
  | 'quantidade'
  | 'localizacao'
  | 'serial'
  | 'patrimonio'
  | 'danificado'
  | 'atribuicao'
  | 'observacao';

export type FiltroSituacao = 'todos' | 'estoque' | 'atribuido';

const ROTULOS_COLUNA: Record<ColunaOrdenavel, string> = {
  nome: 'nome',
  quantidade: 'quantidade',
  localizacao: 'localização',
  serial: 'serial',
  patrimonio: 'patrimônio',
  danificado: 'danificado',
  atribuicao: 'atribuição',
  observacao: 'observação',
};

@Component({
  selector: 'app-inventory',
  imports: [ItemDialogComponent],
  templateUrl: './inventory.html',
})
export class InventoryComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(InventoryApi);
  private readonly resumoStore = inject(ResumoStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly secaoId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('nome') ?? 'Notebooks')),
    { initialValue: 'Notebooks' },
  );
  protected readonly secaoAtual = computed(() => this.secaoId());
  protected readonly secaoValida = computed(() => SECTIONS.some((s) => s.id === this.secaoAtual()));
  protected readonly secaoInfo = computed(() => SECTIONS.find((s) => s.id === this.secaoAtual()));

  protected readonly buscas = signal<Record<string, string>>({});
  protected readonly busca = signal('');
  protected readonly termoAtivo = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  /** Ordenação por coluna (apenas ordem, sem pesquisa). Nulo = ordem padrão do servidor. */
  protected readonly ordenacao = signal<{
    coluna: ColunaOrdenavel | null;
    direcao: 'asc' | 'desc';
  }>({ coluna: null, direcao: 'asc' });

  /** Filtro por situação: todos, em estoque (sem atribuição) ou atribuídos. */
  protected readonly filtroSituacao = signal<FiltroSituacao>('todos');

  protected readonly itens = httpResource<Item[]>(() => {
    if (!this.secaoValida()) return undefined;
    const params = new URLSearchParams({ categoria: this.secaoAtual() });
    const q = this.termoAtivo().trim();
    if (q) params.set('q', q);
    return `/api/itens?${params.toString()}`;
  });

  protected readonly carregando = computed(() => this.itens.isLoading());
  protected readonly erro = computed(() => this.itens.error());
  protected readonly mensagemErro = computed(() => {
    const e = this.itens.error() as unknown as {
      error?: { erro?: string };
      message?: string;
    } | null;
    return e?.error?.erro ?? e?.message ?? 'Erro ao buscar os dados.';
  });
  protected readonly lista = computed(() => {
    let base = this.itens.hasValue() ? [...this.itens.value()] : [];
    const filtro = this.filtroSituacao();
    if (filtro === 'estoque') {
      base = base.filter((item) => InventoryComponent.emEstoque(item.atribuicao));
    } else if (filtro === 'atribuido') {
      base = base.filter((item) => !InventoryComponent.emEstoque(item.atribuicao));
    }
    const { coluna, direcao } = this.ordenacao();
    if (!coluna) return base;
    const mult = direcao === 'asc' ? 1 : -1;
    base.sort((a, b) => {
      if (coluna === 'quantidade') return (a.quantidade - b.quantidade) * mult;
      if (coluna === 'danificado') return (Number(a.danificado) - Number(b.danificado)) * mult;
      const av = InventoryComponent.normaliza(a[coluna]);
      const bv = InventoryComponent.normaliza(b[coluna]);
      if (av < bv) return -mult;
      if (av > bv) return mult;
      return a.id - b.id;
    });
    return base;
  });
  protected readonly buscando = computed(() => this.termoAtivo().trim().length > 0);
  protected readonly filtrandoSituacao = computed(() => this.filtroSituacao() !== 'todos');
  protected readonly unidades = computed(() =>
    this.lista().reduce((acc, item) => acc + (item.quantidade || 0), 0),
  );
  protected readonly subtitulo = computed(() => {
    const n = this.lista().length;
    const u = this.unidades();
    const base = `${n} ${n === 1 ? 'item' : 'itens'} · ${u} ${u === 1 ? 'unidade' : 'unidades'}`;
    const partes: string[] = [];
    if (this.buscando()) partes.push('resultado da busca');
    const filtro = this.filtroSituacao();
    if (filtro === 'estoque') partes.push('em estoque');
    else if (filtro === 'atribuido') partes.push('atribuídos');
    const ord = this.ordenacao();
    const seta = ord.direcao === 'asc' ? '↑' : '↓';
    if (ord.coluna) partes.push(`ordenado por ${ROTULOS_COLUNA[ord.coluna]} ${seta}`);
    return partes.length > 0 ? `${base} · ${partes.join(' · ')}` : base;
  });

  protected readonly dialogAberto = signal(false);
  protected readonly editando = signal<Item | null>(null);

  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    effect(() => {
      const secao = this.secaoAtual();
      const guardado = this.buscas()[secao] ?? '';
      this.busca.set(guardado);
      this.termoAtivo.set(guardado.trim());
      // Trocar de seção limpa a ordenação e o filtro de situação.
      this.ordenacao.set({ coluna: null, direcao: 'asc' });
      this.filtroSituacao.set('todos');
    });
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  protected onSearchInput(valor: string): void {
    this.busca.set(valor);
    this.buscas.update((b) => ({ ...b, [this.secaoAtual()]: valor }));
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.termoAtivo.set(valor.trim());
    }, 250);
  }

  /** Alterna a ordenação da coluna: asc → desc → sem ordenação. */
  protected alternarOrdem(coluna: ColunaOrdenavel): void {
    const atual = this.ordenacao();
    if (atual.coluna !== coluna) {
      this.ordenacao.set({ coluna, direcao: 'asc' });
    } else if (atual.direcao === 'asc') {
      this.ordenacao.set({ coluna, direcao: 'desc' });
    } else {
      this.ordenacao.set({ coluna: null, direcao: 'asc' });
    }
  }

  protected indicadorOrdem(coluna: ColunaOrdenavel): string {
    const o = this.ordenacao();
    if (o.coluna !== coluna) return '';
    return o.direcao === 'asc' ? '▲' : '▼';
  }

  protected ariaOrdem(coluna: ColunaOrdenavel): string {
    const o = this.ordenacao();
    if (o.coluna !== coluna) return 'none';
    return o.direcao === 'asc' ? 'ascending' : 'descending';
  }

  protected definirFiltro(filtro: FiltroSituacao): void {
    this.filtroSituacao.set(filtro);
  }

  /**
   * Vermelho se danificado ou localizacao DESCARTE / ATRIBUIDO;
   * verde se localizacao ESTOQUE. Danificado tem prioridade.
   */
  protected classeNome(item: Item): string {
    if (item.danificado) return 'is-descarte';
    const norm = InventoryComponent.normaliza(item.localizacao).toUpperCase();
    if (norm.startsWith('ESTOQUE')) return 'is-estoque';
    if (norm.startsWith('DESCARTE') || norm.startsWith('ATRIBUIDO')) return 'is-descarte';
    return '';
  }

  private static normaliza(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Lê o campo Atribuição: vazio ou contendo "estoque" = em estoque;
   * qualquer outro valor preenchido = atribuído.
   */
  private static emEstoque(atribuicao: unknown): boolean {
    const norm = InventoryComponent.normaliza(atribuicao);
    if (!norm) return true;
    return norm.includes('estoque');
  }

  protected abrirNovo(): void {
    this.editando.set(null);
    this.dialogAberto.set(true);
  }

  protected editar(item: Item): void {
    this.editando.set(item);
    this.dialogAberto.set(true);
  }

  protected async excluir(item: Item): Promise<void> {
    const ok = await this.confirm.ask(
      `"${item.nome}" será removido de ${this.secaoAtual()}. Essa ação não pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      await this.api.excluirItem(item.id);
      this.toast.show('Item excluído.', 'success');
      this.itens.reload();
      this.resumoStore.reload();
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : 'Erro ao excluir o item.', 'error');
    }
  }

  protected onSalvo(categoria: string): void {
    this.dialogAberto.set(false);
    this.itens.reload();
    this.resumoStore.reload();
    if (categoria !== this.secaoAtual()) {
      void this.router.navigate(['/secao', categoria]);
    }
  }

  protected formatDate(iso: string | Date | null | undefined): string {
    if (!iso) return '';
    const d = iso instanceof Date ? iso : new Date(iso);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || this.dialogAberto() || !this.secaoValida()) return;
    const alvo = event.target as HTMLElement | null;
    if (
      alvo &&
      (alvo.tagName === 'INPUT' ||
        alvo.tagName === 'TEXTAREA' ||
        alvo.tagName === 'SELECT' ||
        alvo.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();
    const el = this.searchBox()?.nativeElement;
    el?.focus();
    el?.select();
  }
}
