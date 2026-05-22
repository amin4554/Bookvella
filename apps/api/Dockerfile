FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS deps
COPY apps/api/package.json apps/api/pnpm-lock.yaml apps/api/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api/prisma ./prisma
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
RUN pnpm prisma generate
RUN pnpm run build
# Dereference pnpm symlinks for prisma CLI into real files before prod prune removes it.
# COPY --from across stages preserves symlinks as-is; cp -rL resolves them so the
# runner gets actual files, not dangling pointers into the missing pnpm virtual store.
RUN cp -rL node_modules/prisma /tmp/prisma-pkg
RUN pnpm prune --prod

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /tmp/prisma-pkg ./node_modules/prisma
RUN ln -sf ../prisma/bin/prisma.js node_modules/.bin/prisma
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
