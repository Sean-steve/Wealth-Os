# Staging only. Does not package database credentials, real tokens or provider keys.
FROM node:22-alpine AS build
WORKDIR /opt/wealth-api
COPY apps/api/package.json ./
RUN npm install --no-audit --no-fund
COPY apps/api/ ./
RUN npm run typecheck && npx tsc -p tsconfig.build.json

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /opt/wealth-api
COPY apps/api/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /opt/wealth-api/dist ./dist
COPY --from=build /opt/wealth-api/db/migrations ./db/migrations
USER node
EXPOSE 3009
CMD ["node", "dist/src/server.js"]
