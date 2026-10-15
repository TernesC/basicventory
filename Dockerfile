# Imagem única: build do Angular + NestJS e runtime servindo tudo na porta 3000.
# Uso:
#   docker build -t inventario .
#   docker run -d --name inventario -p 3000:3000 \
#     -e JWT_SECRET=troque-por-um-segredo-forte \
#     -v inventario-data:/app/data inventario
# Banco SQLite persistido em /app/data (volume). Swagger em /api/docs.

# ---------- Stage 1: build do frontend Angular ----------
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: build do backend NestJS ----------
FROM node:22-bookworm-slim AS backend-build
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build

# ---------- Stage 3: runtime enxuto ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    JWT_EXPIRACAO=12h
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=backend-build /build/backend/dist ./dist
# Sourcemaps expõem o fonte TS e são inúteis em runtime: fora da imagem.
RUN find ./dist -name '*.map' -delete
COPY --from=frontend-build /build/frontend/dist /app/frontend/dist

VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:3000/api/auth/me').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main"]
