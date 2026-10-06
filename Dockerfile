# PVNE Cards — imagem única usada pelos serviços app, worker e migrate
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# openssl é exigido pelo motor de migrações do Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npx next build

FROM base AS runner
ENV NODE_ENV=production
RUN groupadd -r app && useradd -r -g app app && mkdir -p /app/storage/uploads /app/storage/private && chown -R app:app /app
COPY --from=build --chown=app:app /app ./
USER app
EXPOSE 3000
CMD ["npm", "start"]
