import base64
import math
import random
import string
import time

from flask import Blueprint, jsonify
from flask import request
from flask_login import login_required

from sql import delete
from sql import execute, insert, commit
from sql import getResults, getSingleResult, getOption, addAudit

import audit_category

notes_api = Blueprint('notes_api', __name__)

@notes_api.route('/notes/<string:note_id>', methods = ['GET'])
@login_required
def getNote(note_id):
    execute("update options set opt_value = ? where opt_name = 'start_node'", [note_id])

    detail = getSingleResult("select * from notes where note_id = ?", [note_id])

    if detail['note_clone_id']:
        note_id = detail['note_clone_id']
        detail = getSingleResult("select * from notes where note_id = ?", [note_id])

    return jsonify({
        'detail': detail,
        'formatting': getResults("select * from formatting where note_id = ? order by note_offset", [note_id]),
        'links': getResults("select * from links where note_id = ? order by note_offset", [note_id]),
        'images': getResults("select * from images where note_id = ? order by note_offset", [note_id])
    })

@notes_api.route('/notes/<string:note_id>', methods = ['PUT'])
@login_required
def updateNote(note_id):
    detail = getSingleResult("select * from notes where note_id = ?", [note_id])

    if detail['note_clone_id']:
        note_id = detail['note_clone_id']

    note = request.get_json(force=True)

    now = math.floor(time.time())

    history_snapshot_time_interval = float(getOption('history_snapshot_time_interval'))

    history_cutoff = now - history_snapshot_time_interval

    history = getSingleResult("select id from notes_history where note_id = ? and date_modified >= ?", [note_id, history_cutoff])

    if history:
        execute("update notes_history set note_title = ?, note_text = ?, encryption = ? where id = ?", [
            note['detail']['note_title'],
            note['detail']['note_text'],
            note['detail']['encryption'],
            history['id']
        ])
    else:
        execute("insert into notes_history (note_id, note_title, note_text, encryption, date_modified) values (?, ?, ?, ?, ?)", [
            note_id,
            note['detail']['note_title'],
            note['detail']['note_text'],
            note['detail']['encryption'],
            now
        ])

    if note['detail']['encryption'] != detail['encryption']:
        addAudit(audit_category.ENCRYPTION, request, note_id, detail['encryption'], note['detail']['encryption'])

    execute("update notes set note_title = ?, note_text = ?, encryption = ?, date_modified = ? where note_id = ?", [
        note['detail']['note_title'],
        note['detail']['note_text'],
        note['detail']['encryption'],
        now,
        note_id])

    delete("formatting", note_id)

    for fmt in note['formatting']:
        insert("formatting", fmt)

    delete("images", note_id)

    for img in note['images']:
        img['image_data'] = buffer(base64.b64decode(img['image_data']))

        insert("images", img)

    delete("links", note_id)

    for link in note['links']:
        insert("links", link)

    commit()

    return jsonify({})

@notes_api.route('/notes/<string:note_id>', methods = ['DELETE'])
@login_required
def deleteNote(note_id):
    children = getResults("select note_id from notes_tree where note_pid = ?", [note_id])

    for child in children:
        deleteNote(child['note_id'])

    delete("notes_tree", note_id)
    delete("notes", note_id)

    addAudit(audit_category.DELETE_NOTE, request, note_id)

    commit()
    return jsonify({})

@notes_api.route('/notes/<string:parent_note_id>/children', methods = ['POST'])
@login_required
def createChild(parent_note_id):
    note = request.get_json(force=True)

    noteId = ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) for _ in range(22))

    if parent_note_id == "root":
        parent_note_id = ""

    new_note_pos = 0

    if note['target'] == 'into':
        res = getSingleResult('select max(note_pos) as max_note_pos from notes_tree where note_pid = ?', [parent_note_id])
        max_note_pos = res['max_note_pos']

        if max_note_pos is None: # no children yet
            new_note_pos = 0
        else:
            new_note_pos = max_note_pos + 1
    elif note['target'] == 'after':
        after_note = getSingleResult('select note_pos from notes_tree where note_id = ?', [note['target_note_id']])

        new_note_pos = after_note['note_pos'] + 1

        execute('update notes_tree set note_pos = note_pos + 1 where note_pid = ? and note_pos > ?', [parent_note_id, after_note['note_pos']])
    else:
        raise Exception('Unknown target: ' + note['target'])

    addAudit(audit_category.CREATE_NOTE, request, noteId)

    now = math.floor(time.time())

    insert("notes", {
        'note_id': noteId,
        'note_title': note['note_title'],
        'note_text': '',
        'note_clone_id': '',
        'date_created': now,
        'date_modified': now,
        'icon_info': 'pencil',
        'is_finished': 0,
        'encryption': note['encryption']
    })

    insert("notes_tree", {
        'note_id': noteId,
        'note_pid': parent_note_id,
        'note_pos': new_note_pos,
        'is_expanded': 0
    })

    commit()

    return jsonify({
        'note_id': noteId
    })

@notes_api.route('/notes', methods = ['GET'])
@login_required
def searchNotes():
    search = '%' + request.args['search'] + '%'

    result = getResults("select note_id from notes where note_title like ? or note_text like ?", [search, search])

    noteIdList = []

    for res in result:
        noteIdList.append(res['note_id'])

    return jsonify(noteIdList)