#!/bin/sh

URL=${TRILIUM_URL:-"http://localhost:8080"}

if curl -s "$URL" > /dev/null; then
    echo "Trilium is up and running."
    exit 0
else
    echo "Trilium is not responding."
    exit 1
fi
