# One image: builds the web app, then runs the API, which also serves the web app on the same origin.
FROM node:24-slim AS base
RUN npm install -g pnpm@12.3.4
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter web build

FROM base
ENV NODE_ENV=production
COPY --from=build /app /app
# uploaded images and payment slips go to /app/apps/api/uploads: mount a persistent disk there to keep them
EXPOSE 3000
WORKDIR /app/apps/api
# apply pending migrations, fill an empty database (an existing one only gets missing catalog rows), then start
CMD ["sh", "-c", "npx tsx src/migrate.ts && npx tsx src/seed.ts && npx tsx src/index.ts"]
