# !!! Don't try to build this Dockerfile directly, run it through bin/build-docker.sh script !!!
FROM node:16.15.0-alpine

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

# Some setup tools need to be kept
RUN apk add --no-cache su-exec shadow

# Bundle app source
COPY . .

# Add application user and setup proper volume permissions
RUN adduser -s /bin/false node; exit 0

# Start the application
EXPOSE 8080
CMD [ "./start-docker.sh" ]
