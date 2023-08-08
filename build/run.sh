#!/bin/bash

SOURCE="$(dirname "$(readlink -f "$0")")"
if [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    SOURCE="/$SOURCE"
fi
DATA_DIR="$SOURCE/../data"
CODE_DIR="$SOURCE/../code"

if [[ $# -eq 0 ]]; then 
    #sudo docker run -d -t --cap-drop NET_RAW --cap-drop NET_ADMIN -p 8080:8080 -v "$(pwd)/data":/trilium/db-data note_server_bhead
    docker run -d -t --cap-drop NET_RAW --cap-drop NET_ADMIN --network intnet -p 8080:8080 --ip 172.21.0.21 -v "$DATA_DIR/data":/trilium/code/db-data note_server_bhead 
elif [[ $1 -eq "dev" ]]; then 
    docker run -d -t --cap-drop NET_RAW --cap-drop NET_ADMIN --network intnet -p 8080:8080 --ip 172.21.0.21 -v "$CODE_DIR/src/":/trilium/code/src -v "$DATA_DIR/data":/trilium/code/db-data -v "$CODE_DIR/libraries/":/trilium/code/libraries note_server_bhead 
fi