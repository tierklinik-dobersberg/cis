FROM node:14 as builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY ckeditor/ ./ckeditor
RUN npm run build-ckeditor
RUN npx browserslist@latest --update-db

COPY . .
RUN npm run build-limited --prod

FROM caddy
COPY --from=builder /app/dist/console /srv/www
COPY Caddyfile /etc/caddy/Caddyfile

