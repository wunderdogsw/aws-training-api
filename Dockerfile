FROM node:16

ENV NODE_ENV production
WORKDIR /app

COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json

RUN npm ci

COPY src /app/src

HEALTHCHECK CMD curl -fs http://localhost:3000/healthz || exit 1
CMD ["npm", "start"]
