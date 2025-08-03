# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json first for better Docker layer caching
COPY package.json ./

# Install root dependencies
RUN npm install

# Copy the typescript directory
COPY typescript/ ./typescript/

# Install typescript dependencies (ignore platform-specific packages)
RUN cd typescript && npm install --ignore-platform --no-optional

# Install langchain example dependencies  
RUN cd typescript/examples/langchain && npm install --ignore-platform

# Copy environment example
COPY .env.example ./

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the application
CMD ["npm", "start"]