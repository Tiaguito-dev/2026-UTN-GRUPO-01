FROM nginx:1.28-alpine
RUN apk add --no-cache openssl \
    && mkdir -p /tls /tmp/nginx \
    && chown -R nginx:nginx /tls /tmp/nginx
ARG NGINX_CONFIG=nginx.conf
COPY ${NGINX_CONFIG} /etc/nginx/nginx.conf
USER nginx
EXPOSE 8443 8080
STOPSIGNAL SIGQUIT
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
