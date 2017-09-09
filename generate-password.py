#!/usr/bin/python

import getpass

import scrypt  # pip install scrypt
import binascii

password1 = getpass.getpass()

print('Repeat the same password:')

password2 = getpass.getpass()

if password1 == password2:
    # salt is constant
    salt = "dc73b57736511340f132e4b5521d178afa6311c45e0c25e6a9339038507852a6"

    hashed = scrypt.hash(password=password1,
                           salt=salt,
                           N=16384,
                           r=8,
                           p=1,
                           buflen=32)

    print('Generated password hash:')
    print(binascii.hexlify(hashed))
else:
    print('Entered passwords are not identical!')