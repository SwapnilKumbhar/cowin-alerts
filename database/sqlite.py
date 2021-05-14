import sqlite3
from config import DB_PATH

CON = sqlite3.connect(DB_PATH)
SELECT_SQL = (
    "SELECT DISTINCT user_id FROM user_pincodes WHERE pincode IN ({placeholders})"
)


def getRolesForPincodes(pincodes):
    placeholders = ", ".join("?" * len(pincodes))
    sql = SELECT_SQL.format(placeholders=placeholders)
    result = CON.execute(sql, pincodes)
    ids = list(map(lambda p: p[0], result.fetchall()))
    return ids
