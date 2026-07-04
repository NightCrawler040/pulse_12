# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Production Server ---
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY package*.json ./
RUN npm ci --only=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

# Ensure data directories exist and are writable
RUN mkdir -p server/data/uploads && chmod -R 777 server/data

EXPOSE 80
CMD ["node", "server/index.js"]
