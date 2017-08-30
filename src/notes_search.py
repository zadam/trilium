from flask import request
from flask_restful import Resource

from sql import getResults


class NotesSearch(Resource):
    def get(self):
        search = '%' + request.args['search'] + '%'

        result = getResults("select note_id from notes where note_title like ? or note_text like ?", [search, search])

        noteIdList = [];

        for res in result:
            noteIdList.append(res['note_id'])

        return noteIdList