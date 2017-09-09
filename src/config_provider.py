import configparser

def getConfig():
    config = configparser.ConfigParser()
    config.read('config.ini')

    return config