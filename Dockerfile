# Use Node.js official image
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY typescript/package.json ./typescript/
COPY typescript/examples/langchain/package.json ./typescript/examples/langchain/

# Install dependencies with force flag to ignore platform issues
RUN npm install --force

# Copy source code
COPY typescript/ ./typescript/

# Install typescript dependencies with force
RUN cd typescript && npm install --force

# Install langchain dependencies  
RUN cd typescript/examples/langchain && npm install --force

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["npm", "start"]