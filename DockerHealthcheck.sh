#!/bin/sh
if wget --spider -S "127.0.0.1:8080/login" 2>&1 | grep -w "200" ; then
    exit 0
else
    exit 1
fi
