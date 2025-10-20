from flask import Blueprint, jsonify, request
from models import db, User
from utils import token_required
import re

users_v2_bp = Blueprint("users_v2", __name__)

@users_v2_bp.route("/registration", methods=["POST"])
@token_required(role="librarian")
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")
    phone = data.get("phone")

    if not password:
        return jsonify({"error": "Missing password (v2)"}), 400

    if not email or not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", email):
        return jsonify({"error": "Email is not valid (v2)"}), 400

    if not phone or not re.match(r"^\d{10}$", phone):
        return jsonify({"error": "Phone number is not valid (v2)"}), 400

    if not role:
        role = "user"

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email is already registered"}), 400

    user = User(email=email, role=role, phone=phone)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "Tạo user thành công (v2)"
    }), 201