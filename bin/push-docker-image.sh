#!/usr/bin/env bash

if [[ $# -eq 0 ]] ; then
    echo "Missing argument of new version"
    exit 1
fi

sudo docker push zadam/trilium:latest
sudo docker push zadam/trilium:$1