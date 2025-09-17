# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy runtime sources (this app runs server JS directly; frontend is deployed via Pages)
# .dockerignore (added below) keeps build context clean
COPY . .

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

# Run as non-root
USER node

# Start backend (adjust only if your real entry changes)
CMD ["node", "server.js"]