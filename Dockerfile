# ---- Stage 1: Build ----
FROM node:20-alpine AS build

WORKDIR /app

# Install frontend dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install server dependencies
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Copy all source files
COPY . .

# Build frontend (Vite → dist/)
RUN npm run build

# Build server (TypeScript → server/dist/)
RUN cd server && npm run build

# ---- Stage 2: Runtime ----
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy built frontend
COPY --from=build /app/dist ./dist

# Copy built server + production dependencies
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/package.json ./server/package.json

# Create directories for runtime data (will be volume-mounted)
RUN mkdir -p server/data server/public/audio

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "server/dist/index.js"]
