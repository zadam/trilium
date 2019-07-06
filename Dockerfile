FROM node:12.6.0-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy both package.json and package-lock.json
# where available (npm@5+)
COPY package.json package-lock.json ./

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
