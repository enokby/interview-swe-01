FROM node:20-alpine As development

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN sed -i 's/\r$//' wait-for.sh && chmod +x wait-for.sh

RUN npm run build

CMD ["./wait-for.sh", "postgres", "npm", "run", "start:dev"]

FROM node:20-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/wait-for.sh ./wait-for.sh

CMD ["./wait-for.sh", "postgres", "npm", "run", "start:dev"]
