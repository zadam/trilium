#!/bin/sh

chown -R node:node /home/node
su-exec node node ./src/www
