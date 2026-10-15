# Inventário · Gestão de Equipamentos — Documentação do Software

Sistema de gestão de inventário de equipamentos (notebooks, desktops, celulares,
periféricos etc.), com controle de quantidade, localização, serial, patrimônio,
estado de conservação, atribuição a pessoas/setores e auditoria de ações.

## 1. Visão geral

| Aspecto | Descrição |
| --- | --- |
| Backend | NestJS 11 + TypeORM + SQLite (`better-sqlite3`), API REST sob `/api`, Swagger em `/api/docs` |
| Frontend | Angular 22 standalone (signals, `httpResource`, signal forms), servido pelo próprio backend em produção |
| Banco | SQLite em arquivo (`data/inventario.sqlite`), schema criado automaticamente (`synchronize: true`) |
| Auth | Login com usuário/senha (hash bcrypt), sessão via JWT (`Authorization: Bearer`) |
| Distribuição | Imagem Docker única (`Dockerfile` na raiz): frontend + backend na porta 3000 |

Seções fixas do inventário: **Notebooks · Desktops · Celulares · Periféricos ·
Outros · Descarte**.

## 2. Arquitetura

```
┌─────────────┐      HTTP       ┌───────────────────────────────┐
│   Angular   │ ─────────────▶ │  NestJS (porta 3000)          │
│  (browser)  │  /api/* (JSON) │  /api/* → controllers         │
└─────────────┘                │  /*    → index.html (SPA)     │
                               └───────────────┬───────────────┘
                                               │ TypeORM
                                               ▼
                                    ┌─────────────────────┐
                                    │ SQLite (arquivo)    │
                                    │ data/inventario…    │
                                    └─────────────────────┘
```

- Em **desenvolvimento**, o frontend roda em `http://localhost:4200` (`ng serve`)
  e repassa `/api` ao backend em `:3000` via `frontend/proxy.conf.json`.
- Em **produção/Docker**, o backend serve o build Angular (`frontend/dist/…`)
  via `serve-static` + fallback da SPA para `/secao/…`, `/config` e `/login`
  (`backend/src/app.module.ts`, `backend/src/main.ts`).
- Erros da API seguem sempre o contrato `{ "erro": "mensagem" }`
  (`backend/src/common/api-exception.filter.ts`).

## 3. Pré-requisitos

- Node.js `^22.22.3 || ^24.15.0 || >=26` (exigência do Angular 22).
- npm (lockfiles em `backend/package-lock.json` e `frontend/package-lock.json`).
- Para a imagem: Docker Desktop / Engine 24+.

## 4. Como rodar

### 4.1 Desenvolvimento (backend + frontend separados)

```bash
cd backend && npm install && npm run dev     # API em http://localhost:3000
cd frontend && npm install && npm start      # SPA em http://localhost:4200
```

### 4.2 Produção local (sem Docker)

```bash
cd frontend && npm install && npm run build  # gera frontend/dist/…
cd ../backend && npm install && npm run build
npm run start:prod                            # serve API + SPA em :3000
```

### 4.3 Docker (recomendado)

```bash
docker build -t inventario .
docker run -d --name inventario -p 3000:3000 \
  -e JWT_SECRET=troque-por-um-segredo-forte \
  -v inventario-data:/app/data inventario
```

- Acesse `http://localhost:3000` (SPA) e `http://localhost:3000/api/docs` (Swagger).
- O banco SQLite persiste no volume `inventario-data` (`/app/data`).
- O container possui `HEALTHCHECK` sobre `GET /api/auth/me`.

## 5. Configuração (variáveis de ambiente)

Ver `backend/.env.example`:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend |
| `JWT_SECRET` | `inventario-dev-secret-troque-em-producao` (só dev) | Segredo de assinatura do JWT — **obrigatório em produção** (`NODE_ENV=production` sem ele = boot recusado) |
| `JWT_EXPIRACAO` | `12h` | Validade do token |
| `DATABASE_FILE` | `<repo>/data/inventario.sqlite` | Caminho do arquivo SQLite |
| `DATA_DIR` | `<repo>/data` (ou `/app/data` no Docker) | Pasta de dados (alternativa a `DATABASE_FILE`) |

## 6. Banco de dados

- SQLite + TypeORM, entidades em `backend/src/auth/user.entity.ts`,
  `backend/src/itens/item.entity.ts` e `backend/src/logs/audit-log.entity.ts`.
- Tabelas: `usuarios`, `itens`, `logs`.
- Busca sem acento/caixa via função SQL `busca()` registrada na conexão
  (`backend/src/database/database.module.ts` + `backend/src/common/search.util.ts`).
- Para recriar do zero: pare o servidor e apague `data/inventario.sqlite`.
  Na primeira execução, o usuário `admin` / `admin123` é criado automaticamente
  (`backend/src/auth/auth.service.ts`).

## 7. Autenticação e usuários

- Login em `/login` → `POST /api/auth/login` devolve `{ token, usuario }`;
  o token vai no header `Authorization: Bearer <token>` (interceptor Angular).
- Rotas do app são protegidas por `authGuard`; 401 global desloga e volta ao login.
- Senhas com hash bcrypt (custo 10). Usuário: 3–60 caracteres
  (letras, números, ponto, `_`, `-`); senha: 4–100 caracteres.
- Regras de exclusão: não é possível excluir o próprio usuário nem o último
  usuário do sistema.
- Recomenda-se criar um usuário próprio em **Configurações → Usuários** e
  excluir o `admin` inicial.

## 8. Referência da API

Base: `http://localhost:3000/api`. Todas as rotas (exceto login) exigem JWT.

### Itens

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/itens?categoria=Notebooks&q=texto` | Lista itens da seção; `q` busca parcial (sem acento/caixa) em nome, localização, serial, patrimônio, atribuição e observação |
| GET | `/api/itens/sugestoes?q=termo&campo=nome\|localizacao&categoria=Seção` | Autocomplete agrupado (mín. 2 letras; categoria só prioriza) |
| GET | `/api/itens/:id` | Consulta um item |
| POST | `/api/itens` | Cria item |
| PUT | `/api/itens/:id` | Atualiza item (enviar objeto completo) |
| DELETE | `/api/itens/:id` | Exclui item |
| GET | `/api/resumo` | Contagem de itens e unidades por seção + totais |

### Auth / usuários / logs

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ username, senha }` → `{ token, usuario }` |
| GET | `/api/auth/me` | Dados do usuário logado |
| POST | `/api/auth/logout` | Registra a saída (token descartado no cliente) |
| GET | `/api/usuarios` | Lista usuários (sem hash) |
| POST | `/api/usuarios` | Cria usuário `{ username, senha }` |
| DELETE | `/api/usuarios/:id` | Exclui usuário (com travas de segurança) |
| GET | `/api/logs?limite=200&q=texto` | Auditoria, mais recentes primeiro (`limite` 1–500) |

Exemplo:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","senha":"admin123"}' | jq -r .token)

curl -s "http://localhost:3000/api/itens?categoria=Notebooks" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## 9. Campos do item e regras

| Campo | Obrigatório | Limites / regras |
| --- | --- | --- |
| Nome do Item | Sim | texto, 1–150 caracteres |
| Quantidade | Não (padrão 1) | inteiro 0–100000 |
| Seção (`categoria`) | Sim | uma das 6 seções fixas (aceita sem acento/caixa, ex. `perifericos`) |
| Localização | Não | texto até 150 |
| Serial | Não | texto até 100 |
| Patrimônio | Não | texto até 100 |
| Danificado | Não (padrão Não) | Sim/Não (aceita `sim/s/true/1` e afins) |
| Atribuição | Não | texto até 150 (pessoa/setor ou `estoque`) |
| Observação | Não | texto até 2000 |

## 10. Frontend — telas e comportamento

| Rota | Tela |
| --- | --- |
| `/login` | Acesso (form com validação; dica inicial `admin`/`admin123`) |
| `/secao/:nome` | Inventário da seção (padrão: `Notebooks`) |
| `/config` | Configurações: aparência, usuários e logs |

- **Busca por seção (lazy):** os itens só são carregados ao entrar na seção;
  o termo é lembrado ao trocar de seção (debounce de 250 ms).
- **Filtro por situação** (entre a busca e “Adicionar item”): `Todos`, `Em estoque`
  e `Atribuídos`, lido do campo **Atribuição** — vazio ou contendo `estoque`
  (sem acento/caixa, ex. `Em Estoque - Prateleira 2`) = em estoque; qualquer
  outro valor = atribuído. Combina com busca e ordenação.
- **Ordenação:** clique no cabeçalho alterna asc → desc → padrão do servidor.
- **Autocomplete:** nos campos Nome e Localização, com 2+ letras sugere valores
  já cadastrados (mouse ou setas + Enter preenchem só aquele campo).
- **Aparência:** temas Claro, Escuro, Oceano e Personalizado (salvos no navegador).
- **Logs:** filtro por texto e limite de 100/200/500 registros.
- Atalhos: `/` foca a busca; `Escape` fecha diálogos.

## 11. Auditoria (logs)

Toda ação relevante gera um registro em `logs` (tabela + tela em Configurações):
`login`, `login.falha`, `logout`, `sistema` (criação do admin),
`usuario.criar`, `usuario.excluir`, `item.criar`, `item.editar`, `item.excluir`.
O registro nunca quebra o fluxo principal (falha de log é só impressa no console).

## 12. Estrutura de pastas

```
inventario2/
├── Dockerfile / .dockerignore        # imagem única (frontend + backend)
├── DOCUMENTACAO.md                   # este arquivo
├── data/                             # SQLite local (criado na 1ª execução)
├── backend/src/
│   ├── main.ts                       # bootstrap, /api, ValidationPipe, Swagger
│   ├── app.module.ts                 # módulos + serve-static do frontend
│   ├── database/                     # TypeORM better-sqlite3 + função busca()
│   ├── common/                       # filtro {erro}, CurrentUser, search utils
│   ├── auth/                         # login/me/logout, usuários, JwtAuthGuard
│   ├── itens/                        # CRUD, busca, sugestões, resumo
│   └── logs/                         # auditoria
├── frontend/src/
│   ├── index.html / main.ts / styles.css
│   └── app/
│       ├── app.ts / app.routes.ts / app.config.ts
│       ├── core/                     # models, auth-data, inventory-api,
│       │                             # resumo-store, theme, toast, confirm,
│       │                             # interceptor, guard
│       ├── login/ · shell/ · inventory/ · settings/
├── src/ + public/                    # app original (Express + HTML puro),
│                                     # mantido como referência da migração
└── package.json + tsconfig.json      # scripts do stack original (raiz)
```

> `src/` + `public/` + scripts da raiz correspondem ao aplicativo original e
> servem de referência; o stack atual é `backend/` + `frontend/`.

## 13. Scripts disponíveis

| Pasta | Comando | Efeito |
| --- | --- | --- |
| `backend` | `npm run dev` | API com watch em `:3000` |
| `backend` | `npm run build` / `npm run start:prod` | Compila p/ `dist/` / roda produção (`node dist/main`) |
| `backend` | `npm run typecheck` | Valida tipos sem emitir |
| `frontend` | `npm start` | SPA em `:4200` com proxy `/api → :3000` |
| `frontend` | `npm run build` | Build de produção em `dist/` |
| `frontend` | `npm run typecheck` | Valida tipos (build valida templates) |

## 14. Solução de problemas

| Sintoma | Causa provável / ação |
| --- | --- |
| `401` ou volta ao login | Token ausente/expirado — faça login novamente |
| “Não foi possível carregar os itens” | Backend fora do ar ou `DATABASE_FILE` inacessível — use “Tentar novamente” |
| Porta 3000 ocupada | Outro processo/DB lock — pare o outro serviço ou use `PORT=8080` |
| `JWT_SECRET` padrão | Defina um segredo forte via env em qualquer ambiente real |
| Recomeçar do zero | Pare tudo e apague `data/inventario.sqlite` (recria `admin`/`admin123`) |
| Docker: `ports are not available` | Host já usa a porta — mapeie outra (ex. `-p 3100:3000`) |
