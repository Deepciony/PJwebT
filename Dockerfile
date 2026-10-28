# One image: builds the web app, then runs the API, which also serves the web app on the same origin.
FROM oven/bun:1.4 AS base
WORKDIR /app

FROM base AS build
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM base
ENV NODE_ENV=production
COPY --from=build /app /app
# uploaded images and payment slips; mount a persistent disk here in production
VOLUME /app/apps/api/uploads
EXPOSE 3000
WORKDIR /app/apps/api
# apply pending migrations, then start
CMD ["sh", "-c", "bun src/migrate.ts && bun src/index.ts"]
