from flask import Blueprint, jsonify
from flask import request
from flask_login import login_required

from sql import getSingleResult

audit_api = Blueprint('audit_api', __name__)

@audit_api.route('/audit/<int:full_load_time>', methods = ['GET'])
@login_required
def getNote(full_load_time):
    browser_id = request.headers['x-browser-id']

    count = getSingleResult("SELECT COUNT(*) AS 'count' FROM audit_log WHERE browser_id != ? AND date_modified >= ?", [browser_id, full_load_time])['count']

    return jsonify({
        'changed': count > 0
    })