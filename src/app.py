import bcrypt
import configparser
import os
from flask import Flask, request, send_from_directory
from flask import render_template, redirect
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user
from flask_restful import Api
from move_after_note import MoveAfterNote
from move_to_note import MoveToNote
from notes import Notes
from notes_children import NotesChildren

from expanded_note import ExpandedNote
from move_before_note import MoveBeforeNote
from tree import Tree

app = Flask(__name__)
app.secret_key = 'dshjkjsdhfk9832fsdlhf'

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

config = configparser.ConfigParser()
config.read('config.ini')

user = User()
user.id = config['Login']['username']

hashedPassword = config['Login']['password-hash'].encode('utf-8')

@app.route('/login', methods=['POST'])
def login_post():
    inputPassword = request.form['password'].encode('utf-8')

    if request.form['username'] == user.id and bcrypt.hashpw(inputPassword, hashedPassword) == hashedPassword:
        rememberMe = True if 'remember-me' in request.form else False

        login_user(user, remember=rememberMe)

        return redirect('app')
    else:
        return render_template('login.html', failedAuth=True)

CORS(app)

@app.route('/stat/<path:path>')
def send_stc(path):
    return send_from_directory(os.path.join(os.getcwd(), 'static'), path)

api = Api(app)

api.add_resource(NotesChildren, '/notes/<string:parent_note_id>/children')
api.add_resource(MoveAfterNote, '/notes/<string:note_id>/moveAfter/<string:after_note_id>')
api.add_resource(MoveBeforeNote, '/notes/<string:note_id>/moveBefore/<string:before_note_id>')
api.add_resource(MoveToNote, '/notes/<string:note_id>/moveTo/<string:parent_id>')
api.add_resource(ExpandedNote, '/notes/<string:note_id>/expanded/<int:expanded>')
api.add_resource(Tree, '/tree')

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login_form'

@login_manager.user_loader
def load_user(user_id):
    if user_id == user.id:
        return user
    else:
        return None

api.add_resource(Notes, '/notes/<string:note_id>')

if __name__ == '__main__':
    app.run(host='0.0.0.0')