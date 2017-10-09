import base64
import os

from flask import render_template, redirect
from flask import request, send_from_directory, Blueprint
from flask_login import UserMixin, login_user, logout_user, LoginManager
from flask_login import login_required

import my_scrypt
from migration_api import APP_DB_VERSION
from sql import getOption


class User(UserMixin):
    pass


login_manager = LoginManager()
user = User()


def init(app):
    login_manager.init_app(app)
    login_manager.login_view = 'login_form'

    user.id = getOption('username')


routes = Blueprint('routes', __name__)


@routes.route('/login', methods=['GET'])
def login_form():
    return render_template('login.html')


@routes.route('/app', methods=['GET'])
@login_required
def show_app():
    db_version = int(getOption('db_version'))

    if db_version < APP_DB_VERSION:
        return redirect('migration')

    return render_template('app.html')


@routes.route('/migration', methods=['GET'])
@login_required
def show_migration():
    return render_template('migration.html')


@routes.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return redirect('login')


def verify_password(guessed_password):
    hashed_password = base64.b64decode(getOption('password_verification_hash'))

    guess_hashed = my_scrypt.getVerificationHash(guessed_password)

    return guess_hashed == hashed_password


@routes.route('/login', methods=['POST'])
def login_post():
    guessedPassword = request.form['password'].encode('utf-8')

    if request.form['username'] == user.id and verify_password(guessedPassword):
        rememberMe = True if 'remember-me' in request.form else False

        login_user(user, remember=rememberMe)

        return redirect('app')
    else:
        return render_template('login.html', failedAuth=True)


@routes.route('/stat/<path:path>')
def send_stc(path):
    return send_from_directory(os.path.join(os.getcwd(), 'static'), path)


@login_manager.user_loader
def load_user(user_id):
    if user_id == user.id:
        return user
    else:
        return None


@login_manager.unauthorized_handler
def unauthorized_handler():
    if request.path.startswith('/api'):
        return 'Unauthorized', 401
    else:
        return redirect('/login')