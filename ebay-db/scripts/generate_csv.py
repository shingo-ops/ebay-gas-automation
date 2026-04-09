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

# condition_enum ハードコードマッピング
# sell/metadata/v1 getItemConditionPolicies は conditionEnum を返さないため静的定義
CONDITION_ENUM_MAP: dict[str, str] = {
    "1000": "NEW",
    "1500": "NEW_OTHER",
    "1750": "NEW_WITH_DEFECTS",
    "2000": "CERTIFIED_REFURBISHED",
    "2010": "EXCELLENT_REFURBISHED",
    "2020": "VERY_GOOD_REFURBISHED",
    "2030": "GOOD_REFURBISHED",
    "2500": "SELLER_REFURBISHED",
    "2750": "LIKE_NEW",
    "2990": "PRE_OWNED_EXCELLENT",
    "3000": "USED_EXCELLENT",
    "3010": "PRE_OWNED_FAIR",
    "4000": "USED_VERY_GOOD",
    "5000": "USED_GOOD",
    "6000": "USED_ACCEPTABLE",
    "7000": "FOR_PARTS_OR_NOT_WORKING",
}


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
    """condition_ja_map.csv を生成（condition_id でユニーク化）

    全カテゴリ網羅後は同一 condition_id が大量の category_id に紐付くため、
    condition_id を主キーとして最初の出現を採用する。
    """
    fieldnames = [
        "condition_id", "condition_name", "condition_enum",
        "ja_display", "ja_description", "last_synced",
    ]

    seen: dict[str, dict] = {}
    for row in rows:
        conditions_json = row.get("conditions_json", "[]")
        if not conditions_json or conditions_json == "[]":
            continue
        try:
            conditions = json.loads(conditions_json)
        except Exception:
            continue

        for c in conditions:
            cid = str(c.get("id", ""))
            if not cid or cid in seen:
                continue
            seen[cid] = {
                "condition_id":   cid,
                "condition_name": c.get("name", ""),
                "condition_enum": CONDITION_ENUM_MAP.get(cid, c.get("enum", "")),
                "ja_display":     "",   # GeminiTranslate.gs で補完
                "ja_description": "",
                "last_synced":    TODAY,
            }

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
