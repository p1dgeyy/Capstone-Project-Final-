FROM nginx:alpine

# Remove the default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend files to the nginx web root
COPY frontend/ /usr/share/nginx/html/

# Expose Railway's default port
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
