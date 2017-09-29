from flask import Blueprint, jsonify, request
from flask_login import login_required

import sql
import audit_category

settings_api = Blueprint('settings_api', __name__)

allowed_options = [ 'encryption_session_timeout', 'history_snapshot_time_interval' ]

@settings_api.route('/settings', methods = ['GET'])
@login_required
def get_settings():
    dict = {}

    settings = sql.getResults("SELECT opt_name, opt_value FROM options WHERE opt_name IN (%s)" % ',' . join('?'*len(allowed_options)), allowed_options)

    for set in settings:
        dict[set['opt_name']] = set['opt_value']

    return jsonify(dict)

@settings_api.route('/settings', methods = ['POST'])
@login_required
def set_settings():
    req = request.get_json(force=True)

    if req['name'] in allowed_options:
        sql.addAudit(audit_category.SETTINGS, request, None, sql.getOption(req['name']), req['value'], req['name'])

        sql.setOption(req['name'], req['value'])

        sql.commit()

        return jsonify({})
    else:
        return jsonify("not allowed option to set")