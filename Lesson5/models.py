from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()


class Author(db.Model):
    __tablename__ = 'author'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

    books = db.relationship('Book', backref='author', lazy='select')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'books': [book.title for book in self.books]
        }


class Book(db.Model):
    __tablename__ = 'book'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('author.id'), nullable=False)