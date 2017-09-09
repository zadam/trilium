import scrypt  # pip install scrypt

def getVerificationHash(password):
    salt = "dc73b57736511340f132e4b5521d178afa6311c45e0c25e6a9339038507852a6"

    return getScryptHash(password, salt)

def getEncryptionHash(password):
    salt = "2503bfc386bc028772f803887eaaf4d4a5c1019036873e4ba5de79a4efb7e8d8"

    return getScryptHash(password, salt)

def getScryptHash(password, salt):
    hashed = scrypt.hash(password=password,
                salt=salt,
                N=16384,
                r=8,
                p=1,
                buflen=32)

    return hashed