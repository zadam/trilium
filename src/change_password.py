import base64
import hashlib
from Crypto.Cipher import AES
from Crypto.Util import Counter

import sql
import my_scrypt
import audit_category


def change_password(current_password, new_password, request = None):
    current_password_hash = base64.b64encode(my_scrypt.getVerificationHash(current_password))

    if current_password_hash != sql.getOption('password_verification_hash'):
        return {
            'success': False,
            'message': "Given current password doesn't match hash"
        }

    current_password_derived_key = my_scrypt.getPasswordDerivedKey(current_password)

    new_password_verification_key = base64.b64encode(my_scrypt.getVerificationHash(new_password))
    new_password_encryption_key = my_scrypt.getPasswordDerivedKey(new_password)

    def decrypt(encrypted_base64):
        encrypted_bytes = base64.b64decode(encrypted_base64)

        aes = get_aes(current_password_derived_key)
        return aes.decrypt(encrypted_bytes)[4:]

    def encrypt(plain_text):
        aes = get_aes(new_password_encryption_key)

        digest = hashlib.sha256(plain_text).digest()[:4]

        encrypted_bytes = aes.encrypt(digest + plain_text)

        return base64.b64encode(encrypted_bytes)

    def get_aes(key):
        return AES.new(key, AES.MODE_CTR, counter=Counter.new(128, initial_value=5))

    encrypted_data_key = sql.getOption('encrypted_data_key')

    decrypted_data_key = decrypt(encrypted_data_key)

    new_encrypted_data_key = encrypt(decrypted_data_key)

    sql.setOption('encrypted_data_key', new_encrypted_data_key)

    sql.setOption('password_verification_hash', new_password_verification_key)

    sql.addAudit(audit_category.CHANGE_PASSWORD, request)

    sql.commit()

    return {
        'success': True,
        'new_encrypted_data_key': new_encrypted_data_key
    }