# Multi-stage / Lightweight Nginx image for serving Capstone Portal
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend static files
COPY frontend /usr/share/nginx/html

# Expose port 80 (inside container)
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
