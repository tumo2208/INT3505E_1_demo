from flask import jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required, get_jwt


def token_required(role=None):
    def decorator(fn):
        from functools import wraps
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            identity = get_jwt_identity()
            claims = get_jwt()
            if role and claims.get("role") != role:
                return jsonify({"msg": "Access denied"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator