# !!! Don't try to build this Dockerfile directly, run it through bin/build-docker.sh script !!!
FROM node:16.19.0-alpine

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

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
    && npm install \
    && apk del .build-dependencies \
    && npm run webpack \
    && npm prune --omit=dev \
    && cp src/public/app/share.js src/public/app-dist/. \
    && cp -r src/public/app/doc_notes src/public/app-dist/. \
    && rm -rf src/public/app

# Some setup tools need to be kept
RUN apk add --no-cache su-exec shadow

# Add application user and setup proper volume permissions
RUN adduser -s /bin/false node; exit 0

# Start the application
EXPOSE 8080
CMD [ "./start-docker.sh" ]

HEALTHCHECK CMD sh DockerHealthcheck.sh
