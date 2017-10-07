from datetime import datetime

import utils
from sql import getOption, setOption, commit
import config_provider
from shutil import copyfile
import os
import re

def backup():
    now = utils.nowTimestamp()
    last_backup_date = int(getOption('last_backup_date'))

    if now - last_backup_date > 43200:
        config = config_provider.getConfig()

        document_path = config['Document']['documentPath']
        backup_directory = config['Backup']['backupDirectory']

        date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

        copyfile(document_path, backup_directory + "/" + "backup-" + date_str + ".db")

        setOption('last_backup_date', now)
        commit()

        cleanup_old_backups()


def cleanup_old_backups():
    now = datetime.utcnow()
    config = config_provider.getConfig()
    backup_directory = config['Backup']['backupDirectory']

    for file in os.listdir(backup_directory):
        match = re.search(r"backup-([0-9 -:]+)\.db", file)

        if match:
            date_str = match.group(1)

            date = datetime.strptime(date_str, "%Y-%m-%d %H:%M")

            if (now - date).days > 30:
                print("Removing old backup - " + file)

                os.remove(backup_directory + "/" + file)