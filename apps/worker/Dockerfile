# Railway image for the NimbusWatch ingestion worker (built from the repo root).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @nimbuswatch/worker... --prod=false

COPY packages/shared packages/shared
COPY apps/worker apps/worker

ENV NODE_ENV=production
# Run as the image's unprivileged "node" user; the worker writes nothing under /app.
# Start tsx directly (same as the package's "start" script): corepack's pnpm lives in root's home,
# so calling pnpm as "node" would try to download it again on every start.
USER node
EXPOSE 8080
WORKDIR /app/apps/worker
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
