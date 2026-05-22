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
RUN node_modules/.bin/jest --runInBand
# Dereference pnpm symlinks into real files before prod prune removes them.
# COPY --from across stages preserves symlinks as-is; cp -rL resolves them so the
# runner gets actual files, not dangling pointers into the missing pnpm virtual store.
# @prisma/engines is NOT a top-level node_modules entry — pnpm only exposes it inside
# the prisma package's own virtual-store context (.pnpm/prisma@.../node_modules/).
# We use require.resolve from the real prisma path to locate it reliably.
RUN cp -rL node_modules/prisma /tmp/prisma-pkg && \
    ENGINES_DIR=$(node -e " \
      const fs=require('fs'),path=require('path'); \
      const prismaReal=fs.realpathSync('node_modules/prisma'); \
      const engPkg=require.resolve('@prisma/engines/package.json',{paths:[prismaReal]}); \
      process.stdout.write(path.dirname(engPkg))") && \
    cp -rL "$ENGINES_DIR" /tmp/prisma-engines-pkg
RUN pnpm prune --prod

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /tmp/prisma-pkg ./node_modules/prisma
COPY --from=build /tmp/prisma-engines-pkg ./node_modules/@prisma/engines
# Create a shell wrapper for the prisma CLI.
# We read the bin path from the package's own package.json so this stays correct
# across prisma version bumps (v6 uses build/index.js, not bin/prisma.js).
# A wrapper script is more reliable than a symlink because it never depends on
# the execute bit or shebang interpreter of the target file.
RUN PRISMA_BIN=$(node -e \
      "const {bin}=require('./node_modules/prisma/package.json'); \
       console.log(Object.values(bin)[0])") && \
    mkdir -p node_modules/.bin && \
    printf '#!/bin/sh\nexec node /app/node_modules/prisma/%s "$@"\n' \
      "$PRISMA_BIN" > node_modules/.bin/prisma && \
    chmod +x node_modules/.bin/prisma
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
