import base64
import math
import time

from flask import request
from flask_restful import Resource

from sql import delete, execute, insert, getResults, getSingleResult, commit


class Notes(Resource):
    def get(self, note_id):
        return {
            'detail': getSingleResult("select * from notes where note_id = ?", [note_id]),
            'formatting': getResults("select * from formatting where note_id = ? order by note_offset", [note_id]),
            'links': getResults("select * from links where note_id = ? order by note_offset", [note_id]),
            'images': getResults("select * from images where note_id = ? order by note_offset", [note_id])
        }

    def put(self, note_id):
        note = request.get_json(force=True)

        now = math.floor(time.time())

        execute("update notes set note_text = ?, note_title = ?, date_modified = ? where note_id = ?", [note['detail']['note_text'], note['detail']['note_title'], now, note_id])

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

        return {}

    def delete(self, note_id):
        children = getResults("select note_id from notes_tree where note_pid = ?", [note_id])

        for child in children:
            self.delete(child['note_id'])

        delete("notes_tree", note_id)
        delete("notes", note_id)

        commit()
