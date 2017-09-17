#!/usr/bin/python

import binascii
import getpass
import os
import base64

from builtins import input

import src.config_provider
import src.sql
import src.my_scrypt
from Crypto.Cipher import AES
from Crypto.Util import Counter
import hashlib

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
    # urandom is secure enough, see https://docs.python.org/2/library/os.html
    src.sql.setOption('flask_secret_key', base64.b64encode(os.urandom(32)))
    src.sql.setOption('password_verification_salt', base64.b64encode(os.urandom(32)))
    src.sql.setOption('password_derived_key_salt', base64.b64encode(os.urandom(32)))

    password_derived_key = src.my_scrypt.getPasswordDerivedKey(password1)

    aes = AES.new(password_derived_key, AES.MODE_CTR, counter=Counter.new(128, initial_value=5))

    data_key = os.urandom(32)
    data_key_digest = hashlib.sha256(data_key).digest()[:4]

    encrypted_data_key = aes.encrypt(data_key_digest + data_key)

    src.sql.setOption('encrypted_data_key', base64.b64encode(encrypted_data_key))

    verification_hash = src.my_scrypt.getVerificationHash(password1)

    src.sql.setOption('username', username)
    src.sql.setOption('password_verification_hash', base64.b64encode(verification_hash))

    src.sql.commit()

    print('Application has been set up. You can now login.')
else:
    print('Entered passwords are not identical!')