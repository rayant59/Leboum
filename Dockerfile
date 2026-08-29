FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/

RUN npm install

COPY apps ./apps
COPY packages ./packages
COPY server ./server

RUN npm run build --workspace @subtitles-party/web

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

EXPOSE 8080

CMD ["npm", "run", "start", "--workspace", "@subtitles-party/web"]
