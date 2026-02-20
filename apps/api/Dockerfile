FROM node:20-alpine AS base
WORKDIR /app

# Copy monorepo root files needed for pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared

WORKDIR /app/apps/api
RUN pnpm run prisma:generate
RUN pnpm run build

EXPOSE 4000
CMD ["pnpm","run","start"]
