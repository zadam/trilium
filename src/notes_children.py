import math
import random
import string
import time

from flask import request
from flask_restful import Resource

from sql import execute, insert, getSingleResult, commit


class NotesChildren(Resource):
    def post(self, parent_note_id):
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

        now = math.floor(time.time())

        insert("notes", {
            'note_id': noteId,
            'note_title': note['note_title'],
            'note_text': '',
            'note_clone_id': '',
            'date_created': now,
            'date_modified': now,
            'icon_info': 'pencil',
            'is_finished': 0
        })

        insert("notes_tree", {
            'note_id': noteId,
            'note_pid': parent_note_id,
            'note_pos': new_note_pos,
            'is_expanded': 0
        })

        commit()

        return {
            'note_id': noteId
        }
