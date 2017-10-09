from datetime import datetime
import time


def now_timestamp():
    return int(time.mktime(datetime.utcnow().timetuple()))
