from flask import jsonify, request, make_response
from flask_jwt_extended import get_jwt_identity, jwt_required, get_jwt
from datetime import datetime, timedelta
import hashlib, json
import redis

redis_connector = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

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

def generate_etag(data):
    json_str = json.dumps(data, sort_keys=True)
    return hashlib.md5(json_str.encode('utf-8')).hexdigest()

def checked_redis(key):
    cached_json = redis_connector.get(key)
    if cached_json:
        cached = json.loads(cached_json)
        etag = cached["etag"]

        if request.headers.get("If-None-Match") == etag:
            return "", 304

        resp = make_response(jsonify(cached["data"]))
        resp.headers["ETag"] = etag
        resp.headers["Cache-Control"] = "public, max-age=3600"
        return resp, 200

    return None

def saved_to_redis(data, cache_key):
    etag = generate_etag(data)
    cached_value = {"data": data, "etag": etag, "timestamp": datetime.utcnow().isoformat()}
    redis_connector.setex(cache_key, timedelta(seconds=3600), json.dumps(cached_value))

    resp = make_response(jsonify(data), 200)
    resp.headers["ETag"] = etag
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp