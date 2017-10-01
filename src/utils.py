from datetime import datetime
import time

def nowTimestamp():
    return time.mktime(datetime.utcnow().timetuple())
