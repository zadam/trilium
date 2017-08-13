import binascii
import hashlib
import os

import configparser
import requests

config = configparser.ConfigParser()
config.read('config.ini')

syncServerUrl = config['Sync']['sync-server-url']
syncServerUsername = config['Sync']['sync-server-username']
syncServerPassword = config['Sync']['sync-server-password']

nonce = binascii.hexlify(bytearray(os.urandom(32)))

print('Nonce: ' + nonce)

authContent = syncServerUsername + ":" + hashlib.sha256(syncServerUsername + ":" + syncServerPassword).hexdigest() + ":" + nonce

print('Auth content: ' + authContent)

# SHA256(user + ":" + SHA256(user + ":" + password) + ":" + nonce)  where SHA256 is a hex encoded value
auth = hashlib.sha256(authContent).hexdigest()

response = requests.post(syncServerUrl + "/login", json={
    'user': syncServerUsername,
    'nonce': nonce,
    'auth': auth,
    'protocol': '2'
}, verify=False)

# verify='/home/adam/.notecase/server.pem'

def printResp(resp):
    print('Status: ' + str(resp.status_code))

    for key in response.headers:
        print(key + ': ' + resp.headers[key])

    print('Body: ' + resp.content)

printResp(response)

session = response.headers['Auth']

response = requests.get(syncServerUrl + "/document/list", headers={
    'Auth': session
}, verify=False)

printResp(response)

response = requests.post(syncServerUrl + "/document/tree", headers={
    'Auth': session
},
json={
    'id': 1,
    'password': ''
},
verify=False)

printResp(response)
