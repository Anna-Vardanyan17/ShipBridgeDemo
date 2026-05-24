"""
PackRoute demo API
==================
Serves order data and shipping booking for the fulfillment demo site.

Run locally:
    pip install -r requirements.txt
    python server.py

Then open http://localhost:5000
"""

from __future__ import annotations

import json
import random
import string
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
SITE_DIR = BASE_DIR.parent / "site"
DATA_FILE = SITE_DIR / "data" / "orders.json"

app = Flask(__name__, static_folder=str(SITE_DIR), static_url_path="")


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_orders() -> list[dict]:
    with DATA_FILE.open(encoding="utf-8") as f:
        return json.load(f)["orders"]


def save_orders(orders: list[dict]) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as f:
        json.dump({"orders": orders}, f, indent=2, ensure_ascii=False)


SHIPPING_METHODS = [
    {"id": "post_std", "carrier": "Israel Post", "service": "Standard", "eta_days": 3, "price": 18.0},
    {"id": "post_exp", "carrier": "Israel Post", "service": "Express", "eta_days": 1, "price": 32.5},
    {"id": "hfd_std", "carrier": "HFD", "service": "Standard", "eta_days": 2, "price": 22.0},
    {"id": "hfd_exp", "carrier": "HFD", "service": "Express", "eta_days": 1, "price": 38.0},
    {"id": "fed_int", "carrier": "FedEx", "service": "International", "eta_days": 5, "price": 95.0},
]

# Simulated incoming orders from an external e-commerce platform
INCOMING_STORE_ORDERS = [
    {
        "id": "ORD-10490",
        "created_at": "2026-05-23T07:30:00Z",
        "status": "new",
        "customer": {
            "name": "Yael Mizrahi",
            "email": "yael.m@email.com",
            "phone": "+972-54-222-3344",
            "address": "7 Allenby St",
            "city": "Tel Aviv",
            "country": "IL",
            "postal_code": "6510501",
        },
        "seller": {
            "name": "KidsWorld Shop",
            "warehouse": "Netanya, Poleg Industrial 4",
            "contact": "ship@kidsworld.shop",
        },
        "items": [
            {"sku": "KW-PUZ-100", "name": "Puzzle Set 100pc", "qty": 1, "price": 79.0},
        ],
        "total": 79.0,
        "currency": "ILS",
        "weight_kg": 0.8,
    }
]


@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


@app.route("/")
def index():
    return send_from_directory(SITE_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(SITE_DIR, path)


@app.route("/api/orders", methods=["GET"])
def get_orders():
    return jsonify(load_orders())


@app.route("/api/orders/<order_id>", methods=["GET"])
def get_order(order_id: str):
    orders = load_orders()
    order = next((o for o in orders if o["id"] == order_id), None)
    if not order:
        return jsonify({"error": "Order not found"}), 404
    return jsonify(order)


@app.route("/api/orders/<order_id>/ready", methods=["POST"])
def mark_ready(order_id: str):
    orders = load_orders()
    for order in orders:
        if order["id"] == order_id:
            if order["status"] != "new":
                return jsonify({"error": "Order is not in 'new' status"}), 400
            order["status"] = "ready_to_ship"
            save_orders(orders)
            return jsonify(order)
    return jsonify({"error": "Order not found"}), 404


@app.route("/api/shipping-methods", methods=["GET"])
def shipping_methods():
    weight = float(request.args.get("weight", 1))
    methods = deepcopy(SHIPPING_METHODS)
    for m in methods:
        if weight > 2:
            m["price"] = round(m["price"] + (weight - 2) * 6.5, 2)
    return jsonify(methods)


@app.route("/api/orders/<order_id>/ship", methods=["POST"])
def book_shipping(order_id: str):
    payload = request.get_json(force=True, silent=True) or {}
    method_id = payload.get("method_id")
    if not method_id:
        return jsonify({"error": "method_id required"}), 400

    method = next((m for m in SHIPPING_METHODS if m["id"] == method_id), None)
    if not method:
        return jsonify({"error": "Invalid shipping method"}), 400

    orders = load_orders()
    for order in orders:
        if order["id"] == order_id:
            if order["status"] not in ("ready_to_ship", "new"):
                return jsonify({"error": "Order cannot be shipped in current status"}), 400

            tracking = "PR" + "".join(random.choices(string.digits, k=10))
            order["status"] = "shipped"
            order["shipping"] = {
                "carrier": method["carrier"],
                "service": method["service"],
                "tracking": tracking,
                "cost": method["price"],
                "weight_kg": payload.get("weight_kg"),
                "declared_value": payload.get("declared_value"),
                "booked_at": _utc_now(),
            }
            save_orders(orders)
            return jsonify(order)

    return jsonify({"error": "Order not found"}), 404


@app.route("/api/sync", methods=["POST"])
def sync_from_store():
    """Pull new orders from simulated e-commerce store API."""
    orders = load_orders()
    existing_ids = {o["id"] for o in orders}
    added = []

    for incoming in INCOMING_STORE_ORDERS:
        if incoming["id"] not in existing_ids:
            orders.insert(0, deepcopy(incoming))
            added.append(incoming["id"])

    save_orders(orders)
    return jsonify({"synced": len(added), "order_ids": added, "total_orders": len(orders)})


if __name__ == "__main__":
    print("PackRoute demo → http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
