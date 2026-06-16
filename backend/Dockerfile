# Stage 1: Build native modules and fetch dependencies
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Prune node_modules to only production dependencies
RUN npm prune --production

# Stage 2: Production runner
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
