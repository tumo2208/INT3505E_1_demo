from flask import Blueprint, request, jsonify
from models import db, User, Borrow
from flask_jwt_extended import create_access_token, get_jwt_identity
from utils import token_required
import re

users_v1_bp = Blueprint("users_v1", __name__)

@users_v1_bp.route("/registration", methods=["POST"])
@token_required(role="librarian")
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not password:
        return jsonify({"error": "Missing password (v1)"}), 400

    if not email or not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", email):
        return jsonify({"error": "Email is not valid (v2)"}), 400

    if not role:
        role = "user"

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email is already registered"}), 400

    user = User(email=email, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "Tạo user thành công (v1)"
    }), 201

@users_v1_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    user = User.query.filter_by(email=email).first()
    if not user or not user.verify(password):
        return jsonify({"msg": "Invalid credentials"}), 401
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role}
    )
    return jsonify({"access_token": token, "role": user.role}), 201

@users_v1_bp.route("/my-borrows", methods=["GET"])
@token_required(role='user')
def my_borrows():
    identity = get_jwt_identity()
    borrows = Borrow.query.filter_by(user_id=int(identity)).all()
    if not borrows:
        return jsonify({"msg": "No borrow history"}), 400

    return jsonify([
        {
            "id": b.id,
            "book_id_list": b.book_id_list,
            "status": b.status,
            "borrowed_at": b.borrowed_at,
            "due_date": b.due_date,
            "returned_at": b.returned_at
        }
        for b in borrows
    ]), 200

