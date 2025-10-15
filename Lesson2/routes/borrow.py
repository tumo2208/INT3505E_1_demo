from flask import Blueprint, request, jsonify
from models import db, Borrow
from flask_jwt_extended import get_jwt_identity
from datetime import date, timedelta, datetime
from utils import token_required

borrow_bp = Blueprint('borrows', __name__)

@borrow_bp.route("/", methods=["POST"])
@token_required(role='user')
def request_borrow():
    identity = get_jwt_identity()
    data = request.get_json()
    book_id_list = data.get("book_id_list")

    if not book_id_list:
        return jsonify({"msg": "List books want to borrow is empty"}), 400

    borrow = Borrow(user_id=int(identity), book_id_list=book_id_list, status="Pending")
    db.session.add(borrow)
    db.session.commit()
    return jsonify({"msg": "Borrow request created", "id": borrow.id}), 201

@borrow_bp.route("/pending", methods=["GET"])
@token_required(role='librarian')
def list_pending():
    borrows = Borrow.query.filter_by(status="Pending").all()
    if not borrows:
        return jsonify({"msg": "No pending borrows to list"}), 400
    return jsonify([
        {"id": b.id, "user_id": b.user_id, "book_id_list": b.book_id_list, "status": b.status}
        for b in borrows
    ]), 200

@borrow_bp.route("/<int:borrow_id>/approve", methods=["PUT"])
@token_required(role='librarian')
def approve_borrow(borrow_id):
    borrow = Borrow.query.get_or_404(borrow_id)
    if borrow.status != "Pending":
        return jsonify({"msg": "Already processed"}), 400
    borrow.status = "Approval"
    borrow.due_date = date.today() + timedelta(days=14)
    db.session.commit()
    return jsonify({"msg": "Borrow approved", "due_date": borrow.due_date})

@borrow_bp.route("/<int:borrow_id>/return", methods=["PUT"])
@token_required(role='librarian')
def mark_return(borrow_id):
    borrow = Borrow.query.get_or_404(borrow_id)
    borrow.status = "Return"
    borrow.returned_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"msg": "Marked as returned"})