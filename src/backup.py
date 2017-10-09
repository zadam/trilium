import os
import re
from datetime import datetime
from shutil import copyfile

import config_provider
import utils
from sql import get_option, set_option, commit


def regular_backup():
    now = utils.now_timestamp()
    last_backup_date = int(get_option('last_backup_date'))

    if now - last_backup_date > 43200:
        backup_now()

        cleanup_old_backups()


def backup_now():
    now = utils.now_timestamp()

    config = config_provider.get_config()

    document_path = config['Document']['documentPath']
    backup_directory = config['Backup']['backupDirectory']

    date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    copyfile(document_path, backup_directory + "/" + "backup-" + date_str + ".db")

    set_option('last_backup_date', now)
    commit()


def cleanup_old_backups():
    now = datetime.utcnow()
    config = config_provider.get_config()
    backup_directory = config['Backup']['backupDirectory']

    for file in os.listdir(backup_directory):
        match = re.search(r"backup-([0-9 -:]+)\.db", file)

        if match:
            date_str = match.group(1)

            date = datetime.strptime(date_str, "%Y-%m-%d %H:%M")

            if (now - date).days > 30:
                print("Removing old backup - " + file)

                os.remove(backup_directory + "/" + file)