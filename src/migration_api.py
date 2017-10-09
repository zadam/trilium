import os
import re

import traceback

from flask import Blueprint, jsonify
from flask_login import login_required

from sql import get_option, set_option, commit, execute_script

import backup

APP_DB_VERSION = 0

MIGRATIONS_DIR = "src/migrations"

migration_api = Blueprint('migration_api', __name__)


@migration_api.route('/api/migration', methods = ['GET'])
@login_required
def get_migration_info():
    return jsonify({
        'db_version': int(get_option('db_version')),
        'app_db_version': APP_DB_VERSION
    })


@migration_api.route('/api/migration', methods = ['POST'])
@login_required
def run_migration():
    migrations = []

    backup.backup_now()

    current_db_version = int(get_option('db_version'))

    for file in os.listdir(MIGRATIONS_DIR):
        match = re.search(r"([0-9]{4})__([a-zA-Z0-9_ ]+)\.sql", file)

        if match:
            db_version = int(match.group(1))

            if db_version > current_db_version:
                name = match.group(2)

                migration_record = {
                    'db_version': db_version,
                    'name': name
                }

                migrations.append(migration_record)

                with open(MIGRATIONS_DIR + "/" + file, 'r') as sql_file:
                    sql = sql_file.read()

                    try:
                        execute_script(sql)

                        set_option('db_version', db_version)
                        commit()

                        migration_record['success'] = True
                    except:
                        migration_record['success'] = False
                        migration_record['error'] = traceback.format_exc()

                        break

    migrations.sort(key=lambda x: x['db_version'])

    return jsonify({
        'migrations': migrations
    })
