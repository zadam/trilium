#!/usr/bin/python

import getpass

import src.my_scrypt
import src.sql
import src.change_password

config = src.config_provider.getConfig()
src.sql.connect(config['Document']['documentPath'])

current_password = getpass.getpass(prompt="Enter current password: ")

new_password1 = getpass.getpass(prompt="Enter new password: ")
new_password2 = getpass.getpass(prompt="Repeat the same password: ")

if new_password1 != new_password2:
    print('Entered passwords are not identical!')
    exit(-1)

ret = src.change_password.change_password(current_password, new_password1)

if (ret['success']):
    print("Changes committed. All encrypted notes were re-encrypted successfully with new password key.")
    print("You can now start application and login with new password.")
else:
    print(ret['message'])
