# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# --- Stage 2: Production Server ---
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

# Ensure data directories exist and assign ownership to non-root user 'node' (UID 1000)
RUN mkdir -p server/data/uploads && chown -R node:node /app && chmod -R 775 /app/server/data

USER node

EXPOSE 3001
CMD ["node", "server/index.js"]
