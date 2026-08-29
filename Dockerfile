FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm install

RUN npm run build --workspace @subtitles-party/web

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

EXPOSE 8080

CMD ["./node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "8080", "--dir", "apps/web"]
