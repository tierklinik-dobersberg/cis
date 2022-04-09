FROM node:14 as builder
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build-ckeditor
RUN npm run build-limited --prod

FROM caddy
COPY --from=builder /app/dist/console /srv/www
COPY Caddyfile /etc/caddy/Caddyfile

