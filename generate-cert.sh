#!/bin/bash

openssl genrsa -des3 -out cert.key 2048

openssl req -new -key cert.key -out cert.csr

# Remove passphrase from key
cp cert.key cert.key.org

openssl rsa -in cert.key.org -out cert.key

# Generate self signed certificate
openssl x509 -req -days 730 -in cert.csr -signkey cert.key -out cert.crt

rm cert.key.org
rm cert.csr