import sqlite3
import base64
from flask import Flask, request, send_from_directory
from flask_restful import Resource, Api
from flask_cors import CORS

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        if isinstance(row[idx], buffer):
            d[col[0]] = base64.b64encode(row[idx])
        else:
            d[col[0]] = row[idx]

    return d

conn = sqlite3.connect('demo.ncdb')
conn.row_factory = dict_factory

app = Flask(__name__)

CORS(app)

@app.route('/frontend/<path:path>')
def send_js(path):
    return send_from_directory('frontend', path)

api = Api(app)

def insert(tablename, rec):
    keys = ','.join(rec.keys())
    question_marks = ','.join(list('?'*len(rec)))
    values = tuple(rec.values())
    execute('INSERT INTO '+tablename+' ('+keys+') VALUES ('+question_marks+')', values)

def delete(tablename, note_id):
    execute("DELETE FROM " + tablename + " WHERE note_id = ?", [note_id])

def execute(sql, params=[]):
    cursor = conn.cursor()
    cursor.execute(sql, params)

def getResults(sql, params=[]):
    cursor = conn.cursor()
    query = cursor.execute(sql, params)
    return query.fetchall()

def getSingleResult(sql, params=()):
    cursor = conn.cursor()
    query = cursor.execute(sql, params)
    return query.fetchone()

class Query(Resource):
    def get(self):
        sql = request.args.get('sql')

        return getResults(sql)

api.add_resource(Query, '/query')

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

        execute("update notes set note_text = ?, note_title = ? where note_id = ?", [note['detail']['note_text'], note['detail']['note_title'], note_id])

        delete("formatting", note_id)

        for fmt in note['formatting']:
            insert("formatting", fmt)

        conn.commit()

        return {}

api.add_resource(Notes, '/notes/<string:note_id>')

class Tree(Resource):
    def get(self):
        notes = getResults("select notes_tree.*, notes.note_title from notes_tree join notes on notes.note_id = notes_tree.note_id order by note_pid, note_pos")

        rootNotes = []
        notesMap = {}

        for note in notes:
            note['children'] = []

            if not note['note_pid']:
                rootNotes.append(note)

            notesMap[note['note_id']] = note

        for note in notes:
            if note['note_pid'] != "":
                parent = notesMap[note['note_pid']]

                parent['children'].append(note)
                parent['folder'] = True

        return rootNotes

api.add_resource(Tree, '/tree')

if __name__ == '__main__':
    app.run(host='0.0.0.0')
