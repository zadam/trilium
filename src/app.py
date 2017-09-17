import os

import binascii
import base64
from flask import Flask, request, send_from_directory
from flask import render_template, redirect
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user

from notes_api import notes_api
from sql import connect, getOption
from tree_api import tree_api
from notes_move_api import notes_move_api
from password_api import password_api
from settings_api import settings_api
import config_provider
import my_scrypt

config = config_provider.getConfig()

documentPath = config['Document']['documentPath']
connect(documentPath)

flask_secret_key = getOption("flask_secret_key")

if not flask_secret_key:
    print("Application has not been setup yet. Run 'python setup.py' to finish setup.")
    exit(1)

app = Flask(__name__)
app.secret_key = flask_secret_key
app.register_blueprint(tree_api)
app.register_blueprint(notes_api)
app.register_blueprint(notes_move_api)
app.register_blueprint(password_api)
app.register_blueprint(settings_api)

class User(UserMixin):
    pass

@app.route('/login', methods=['GET'])
def login_form():
    return render_template('login.html')

@app.route('/app', methods=['GET'])
@login_required
def show_app():
    return render_template('app.html')

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return redirect('login')

user = User()
user.id = getOption('username')

port = config['Network']['port']
https = config['Network']['https']
certPath = config['Network']['certPath']
certKeyPath = config['Network']['certKeyPath']

def verify_password(guessed_password):
    hashed_password = base64.b64decode(getOption('password_verification_hash'))

    guess_hashed = my_scrypt.getVerificationHash(guessed_password)

    return guess_hashed == hashed_password

@app.route('/login', methods=['POST'])
def login_post():
    guessedPassword = request.form['password'].encode('utf-8')

    if request.form['username'] == user.id and verify_password(guessedPassword):
        rememberMe = True if 'remember-me' in request.form else False

        login_user(user, remember=rememberMe)

        return redirect('app')
    else:
        return render_template('login.html', failedAuth=True)

CORS(app)

@app.route('/stat/<path:path>')
def send_stc(path):
    return send_from_directory(os.path.join(os.getcwd(), 'static'), path)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login_form'

@login_manager.user_loader
def load_user(user_id):
    if user_id == user.id:
        return user
    else:
        return None

if __name__ == "__main__":
    ssl_context = None

    if https == "true":
        ssl_context = (certPath, certKeyPath)

    app.run(host='0.0.0.0', port=port, ssl_context = ssl_context)