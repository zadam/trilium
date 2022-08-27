#!/bin/sh

[[ ! -z "${USER_UID}" ]] && usermod -u ${USER_UID} node || echo "No USER_UID specified, leaving 1000"
[[ ! -z "${USER_GID}" ]] && groupmod -g ${USER_GID} node || echo "No USER_GID specified, leaving 1000"

chown -R node:node /home/node
exec su-exec node node ./src/www
