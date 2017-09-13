#!/usr/bin/python

import binascii
import getpass
import os
import base64

from builtins import input

import src.config_provider
import src.sql
import src.my_scrypt

config = src.config_provider.getConfig()
src.sql.connect(config['Document']['documentPath'])

username = src.sql.getOption("username")

if username:
    print("Application has been already set up.")
    exit(1)

print("Please provide your desired login credentials")

username = input("Username: ")

password1 = getpass.getpass()
password2 = getpass.getpass(prompt='Repeat the same password: ')

if password1 == password2:
    hash = src.my_scrypt.getVerificationHash(password1)

    src.sql.setOption('username', username)
    src.sql.setOption('password', binascii.hexlify(hash))

    # urandom is secure enough, see https://docs.python.org/2/library/os.html
    src.sql.setOption('flask_secret_key', base64.b64encode(os.urandom(24)))
    src.sql.setOption('verification_salt', base64.b64encode(os.urandom(24)))
    src.sql.setOption('encryption_salt', base64.b64encode(os.urandom(24)))

    src.sql.commit()

    print('Application has been set up. You can now login.')
else:
    print('Entered passwords are not identical!')