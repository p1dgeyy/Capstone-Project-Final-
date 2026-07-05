FROM nginx:alpine

# Install Node.js and NPM
RUN apk add --no-cache nodejs npm

# Create work directory
WORKDIR /app

# Copy package descriptors first to leverage Docker layer caching
COPY package.json ./

# Install only production dependencies
RUN npm install --production

# Copy all project files into /app
COPY . .

# Configure Nginx and site assets
RUN rm /etc/nginx/conf.d/default.conf && \
    cp nginx.conf /etc/nginx/conf.d/default.conf && \
    rm -rf /usr/share/nginx/html/* && \
    cp -r frontend/* /usr/share/nginx/html/

# Make the startup script executable
RUN chmod +x start.sh

EXPOSE 3000

# Execute custom entrypoint script
CMD ["./start.sh"]
