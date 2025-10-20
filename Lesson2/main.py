from flask import Flask
from config import DB_CONFIG, SECRET_KEY
from models import db
from flask_jwt_extended import JWTManager
from routes.User.user_v1 import users_v1_bp
from routes.User.user_v2 import users_v2_bp
from routes.book import book_bp
from routes.borrow import borrow_bp

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@"
    f"{DB_CONFIG['host']}/{DB_CONFIG['database']}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = SECRET_KEY

db.init_app(app)
with app.app_context():
    db.create_all()

jwt = JWTManager(app)

app.register_blueprint(users_v1_bp, url_prefix='/api/v1/users')
app.register_blueprint(users_v2_bp, url_prefix='/api/v2/users')
app.register_blueprint(book_bp, url_prefix='/books')
app.register_blueprint(borrow_bp, url_prefix='/borrows')


if __name__ == "__main__":
    app.run(debug=True, port=3001)