import scrypt  # pip install scrypt
import sql

def getVerificationHash(password):
    salt = sql.getOption('verification_salt')

    return getScryptHash(password, salt)

def getEncryptionHash(password):
    salt = sql.getOption('encryption_salt')

    return getScryptHash(password, salt)

def getScryptHash(password, salt):
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