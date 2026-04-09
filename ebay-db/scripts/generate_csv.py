"""
generate_csv.py
category_raw.json + fvf_rates.json を結合して
category_master.csv と condition_ja_map.csv を生成
"""

import os
import json
import csv
from datetime import datetime, timezone

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", ".")
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")


def load_json(path: str) -> any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def generate_category_master(rows: list[dict], fvf_rates: dict) -> None:
    """マーケットプレイスごとに category_master_EBAY_XX.csv を生成

    スペック列（required/recommended/optional_specs_json）は除外する。
    218MBになりGitHub 100MB制限・Google Sheets制限を超えるため。
    """
    fieldnames = [
        "marketplace_id", "category_tree_id", "category_id", "category_name",
        "conditions_json", "fvf_rate", "last_synced",
    ]

    # マーケットプレイスごとに分類
    by_market: dict[str, list[dict]] = {}
    for row in rows:
        mp = row.get("marketplace_id", "UNKNOWN")
        by_market.setdefault(mp, []).append(row)

    total = 0
    for mp, mp_rows in sorted(by_market.items()):
        output_path = f"{OUTPUT_DIR}/category_master_{mp}.csv"
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            fvf_map = fvf_rates.get(mp, {})
            for row in mp_rows:
                cat_name = row.get("category_name", "")

                # FVF レートをカテゴリ名で紐付け（部分一致）
                fvf_rate = ""
                for key, rate in fvf_map.items():
                    if key.lower() in cat_name.lower() or cat_name.lower() in key.lower():
                        fvf_rate = rate
                        break

                writer.writerow({
                    "marketplace_id":   mp,
                    "category_tree_id": row.get("category_tree_id", ""),
                    "category_id":      row.get("category_id", ""),
                    "category_name":    cat_name,
                    "conditions_json":  row.get("conditions_json", "[]"),
                    "fvf_rate":         fvf_rate,
                    "last_synced":      TODAY,
                })

        print(f"  {output_path}: {len(mp_rows)} 行")
        total += len(mp_rows)

    print(f"category_master_EBAY_*.csv 生成完了: 合計 {total} 行")


def generate_condition_ja_map(rows: list[dict]) -> None:
    """condition_ja_map.csv を生成（重複なし・ユニーク condition_id + category_display）"""
    fieldnames = [
        "condition_id", "condition_name", "condition_enum",
        "category_display", "category_ids", "ja_display", "ja_description", "last_synced",
    ]

    # condition_id + category_display の組み合わせでユニーク化
    seen = {}
    for row in rows:
        conditions_json = row.get("conditions_json", "[]")
        category_id = row.get("category_id", "")
        try:
            conditions = json.loads(conditions_json)
        except Exception:
            continue

        for c in conditions:
            cid = str(c.get("id", ""))
            cdisplay = c.get("category_display", c.get("name", ""))
            key = f"{cid}|{cdisplay}"

            if key not in seen:
                seen[key] = {
                    "condition_id":    cid,
                    "condition_name":  c.get("name", ""),
                    "condition_enum":  c.get("enum", ""),
                    "category_display": cdisplay,
                    "category_ids":    category_id,
                    "ja_display":      "",   # GeminiTranslate.gs で補完
                    "ja_description":  "",
                    "last_synced":     TODAY,
                }
            else:
                # 既出の condition だが別カテゴリでも使われる場合は category_ids に追記
                existing_ids = seen[key]["category_ids"]
                if category_id and category_id not in existing_ids.split(","):
                    seen[key]["category_ids"] = existing_ids + "," + category_id

    output_path = f"{OUTPUT_DIR}/condition_ja_map.csv"
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for entry in seen.values():
            writer.writerow(entry)

    print(f"condition_ja_map.csv 生成: {len(seen)} 行 → {output_path}")


def main():
    print("=== generate_csv.py 開始 ===")

    category_raw = load_json(f"{OUTPUT_DIR}/category_raw.json")
    fvf_rates = load_json(f"{OUTPUT_DIR}/fvf_rates.json")

    generate_category_master(category_raw, fvf_rates)
    generate_condition_ja_map(category_raw)

    print("=== 完了 ===")


if __name__ == "__main__":
    main()
