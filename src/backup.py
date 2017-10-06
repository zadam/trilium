from datetime import datetime

import utils
from sql import getOption, setOption
import config_provider
from shutil import copyfile

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