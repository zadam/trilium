import base64
import os

from flask import Blueprint, jsonify
from flask_login import login_required

from sql import getResults, getSingleResult, get_option
import utils
import backup

tree_api = Blueprint('tree_api', __name__)


@tree_api.route('/api/tree', methods = ['GET'])
@login_required
def get_tree():
    backup.regular_backup()

    notes = getResults("select "
                       "notes_tree.*, "
                       "COALESCE(clone.note_title, notes.note_title) as note_title, "
                       "notes.note_clone_id, "
                       "notes.encryption, "
                       "case when notes.note_clone_id is null or notes.note_clone_id = '' then 0 else 1 end as is_clone "
                       "from notes_tree "
                       "join notes on notes.note_id = notes_tree.note_id "
                       "left join notes as clone on notes.note_clone_id = clone.note_id "
                       "order by note_pid, note_pos")

    root_notes = []
    notes_map = {}

    for note in notes:
        note['children'] = []

        if not note['note_pid']:
            root_notes.append(note)

        notes_map[note['note_id']] = note

    for note in notes:
        if note['note_pid'] != "":
            parent = notes_map[note['note_pid']]

            parent['children'].append(note)
            parent['folder'] = True

    ret_object = {
        'notes': root_notes,
        'start_note_id': getSingleResult('select * from options where opt_name = "start_node"')['opt_value'],
        'password_verification_salt': get_option('password_verification_salt'),
        'password_derived_key_salt': get_option('password_derived_key_salt'),
        'encrypted_data_key': get_option('encrypted_data_key'),
        'encryption_session_timeout': get_option('encryption_session_timeout'),
        'browser_id': base64.b64encode(os.urandom(8)), 'full_load_time': utils.now_timestamp()
    }

    return jsonify(ret_object)