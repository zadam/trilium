import base64
import sqlite3

import math
import time

conn = None

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        if isinstance(row[idx], buffer):
            d[col[0]] = base64.b64encode(row[idx])
        else:
            d[col[0]] = row[idx]

    return d

def connect(documentPath):
    global conn
    conn = sqlite3.connect(documentPath)
    conn.row_factory = dict_factory

def insert(tablename, rec):
    # FIXME: SQL injection!
    keys = ','.join(rec.keys())
    question_marks = ','.join(list('?'*len(rec)))
    values = tuple(rec.values())
    cursor = execute('INSERT INTO '+tablename+' ('+keys+') VALUES ('+question_marks+')', values)
    return cursor.lastrowid

def setOption(name, value):
    execute("UPDATE options SET opt_value = ? WHERE opt_name = ?", [value, name])

def getOption(name):
    return getSingleResult("SELECT opt_value FROM options WHERE opt_name = ?", [name])['opt_value']

def addAudit(category, request = None, note_id = None, change_from = None, change_to = None, comment = None):
    now = math.floor(time.time())

    browser_id = None

    if request:
        browser_id = request.headers['x-browser-id']

    execute("INSERT INTO audit_log (date_modified, category, browser_id, note_id, change_from, change_to, comment)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)", [now, category, browser_id, note_id, change_from, change_to, comment])

def deleteRecentAudits(category, request, note_id):
    browser_id = request.headers['x-browser-id']

    delete_cutoff = math.floor(time.time()) - 10 * 60;

    execute("DELETE FROM audit_log WHERE category = ? AND browser_id = ? AND note_id = ? AND date_modified > ?",
            [category, browser_id, note_id, delete_cutoff])

def delete(tablename, note_id):
    execute("DELETE FROM " + tablename + " WHERE note_id = ?", [note_id])

def execute(sql, params=[]):
    cursor = conn.cursor()
    cursor.execute(sql, params)
    return cursor

def getResults(sql, params=[]):
    cursor = conn.cursor()
    query = cursor.execute(sql, params)
    return query.fetchall()

def getSingleResult(sql, params=()):
    cursor = conn.cursor()
    query = cursor.execute(sql, params)
    return query.fetchone()

def commit():
    conn.commit()
