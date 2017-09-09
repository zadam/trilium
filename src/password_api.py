from flask import Blueprint, jsonify, request
from flask_login import login_required
import hashlib
import binascii
import password_provider

password_api = Blueprint('password_api', __name__)

@password_api.route('/password/verify', methods = ['POST'])
@login_required
def verifyPassword():
    req = request.get_json(force=True)

    hashedPassword = password_provider.getPasswordHash()
    hashedPasswordBytes = binascii.unhexlify(hashedPassword)
    hashedPasswordSha = hashlib.sha256(hashedPasswordBytes).hexdigest()

    isValid = req['password'] == hashedPasswordSha

    return jsonify({
        'valid': isValid
    })