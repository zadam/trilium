FROM node:16.13.2-alpine

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
        python3 \
    && npm install --production \
    && apk del .build-dependencies

# Bundle app source
COPY . .

# For mounting a persistent volume with docker compose
ENV TRILIUM_DATA_DIR /home/node/trilium-data
RUN mkdir -p "$TRILIUM_DATA_DIR" && chown -R node:node "$TRILIUM_DATA_DIR" && chmod 750 "$TRILIUM_DATA_DIR"

USER node

EXPOSE 8080
CMD [ "node", "./src/www" ]
