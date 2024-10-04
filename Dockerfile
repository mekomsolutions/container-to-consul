FROM node:18-alpine

COPY . /opt/container2sul
WORKDIR /opt/container2sul

RUN  npm install

CMD ["node", "lib/index.js"]


