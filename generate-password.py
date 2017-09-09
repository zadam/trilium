#!/usr/bin/python

import getpass
import src.my_scrypt
import binascii
import src.password_provider

password1 = getpass.getpass()
password2 = getpass.getpass(prompt='Repeat the same password:')

if password1 == password2:
    hash = src.my_scrypt.getVerificationHash(password1)

    src.password_provider.setPasswordHash(binascii.hexlify(hash))

    print('Password has been generated and saved into password.txt. You can now login.')
else:
    print('Entered passwords are not identical!')