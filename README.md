# Inventário · Gestão de Equipamentos

Monorepo:

- `backend/` — API em **NestJS** (migrado do Express original em `src/`).
  Ver [backend/README.md](backend/README.md). Swagger em `/api/docs`.
- `frontend/` — SPA em **Angular 22** (port do `public/` vanilla). Ver
  [frontend/README.md](frontend/README.md). Requer Node atualizado
  (`^22.22.3 || ^24.15.0 || >=26`).
- `src/` + `public/` — app original (Express + HTML puro), mantido como
  referência até a migração ser validada em produção.

## Rodar o novo stack

```bash
cd backend && npm install && npm run dev     # http://localhost:3000
cd frontend && npm install && npm start      # http://localhost:4200
```

O banco é o mesmo: `data/inventario.sqlite` (usuário inicial
`admin` / `admin123`).

---

Software simples de gestão de inventário com seções fixas, busca por seção e
cadastro completo de itens. Backend em **Express + TypeORM + SQLite**, frontend
em HTML/CSS/JS puro (servido pelo próprio backend).

## Seções

Notebooks · Desktops · Celulares · Periféricos · Outros · Descarte

Cada seção possui campo de busca próprio (o termo é lembrado ao trocar de seção)
e botão **Adicionar item**.

## Acesso

O sistema exige login. Na primeira execução é criado automaticamente:

- usuário: `admin` · senha: `admin123`

Entre em **Configurações → Usuários** para criar outros acessos (só usuário
e senha) e, se quiser, excluir o `admin`. O próprio usuário não pode se
excluir, nem o último usuário do sistema.

## Configurações (seção ⚙️ no menu)

- **Aparência:** 3 temas prontos — Claro, Escuro e Oceano — mais o
  **Personalizado**, onde você ajusta cor principal, fundo, cartões e menu
  lateral. A escolha fica salva no navegador.
- **Usuários:** lista, cria (usuário + senha) e exclui usuários.
- **Logs:** auditoria de login, criação/edição/exclusão de itens e
  criação/exclusão de usuários, com filtro por texto e limite de 100/200/500.

## Busca por seção (lazy)

Os itens de uma seção só são buscados ao **entrar nela** (ou ao pesquisar,
tentar de novo ou após salvar/excluir). Se a busca falhar ou demorar mais
que 15 segundos, aparece uma tela de erro com botão **Tentar novamente** —
o "Carregando itens…" nunca fica rodando para sempre.

## Autocomplete do Nome do Item e da Localização

Ao digitar 2+ letras nos campos **Nome do Item** e **Localização**, aparece
uma lista com valores parecidos já cadastrados (ignora acento e caixa,
prioriza quem começa com o termo e a seção atual do formulário). Selecionar
com mouse ou setas + Enter preenche **somente aquele campo** — o resto do
formulário continua como está. Valores repetidos aparecem agrupados
("3 cadastrados" / "em 3 itens"), usando o cadastro mais recente como base.

## Campos do item

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| Nome do Item | Sim | texto, até 150 caracteres |
| Quantidade | Não (padrão 1) | inteiro ≥ 0 |
| Localização | Não | texto |
| Serial | Não | texto |
| Patrimônio | Não | texto |
| Danificado | Não (padrão Não) | caixa de seleção Sim / Não |
| Atribuição | Não | texto |
| Observação | Não | texto longo |
| Seção | Sim | define em qual aba o item aparece |

## Requisitos

- Node.js 18+ (testado com Node 22)

## Como rodar

```bash
npm install
npm start          # http://localhost:3000
```

Desenvolvimento com recarga automática:

```bash
npm run dev
```

Outras opções:

```bash
npm run typecheck  # valida os tipos
npm run build      # compila para dist/
PORT=8080 npm start
```

## Banco de dados

SQLite com TypeORM (`synchronize: true` cria/atualiza o schema automaticamente).

- Arquivo: `data/inventario.sqlite`
- Entities: `src/entity/Item.ts`, `src/entity/User.ts`, `src/entity/AuditLog.ts`
- Conexão: `src/dataSource.ts`
- Senhas com hash bcrypt; sessão via token JWT (`Authorization: Bearer`)

Para recriar o banco do zero, encerre o servidor e apague o arquivo
`data/inventario.sqlite`.

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/itens?categoria=Notebooks&q=texto` | Lista itens da seção com busca (ignora acento e caixa) |
| GET | `/api/itens/:id` | Consulta 1 item |
| POST | `/api/itens` | Cria item |
| PUT | `/api/itens/:id` | Atualiza item |
| DELETE | `/api/itens/:id` | Exclui item |
| GET | `/api/resumo` | Contagem de itens/unidades por seção |
| POST | `/api/auth/login` | Login `{ username, senha }` → `{ token, usuario }` |
| GET | `/api/auth/me` | Dados do usuário logado |
| POST | `/api/auth/logout` | Registra saída (token descartado no cliente) |
| GET | `/api/usuarios` | Lista usuários (sem hash) |
| POST | `/api/usuarios` | Cria usuário `{ username, senha }` |
| DELETE | `/api/usuarios/:id` | Exclui usuário |
| GET | `/api/logs?limite=200&q=texto` | Lista auditoria (mais recentes primeiro) |
| GET | `/api/itens/sugestoes?q=termo&campo=nome\|localizacao&categoria=Seção` | Autocomplete agrupado (categoria só prioriza) |

Exemplo:

```bash
curl -X POST http://localhost:3000/api/itens -H "Content-Type: application/json" ^
  -d "{\"categoria\":\"Notebooks\",\"nome\":\"Dell Latitude 5540\",\"quantidade\":3,\"localizacao\":\"Almoxarifado\",\"serial\":\"SN123\",\"patrimonio\":\"PT-10\",\"danificado\":false,\"atribuicao\":\"Carlos\",\"observacao\":\"Novo\"}"
```

## Estrutura

```
Inventario2/
├── data/inventario.sqlite   # criado na 1ª execução
├── public/                  # frontend
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── index.ts             # bootstrap do Express + admin inicial
│   ├── dataSource.ts        # conexão TypeORM/SQLite + função `busca`
│   ├── search.ts            # normalização sem acento/caixa
│   ├── auth.ts              # hash bcrypt + JWT
│   ├── logs.ts              # auditoria
│   ├── validation.ts        # validação do payload
│   ├── middleware/requireAuth.ts
│   ├── entity/Item.ts       # entidade + seções
│   ├── entity/User.ts       # usuários
│   ├── entity/AuditLog.ts   # logs
│   └── routes/ (itens.ts, auth.ts, logs.ts)
├── package.json
└── tsconfig.json
```
