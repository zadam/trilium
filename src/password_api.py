from flask import Blueprint, jsonify, request
from flask_login import login_required

import change_password

password_api = Blueprint('password_api', __name__)


@password_api.route('/api/password/change', methods = ['POST'])
@login_required
def change_password():
    req = request.get_json(force=True)

    result = change_password.change_password(req['current_password'], req['new_password'])

    return jsonify(result)
