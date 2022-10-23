#!/bin/sh

# Try connecting to /api/health-check using both http and https.
# TODO: we should only be connecting with the actual protocol that is enabled
# TODO: this assumes we use the default port 8080

for proto in http https; do
    if wget --spider -S "$proto://127.0.0.1:8080/api/health-check" 2>&1 | awk 'NR==2' | grep -w "HTTP/1.1 200 OK" ; then
        exit 0
    fi
done

exit 1
