import src.config_provider
import src.sql
import base64
from Crypto.Cipher import AES
from Crypto.Util import Counter
import binascii

import src.my_scrypt


def change_password(current_password, new_password):
    current_password_hash = binascii.hexlify(src.my_scrypt.getVerificationHash(current_password))

    if current_password_hash != src.sql.getOption('password'):
        return {
            'success': False,
            'message': "Given current password doesn't match hash"
        }

    current_password_encryption_key = src.my_scrypt.getEncryptionHash(current_password)

    new_password_verification_key = binascii.hexlify(src.my_scrypt.getVerificationHash(new_password))
    new_password_encryption_key = src.my_scrypt.getEncryptionHash(new_password)

    encrypted_notes = src.sql.getResults("select note_id, note_title, note_text from notes where encryption = 1")

    def decrypt(encrypted_base64):
        encrypted_bytes = base64.b64decode(encrypted_base64)

        aes = get_aes(current_password_encryption_key)
        return aes.decrypt(encrypted_bytes)

    def encrypt(plain_text):
        aes = get_aes(new_password_encryption_key)
        encryptedBytes = aes.encrypt(plain_text)

        return base64.b64encode(encryptedBytes)

    def get_aes(key):
        return AES.new(key, AES.MODE_CTR, counter=Counter.new(128, initial_value=5))

    for note in encrypted_notes:
        decrypted_title = decrypt(note['note_title'])
        decrypted_text = decrypt(note['note_text'])

        re_encrypted_title = encrypt(decrypted_title)
        re_encrypted_text = encrypt(decrypted_text)

        src.sql.execute("update notes set note_title = ?, note_text = ? where note_id = ?",
                        [re_encrypted_title, re_encrypted_text, note['note_id']])

    src.sql.setOption('password', new_password_verification_key)
    src.sql.commit()

    return {
        'success': True
    }