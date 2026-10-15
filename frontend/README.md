# Inventário · Frontend (Angular 22)

Port do frontend vanilla (`public/`) para Angular 22 standalone com
signals, `httpResource` e signal forms.

> **Pré-requisito:** Node `^22.22.3 || ^24.15.0 || >=26` (o Angular 22 não
> instala/compila no Node 22.19). Atualize o Node e rode:

```bash
cd frontend
npm install
npm start            # http://localhost:4200 (proxy /api → :3000)
npm run build        # build de produção em dist/
npm run typecheck    # tsc --noEmit (não valida templates; o build valida)
```

## Estrutura

```
frontend/src/
├── index.html / main.ts / styles.css   # estilos portados 1:1 do original
└── app/
    ├── app.ts / app.routes.ts / app.config.ts
    ├── core/            # models, auth-data, inventory-api, resumo-store,
    │                    # theme, toast, confirm, interceptor, guard
    ├── login/           # signal form de acesso
    ├── shell/           # layout + sidebar + nav + stats
    ├── inventory/       # seção: busca lazy, tabela, estados, item-dialog
    │                    # (signal form + autocomplete nome/localização)
    └── settings/        # aparência, usuários, logs
```

## Rotas

| Rota | Tela |
| --- | --- |
| `/login` | Acesso |
| `/secao/:nome` | Inventário da seção (padrão: Notebooks) |
| `/config` | Configurações (temas, usuários, logs) |

O backend NestJS serve o build automaticamente quando
`frontend/dist/frontend/browser/index.html` existe (via serve-static).
