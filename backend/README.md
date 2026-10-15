# Inventário · Backend (NestJS)

API do sistema de gestão de inventário. Migração do Express original (`src/`)
para NestJS com módulos, guards, DTOs validados e Swagger.

## Rodar

```bash
cd backend
npm install
npm run dev        # http://localhost:3000 (watch)
npm start          # produção (após build)
npm run build      # compila para dist/
npm run typecheck  # valida os tipos
PORT=8080 npm start
```

Variáveis de ambiente (ver `.env.example`):

| Var | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP |
| `JWT_SECRET` | `inventario-dev-secret-troque-em-producao` | Segredo do JWT |
| `JWT_EXPIRACAO` | `12h` | Expiração do token |
| `DATABASE_FILE` | `../data/inventario.sqlite` | Arquivo SQLite (mesmo do app original) |
| `DATA_DIR` | `<repo>/data` | Pasta de dados (alternativa) |

## Estrutura

```
backend/src/
├── main.ts                 # bootstrap, prefixo /api, ValidationPipe, Swagger
├── app.module.ts           # módulos + serve-static do frontend (se existir build)
├── database/               # TypeORM better-sqlite3 + função busca()
├── common/                 # filtro {erro}, CurrentUser, search utils, guard base
├── auth/                   # login/me/logout, usuários, JwtAuthGuard, seed admin
├── itens/                  # CRUD, busca, sugestões, resumo
└── logs/                   # auditoria + LogsService compartilhado
```

## API (contrato preservado do Express original)

Erros sempre no formato `{ "erro": "mensagem" }`.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/itens?categoria=Notebooks&q=texto` | Lista da seção com busca |
| GET | `/api/itens/sugestoes?q=&campo=&categoria=` | Autocomplete agrupado |
| GET | `/api/resumo` | Contagem por seção |
| GET | `/api/itens/:id` | Consulta 1 item |
| POST | `/api/itens` | Cria item |
| PUT | `/api/itens/:id` | Atualiza item |
| DELETE | `/api/itens/:id` | Exclui item |
| POST | `/api/auth/login` | Login → `{ token, usuario }` |
| GET | `/api/auth/me` | Usuário logado |
| POST | `/api/auth/logout` | Registra saída |
| GET/POST | `/api/usuarios` | Lista/cria usuários |
| DELETE | `/api/usuarios/:id` | Exclui usuário |
| GET | `/api/logs?limite=200&q=` | Auditoria |

Swagger UI: `http://localhost:3000/api/docs`

Na primeira execução cria `admin` / `admin123` automaticamente.
