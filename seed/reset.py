"""Reset only Daywell Market's local database. Run: python -m seed.reset"""
import os
from pathlib import Path
from backend.storage import SQLiteStorage

DATA_DIR = (Path(__file__).resolve().parents[1] / "backend" / "data").resolve()
DB_PATH = Path(os.environ.get("DAYWELL_DB_PATH", DATA_DIR / "demomart.sqlite3")).resolve()
if not DB_PATH.is_relative_to(DATA_DIR):
    raise ValueError("DAYWELL_DB_PATH must stay inside backend/data")
CATALOG = [
    ("p01", "Ridgeline recurve bow", "Recurve bows", 18900, "recurve-bow.webp", "A balanced take-down recurve with a warm wood riser for range sessions.", 4.8),
    ("p02", "Summit compound bow", "Compound bows", 34900, "compound-bow.webp", "A compact, steady compound bow for fictional target practice.", 4.7),
    ("p03", "Cedar target arrows — set of 6", "Arrows", 3900, "arrows.webp", "Six matching target arrows with natural shafts and green fletching.", 4.9),
    ("p04", "Heritage leather quiver", "Quivers & cases", 6800, "quiver.webp", "A classic back quiver with an adjustable strap and rich brown finish.", 4.6),
    ("p05", "Round straw practice target", "Targets", 5900, "straw-target.webp", "A traditional round target for a fictional backyard range.", 4.8),
    ("p06", "Woodland longbow", "Longbows", 22900, "longbow.webp", "A simple traditional longbow with a comfortable wrapped grip.", 4.7),
    ("p07", "Field foam target block", "Targets", 7900, "foam-target.webp", "A portable layered foam block for repeat target sessions.", 4.7),
    ("p08", "Trail leather arm guard", "Gloves & protection", 2800, "arm-guard.webp", "Adjustable leather forearm protection with a soft inner face.", 4.8),
    ("p09", "Three-finger shooting glove", "Gloves & protection", 2400, "shooting-glove.webp", "Supple leather finger protection for traditional archery practice.", 4.5),
    ("p10", "Padded bow carry case", "Quivers & cases", 8900, "bow-case.webp", "A sturdy padded case with carry handles for range-day gear.", 4.6),
    ("p11", "First Flight recurve bow", "Recurve bows", 12900, "ashwood-recurve.webp", "A light 10 lb introductory recurve with a dark walnut finish for first range sessions.", 4.7),
    ("p12", "Pinecrest compound bow", "Compound bows", 49900, "pinecrest-compound.webp", "A premium hunting-inspired compound design in a forest-green finish; fictional display gear.", 4.8),
    ("p13", "Hearthwood longbow", "Longbows", 25900, "hearthwood-longbow.webp", "A graceful one-piece longbow with a warm honey wood tone.", 4.6),
    ("p14", "Trailmark sport crossbow", "Crossbows", 29900, "trailmark-crossbow.webp", "A compact sporting crossbow presented as fictional range gear.", 4.7),
    ("p15", "Northline crossbow", "Crossbows", 54900, "northline-crossbow.webp", "A premium hunting-inspired crossbow silhouette for this fictional catalog.", 4.8),
    ("p16", "Carbon target arrows — set of 6", "Arrows", 5400, "carbon-arrows.webp", "Six straight carbon-look arrows with bright orange target fletching.", 4.8),
    ("p17", "Aluminum practice arrows — set of 6", "Arrows", 4400, "aluminum-arrows.webp", "Six lightweight practice arrows with blue-and-white vanes.", 4.6),
    ("p18", "Range leather shooting glove", "Gloves & protection", 3200, "range-glove.webp", "A soft leather shooting glove with reinforced fingertips.", 4.7),
]


def seed(storage):
    hunting_style = {"p12", "p15"}
    bow_ids = {"p01", "p02", "p06", "p11", "p12", "p13", "p14", "p15"}
    draw_weights = {
        "p01": (20, 20), "p02": (20, 40), "p06": (30, 30), "p11": (10, 10),
        "p12": (45, 60), "p13": (40, 40), "p14": (150, 150), "p15": (175, 175),
    }
    for pid, name, category, price, image, description, rating in CATALOG:
        use_case = "Hunting style" if pid in hunting_style else "Beginner" if pid == "p11" else "Recreational" if pid in bow_ids else None
        draw_weight_lb = {"min": draw_weights[pid][0], "max": draw_weights[pid][1]} if pid in bow_ids else None
        storage.put("products", pid, dict(id=pid, name=name, category=category, price=price, image=image, use_case=use_case, draw_weight_lb=draw_weight_lb, description=description, rating=rating, reviews=[{"author": "Jordan P.", "rating": 5, "text": "Looks great in my practice kit. A fictional favorite."}, {"author": "Morgan L.", "rating": 4, "text": "A solid addition to my synthetic range setup."}]))
    for account, product in [("alice", "p01"), ("bob", "p02")]:
        storage.put("customers", account, {"id": account, "name": account.title(), "address": account.title() + ", 100 Example Lane, Fiction City, ZZ 00000"})
        storage.put("orders", "ord-" + account + "-001", {"id": "ord-" + account + "-001", "customer_id": account, "date": "2026-10-12", "status": "Delivered", "address": account.title() + ", 100 Example Lane, Fiction City, ZZ 00000", "items": [{"product_id": product, "name": storage.get("products", product)["name"], "quantity": 1, "unit_price": storage.get("products", product)["price"]}], "total": storage.get("products", product)["price"], "transaction": "synthetic-no-payment"})


if __name__ == "__main__":
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    seed(SQLiteStorage(DB_PATH))
    print("Reset synthetic catalog, accounts, orders, carts, sessions and audit events:", DB_PATH)
