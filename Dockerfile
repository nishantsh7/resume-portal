# # Use Node.js LTS
# FROM node:18

# # Create app directory
# WORKDIR /app

# # Copy dependencies
# COPY package*.json ./
# RUN npm install

# # Copy rest of the files
# COPY . .

# # Set environment variable (optional)
# ENV PORT=8080

# # Expose the port
# EXPOSE 8080

# # Start the server
# CMD ["node", "server.js"]

# Use Node.js LTS Alpine for smaller image size
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Cloud Run sets PORT automatically, but default to 8080
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the server
CMD ["node", "server.js"]
