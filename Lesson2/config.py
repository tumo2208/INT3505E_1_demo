from dotenv import load_dotenv
import os

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
DB_PASSWORD = os.getenv("DB_PASSWORD")

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': DB_PASSWORD,
    'database': 'library'
}
