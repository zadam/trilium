import scrypt  # pip install scrypt
import sql

def getVerificationHash(password):
    # getOption returns unicode bytes which scrypt doesn't like
    salt = sql.getOption('verification_salt').encode('ascii', 'ignore')

    return getScryptHash(password, salt)

def getEncryptionHash(password):
    # getOption returns unicode bytes which scrypt doesn't like
    salt = sql.getOption('encryption_salt').encode('ascii', 'ignore')

    return getScryptHash(password, salt)

def getScryptHash(password, salt):
    hashed = scrypt.hash(password=password,
                salt=salt,
                N=16384,
                r=8,
                p=1,
                buflen=32)

    return hashed