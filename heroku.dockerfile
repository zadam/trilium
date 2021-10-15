FROM node:14.18.1-alpine

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .
RUN cat package.json | grep -v electron > server-package.json \
    && cp server-package.json package.json

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

USER node

CMD [ "/bin/sh", "-c", "mkdir ~/trilium-data && sed -r 's/@PORT/'$PORT'/' config-heroku.ini > ~/trilium-data/config.ini && node ./src/www" ]
