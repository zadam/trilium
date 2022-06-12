#!/bin/sh

chown -R node:node /home/node
[ -d "$TRILIUM_DATA_DIR" ] && chown -R node:node "$TRILIUM_DATA_DIR"
su-exec node node ./src/www
