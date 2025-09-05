# BharatKYC Lite - Docker Configuration

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for image processing
RUN apk add --no-cache \
    vips-dev \
    python3 \
    make \
    g++

# Copy package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY server/ ./
COPY index.html ./public/
COPY src/ ./public/src/
COPY manifest.json ./public/
COPY sw.js ./public/

# Create uploads directory
RUN mkdir -p uploads

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bharatkyc -u 1001

# Change ownership
RUN chown -R bharatkyc:nodejs /app
USER bharatkyc

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Start application
CMD ["npm", "start"]
