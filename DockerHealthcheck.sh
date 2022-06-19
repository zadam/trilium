#!/bin/sh
if wget --spider -S "127.0.0.1:8080/login" 2>&1 | awk 'NR==2' | grep -w "HTTP/1.1 200 OK" ; then
    exit 0
else
    exit 1
fi
