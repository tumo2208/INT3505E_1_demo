from flask import Flask, request, jsonify
from models import db, Book, Author
from sqlalchemy.orm import joinedload

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:naksu2204@localhost/library_2'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()


# Route /bad (Gây ra lỗi N+1)
@app.route('/bad')
def bad_route():
    authors = Author.query.all()

    results = []

    for author in authors:
        author_data = author.to_dict()
        results.append(author_data)

    return jsonify(results)


# Route /good (Giải quyết lỗi N+1) Sử dụng left join
@app.route('/good')
def good_route():
    authors = Author.query.options(
        joinedload(Author.books)
    ).all()

    results = []

    for author in authors:
        author_data = author.to_dict()
        results.append(author_data)

    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True, port=3001)