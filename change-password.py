#!/usr/bin/python

import src.config_provider
import src.sql
import base64
import getpass
from Crypto.Cipher import AES
from Crypto.Util import Counter
import binascii

import src.my_scrypt

config = src.config_provider.getConfig()
src.sql.connect(config['Document']['documentPath'])

currentPassword = getpass.getpass(prompt="Enter current password: ")

currentPasswordHash = binascii.hexlify(src.my_scrypt.getVerificationHash(currentPassword))

if currentPasswordHash != src.sql.getOption('password'):
    print("Given password doesn't match hash")
    exit(-1)

currentPasswordEncryptionKey = src.my_scrypt.getEncryptionHash(currentPassword)

newPassword1 = getpass.getpass(prompt="Enter new password: ")
newPassword2 = getpass.getpass(prompt="Repeat the same password: ")

if newPassword1 != newPassword2:
    print('Entered passwords are not identical!')
    exit(-1)

newPasswordVerificationKey = binascii.hexlify(src.my_scrypt.getVerificationHash(newPassword1))
newPasswordEncryptionKey = src.my_scrypt.getEncryptionHash(newPassword1)

encryptedNotes = src.sql.getResults("select note_id, note_title, note_text from notes where encryption = 1")

def decrypt(encryptedBase64):
    encryptedBytes = base64.b64decode(encryptedBase64)

    aes = getAes(currentPasswordEncryptionKey)
    return aes.decrypt(encryptedBytes)

def encrypt(plainText):
    aes = getAes(newPasswordEncryptionKey)
    encryptedBytes = aes.encrypt(plainText)

    return base64.b64encode(encryptedBytes)

def getAes(key):
    return AES.new(key, AES.MODE_CTR, counter=Counter.new(128, initial_value=5))

for note in encryptedNotes:
    decryptedTitle = decrypt(note['note_title'])
    decryptedText = decrypt(note['note_text'])

    reEncryptedTitle = encrypt(decryptedTitle)
    reEncryptedText = encrypt(decryptedText)

    src.sql.execute("update notes set note_title = ?, note_text = ? where note_id = ?",
                    [reEncryptedTitle, reEncryptedText, note['note_id']])

    print("Note " + note['note_id'] + " re-encrypted with new password")

src.sql.setOption('password', newPasswordVerificationKey)
src.sql.commit()

print("Changes committed. All encrypted notes were re-encrypted successfully with new password key.")
print("You can now start application and login with new password.")