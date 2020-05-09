FROM node:12.16.3-alpine

# Create app directory
WORKDIR /usr/src/app

COPY server-package.json package.json

# Install app dependencies
RUN set -x \
    && apk add --no-cache --virtual .build-dependencies \
        autoconf \
        automake \
        g++ \
        gcc \
        libtool \
        make \
        nasm \
        libpng-dev \
        python \
    && npm install --production \
    && apk del .build-dependencies

# Bundle app source
COPY . .

EXPOSE 8080
CMD [ "node", "./src/www" ]
