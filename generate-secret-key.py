#!/usr/bin/python
import os
import base64

print(base64.b64encode(os.urandom(24)))