#!/usr/bin/env bash
# Script generates certificate by default into the ~/trilium-data/cert where it is expected by Trilium
# If directory is given in argument, certificate will be created there.

if [ $# -eq 0 ]
  then
    DIR=~/trilium-data/cert
else
    DIR=$1
fi

mkdir -p "$DIR"
cd "$DIR"

openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 2000 -nodes

