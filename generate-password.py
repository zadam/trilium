#!/usr/bin/python

import bcrypt # pip install bcrypt
import getpass

password1 = getpass.getpass()

print('Repeat the same password:')

password2 = getpass.getpass()

if password1 == password2:
    salt = bcrypt.gensalt()

    print('Generated hash:')
    print(bcrypt.hashpw(password1, salt))
else:
    print('Entered passwords are not identical!')