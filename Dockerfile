FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm ci

RUN npm run build --workspace @subtitles-party/web

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

EXPOSE 8080

CMD ["npm", "run", "start", "--workspace", "@subtitles-party/web"]