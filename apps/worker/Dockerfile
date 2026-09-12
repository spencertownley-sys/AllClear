# Railway image for the AllClear ingestion worker (built from the repo root).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @allclear/worker... --prod=false

COPY packages/shared packages/shared
COPY apps/worker apps/worker

ENV NODE_ENV=production
EXPOSE 8080
CMD ["pnpm", "--filter", "@allclear/worker", "start"]
