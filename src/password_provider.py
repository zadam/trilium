def getPasswordHash():
    with open('password.txt') as file:
        return file.readline()

def setPasswordHash(newPasswordHash):
    with open('password.txt', 'w') as file:
        file.write(newPasswordHash)
