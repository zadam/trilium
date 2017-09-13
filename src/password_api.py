from flask import Blueprint, jsonify, request
from flask_login import login_required
import hashlib
import binascii
import sql
import change_password

password_api = Blueprint('password_api', __name__)

@password_api.route('/password/verify', methods = ['POST'])
@login_required
def verifyPassword():
    req = request.get_json(force=True)

    hashedPassword = sql.getOption('password')
    hashedPasswordBytes = binascii.unhexlify(hashedPassword)
    hashedPasswordSha = hashlib.sha256(hashedPasswordBytes).hexdigest()

    isValid = req['password'] == hashedPasswordSha

    return jsonify({
        'valid': isValid
    })

@password_api.route('/password/change', methods = ['POST'])
@login_required
def changePassword():
    req = request.get_json(force=True)

    result = change_password.change_password(req['current_password'], req['new_password'])

    return jsonify(result)
