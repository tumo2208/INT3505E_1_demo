from flask import Blueprint, request, jsonify
from models import db, Book
from utils import token_required, checked_redis, saved_to_redis

book_bp = Blueprint('books', __name__)

@book_bp.route("/", methods=["GET"])
def find_books():
    cache_key = request.args.get("query")
    if not cache_key:
        cache_key = "AKA_FIND_BOOK_EMPTY_QUERY"
    if checked_redis(cache_key):
        return checked_redis(cache_key)

    search = request.args.get("query")
    query = Book.query

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Book.title.ilike(pattern)) | (Book.author.ilike(pattern))
        )

    books = query.all()
    if not books:
        return jsonify({"message": "No books found."}), 404

    data = [
        {
            "id": b.id,
            "title": b.title,
            "author": b.author,
            "num_copies": b.num_copies
        }
        for b in books
    ]

    return saved_to_redis(data, cache_key)

@book_bp.route("/", methods=["POST"])
@token_required(role='librarian')
def add_book():
    data = request.get_json()
    book = Book(title=data["title"], author=data.get("author"), num_copies=data.get("num_copies", 1))
    db.session.add(book)
    db.session.commit()
    return jsonify({"msg": "Book added", "id": book.id}), 201