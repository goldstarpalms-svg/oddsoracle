"""Naija Daily Picks - Flask server.

Run:  python3 app/server.py   (binds 0.0.0.0:5000)
Serves the dashboard + JSON API over the files in daily/ and results/.
"""
import json
import os

from flask import Flask, jsonify, send_from_directory, request

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(HERE, "daily")
WEB = os.path.join(HERE, "web")
RESULTS = os.path.join(HERE, "results")

app = Flask(__name__, static_folder=None)


@app.route("/")
def index():
    return send_from_directory(WEB, "index.html")


@app.route("/api/meta")
def api_meta():
    p = os.path.join(HERE, "app_meta.json")
    return jsonify(json.load(open(p)) if os.path.exists(p) else {"dates": []})


@app.route("/api/day")
def api_day():
    date = request.args.get("date")
    if not date or "/" in date or ".." in date:
        return jsonify({"error": "bad date"}), 400
    p = os.path.join(DAILY, f"{date}.json")
    if not os.path.exists(p):
        return jsonify({"error": f"no data for {date}"}), 404
    return jsonify(json.load(open(p)))


@app.route("/api/basketball")
def api_basketball():
    date = request.args.get("date", "2026-09-18")
    if "/" in date or ".." in date:
        return jsonify({"error": "bad date"}), 400
    p = os.path.join(DAILY, f"{date}_basketball.json")
    if not os.path.exists(p):
        return jsonify({"error": f"no basketball data for {date}"}), 404
    return jsonify(json.load(open(p)))


@app.route("/api/tennis")
def api_tennis():
    date = request.args.get("date", "2026-09-18")
    if "/" in date or ".." in date:
        return jsonify({"error": "bad date"}), 400
    p = os.path.join(DAILY, f"{date}_tennis.json")
    if not os.path.exists(p):
        return jsonify({"error": f"no tennis data for {date}"}), 404
    return jsonify(json.load(open(p)))


@app.route("/api/history")
def api_history():
    p = os.path.join(RESULTS, "history.json")
    if not os.path.exists(p):
        return jsonify({"days": {}, "cumulative": {}})
    return jsonify(json.load(open(p)))


@app.route("/api/daily/<path:fn>")
def daily_file(fn):
    return send_from_directory(DAILY, fn)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
