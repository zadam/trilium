from flask import Blueprint, jsonify
from flask import request
from flask_login import login_required

import audit_category
from sql import execute, commit, addAudit
from sql import getSingleResult

notes_move_api = Blueprint('notes_move_api', __name__)

@notes_move_api.route('/api/notes/<string:note_id>/moveTo/<string:parent_id>', methods = ['PUT'])
@login_required
def moveToNote(note_id, parent_id):
    res = getSingleResult('select max(note_pos) as max_note_pos from notes_tree where note_pid = ?', [parent_id])
    max_note_pos = res['max_note_pos']
    new_note_pos = 0

    if max_note_pos is None:  # no children yet
        new_note_pos = 0
    else:
        new_note_pos = max_note_pos + 1

    execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [parent_id, new_note_pos, note_id])

    addAudit(audit_category.CHANGE_PARENT, request, note_id)

    commit()
    return jsonify({})

@notes_move_api.route('/api/notes/<string:note_id>/moveBefore/<string:before_note_id>', methods = ['PUT'])
def moveBeforeNote(note_id, before_note_id):
    before_note = getSingleResult("select * from notes_tree where note_id = ?", [before_note_id])

    if before_note <> None:
        execute("update notes_tree set note_pos = note_pos + 1 where note_id = ?", [before_note_id])

        execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [before_note['note_pid'], before_note['note_pos'], note_id])

        addAudit(audit_category.CHANGE_POSITION, request, note_id)

        commit()

    return jsonify({})

@notes_move_api.route('/api/notes/<string:note_id>/moveAfter/<string:after_note_id>', methods = ['PUT'])
def moveAfterNote(note_id, after_note_id):
    after_note = getSingleResult("select * from notes_tree where note_id = ?", [after_note_id])

    if after_note <> None:
        execute("update notes_tree set note_pos = note_pos + 1 where note_pid = ? and note_pos > ?", [after_note['note_pid'], after_note['note_pos']])

        execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [after_note['note_pid'], after_note['note_pos'] + 1, note_id])

        addAudit(audit_category.CHANGE_POSITION, request, note_id)

        commit()

    return jsonify({})

@notes_move_api.route('/api/notes/<string:note_id>/expanded/<int:expanded>', methods = ['PUT'])
def setExpandedNote(note_id, expanded):
    execute("update notes_tree set is_expanded = ? where note_id = ?", [expanded, note_id])

    # no audit here, not really important

    commit()
    return jsonify({})