import scrypt  # pip install scrypt

import sql


def get_verification_hash(password):
    salt = sql.get_option('password_verification_salt')

    return get_scrypt_hash(password, salt)


def get_password_derived_key(password):
    salt = sql.get_option('password_derived_key_salt')

    return get_scrypt_hash(password, salt)


def get_scrypt_hash(password, salt):
    # scrypt doesn't like unicode strings
    password = password.encode('ascii', 'ignore')
    salt = salt.encode('ascii', 'ignore')

    hashed = scrypt.hash(password=password,
                         salt=salt,
                         N=16384,
                         r=8,
                         p=1,
                         buflen=32)

    return hashed
