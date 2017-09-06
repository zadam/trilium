from flask import Blueprint, jsonify, request
from flask_login import login_required
import hashlib
import configparser
import binascii

password_api = Blueprint('password_api', __name__)

@password_api.route('/password/verify', methods = ['POST'])
@login_required
def verifyPassword():
    req = request.get_json(force=True)

    config = configparser.ConfigParser()
    config.read('config.ini')

    hashedPassword = config['Login']['password-hash'].encode('utf-8')
    hashedPasswordBytes = binascii.unhexlify(hashedPassword)
    hashedPasswordSha = hashlib.sha256(hashedPasswordBytes).hexdigest()

    print(req['password'])
    print(hashedPasswordSha)

    isValid = req['password'] == hashedPasswordSha

    return jsonify({
        'valid': isValid
    })