# syntax=docker/dockerfile:1.6

# Build stage for frontend
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage with nginx for frontend
FROM nginx:alpine AS frontend
# Copy built frontend from builder stage (corrected from /app/dist to /app/docs)
COPY --from=builder /app/docs /usr/share/nginx/html

# Create basic nginx config for SPA
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Backend stage (original functionality preserved)
FROM node:20-alpine AS backend
WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy runtime sources
COPY . .

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

# Run as non-root
USER node

# Start backend
CMD ["node", "server.js"]