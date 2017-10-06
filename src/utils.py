from datetime import datetime
import time

def nowTimestamp():
    return int(time.mktime(datetime.utcnow().timetuple()))
