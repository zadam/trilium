#!/usr/bin/python

import getpass
import src.my_scrypt

password1 = getpass.getpass()
password2 = getpass.getpass(prompt='Repeat the same password:')

if password1 == password2:
    hash = src.my_scrypt.getVerificationHash(password1)

    print('Generated password hash:')
    print(hash)
else:
    print('Entered passwords are not identical!')