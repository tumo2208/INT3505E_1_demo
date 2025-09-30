from flask import Flask, request, jsonify
from models import db, Book, Borrow
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:naksu2204@localhost/library'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route("/books", methods=["GET"])
def get_books():
    books = Book.query.all()
    if not books:
        return jsonify({"error": "No books found"}), 404
    return jsonify([
        {"id": b.id, "title": b.title, "author": b.author, "available": b.available}
        for b in books
    ]), 200

@app.route("/books/<string:title>", methods=["GET"])
def get_book_by_title(title):
    books = Book.query.filter(Book.title.ilike(f"%{title}%")).all()

    if not books:
        return jsonify({
            "message": "No books found"
        }), 404

    return jsonify([
        {"id": b.id, "title": b.title, "author": b.author, "available": b.available}
        for b in books
    ]), 200

@app.route("/books", methods=["POST"])
def add_book():
    data = request.json
    book = Book(title=data["title"], author=data["author"], available=True)
    db.session.add(book)
    db.session.commit()
    return jsonify({"message": "Book added", "id": book.id}), 201

@app.route("/books/borrow", methods=["POST"])
def borrow_book():
    data = request.json
    book = Book.query.get(data["book_id"])
    if not book:
        return jsonify({"error": "Book not found"}), 404
    if not book.available:
        return jsonify({"error": "Book already borrowed"}), 400

    borrow = Borrow(borrower=data["borrower"], book_id=book.id, borrow_date=datetime.now())
    book.available = False
    db.session.add(borrow)
    db.session.commit()
    return jsonify({"message": f"{data['borrower']} borrowed {book.title}", "borrow_id": borrow.id}), 201

@app.route("books/return/<int:borrow_id>", methods=["PUT"])
def return_book(borrow_id):
    borrow = Borrow.query.get(borrow_id)
    if not borrow:
        return jsonify({"error": "Borrow record not found"}), 404
    if borrow.return_date:
        return jsonify({"error": "Book already returned"}), 400

    borrow.return_date = datetime.now()
    borrow.book.available = True
    db.session.commit()
    return jsonify({"message": f"{borrow.book.title} returned"})

@app.route("books/history", methods=["GET"])
def history():
    borrows = Borrow.query.all()
    return jsonify([
        {
            "id": b.id,
            "borrower": b.borrower,
            "book": b.book.title,
            "borrow_date": b.borrow_date.strftime("%Y-%m-%d %H:%M:%S"),
            "return_date": b.return_date.strftime("%Y-%m-%d %H:%M:%S") if b.return_date else None
        }
        for b in borrows
    ])

if __name__ == "__main__":
    app.run(debug=True, port=3001)