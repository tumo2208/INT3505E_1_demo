from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from passlib.hash import bcrypt

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum('user','librarian'), default='user')
    phone = db.Column(db.String(255))

    def set_password(self, password):
        self.password = bcrypt.hash(password)

    def verify(self, pw):
        return bcrypt.verify(pw, self.password)

class Book(db.Model):
    __tablename__ = 'books'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(255))
    num_copies = db.Column(db.Integer, default=1)

class Borrow(db.Model):
    __tablename__ = 'borrows'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    book_id_list = db.Column(db.JSON, nullable=False)
    borrowed_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.Date)
    returned_at = db.Column(db.DateTime)
    status = db.Column(db.Enum('Pending','Rejected','Approval','Borrowed','Return'), default='Pending')
    user = db.relationship('User')