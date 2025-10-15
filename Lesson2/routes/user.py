from flask import Blueprint, request, jsonify
from models import User, Borrow
from flask_jwt_extended import create_access_token, get_jwt_identity
from utils import token_required

user_bp = Blueprint('users', __name__)

@user_bp.route("/login", methods=["POST"])
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

@user_bp.route("/my-borrows", methods=["GET"])
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

