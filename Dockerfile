# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The SWC native addon (pulled in by next-intl's plugin) wants a cache directory only the build user can write.
ENV SWC_NATIVE_BINDING_CACHE=/app/.swc-cache
RUN install -d -m 700 /app/.swc-cache && npx prisma generate && SKIP_ENV_VALIDATION=1 npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# next start loads next.config.ts, which loads the next-intl plugin and the SWC native addon; it needs a cache
# directory only the app user can write.
ENV SWC_NATIVE_BINDING_CACHE=/app/.swc-cache
# pg_dump must match the server major version (PostgreSQL 18), so the client comes from the PostgreSQL apt repo.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
  && apt-get purge -y curl gnupg && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r app && useradd -r -g app -d /app app \
  && mkdir -p /data /app/.swc-cache && chown app:app /data /app/.swc-cache && chmod 700 /app/.swc-cache
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/package.json /app/next.config.ts /app/prisma.config.ts /app/tsconfig.json ./
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/src ./src
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/messages ./messages
USER app
EXPOSE 3070
CMD ["sh", "scripts/start.sh"]
