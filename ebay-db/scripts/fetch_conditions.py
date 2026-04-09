"""
fetch_conditions.py
eBay Taxonomy API の getItemConditionPolicies で各カテゴリのコンディションを取得

戦略:
  - マーケットごとに最初の SAMPLE_PER_MARKET カテゴリのみ API 取得（デフォルト100）
  - eBay のコンディション ID は市場内で繰り返されるため、サンプルで全種類を網羅できる
  - サンプル外のカテゴリは conditions_json を空のまま（integrity check はスキップされる）
  - condition_ja_map のユニーク ID 収集には十分
"""

import os
import json
import time
import requests
from collections import defaultdict

TAXONOMY_API = "https://api.ebay.com/commerce/taxonomy/v1"
SAMPLE_PER_MARKET = int(os.environ.get("CONDITIONS_SAMPLE_PER_MARKET", "100"))


def get_access_token() -> str:
    client_id = os.environ["EBAY_CLIENT_ID"]
    client_secret = os.environ["EBAY_CLIENT_SECRET"]

    resp = requests.post(
        "https://api.ebay.com/identity/v1/oauth2/token",
        auth=(client_id, client_secret),
        data={
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_conditions(token: str, category_tree_id: str, category_id: str) -> list[dict]:
    """指定カテゴリのコンディションポリシーを取得"""
    url = (
        f"{TAXONOMY_API}/category_tree/{category_tree_id}"
        f"/get_item_condition_policies?category_id={category_id}"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    resp = requests.get(url, headers=headers, timeout=30)
    if resp.status_code == 204:
        return []
    resp.raise_for_status()

    data = resp.json()
    conditions = []
    for policy in data.get("itemConditionPolicies", []):
        for cond in policy.get("itemConditions", []):
            conditions.append({
                "id": cond.get("conditionId", ""),
                "name": cond.get("conditionDescription", ""),
                "enum": cond.get("conditionEnum", ""),
                "category_display": cond.get("conditionDescription", ""),
            })
    return conditions


def main():
    print(f"=== fetch_conditions.py 開始 (サンプル上限: {SAMPLE_PER_MARKET}/マーケット) ===")

    input_path = os.environ.get("OUTPUT_DIR", ".") + "/category_raw.json"
    with open(input_path, encoding="utf-8") as f:
        rows = json.load(f)

    token = get_access_token()

    # マーケットプレイスごとのサンプル数カウント
    market_counts: dict[str, int] = defaultdict(int)
    processed = 0
    skipped = 0
    errors = 0

    for row in rows:
        tree_id = row["category_tree_id"]
        cat_id = row["category_id"]
        mp_id = row["marketplace_id"]

        # 既取得済みはスキップ
        if row.get("conditions_json") and row["conditions_json"] != "[]":
            continue

        # マーケットごとのサンプル上限チェック
        if market_counts[mp_id] >= SAMPLE_PER_MARKET:
            skipped += 1
            continue

        try:
            conditions = fetch_conditions(token, tree_id, cat_id)
            row["conditions_json"] = json.dumps(conditions, ensure_ascii=False)
            market_counts[mp_id] += 1
            processed += 1
        except Exception as e:
            errors += 1
            row["conditions_json"] = "[]"
            if errors <= 10:
                print(f"  ⚠️ cat_id={cat_id}: {e}")

        # レート制限対策
        time.sleep(0.1)

        if processed % 50 == 0 and processed > 0:
            counts_str = ", ".join(f"{k}={v}" for k, v in market_counts.items())
            print(f"  進捗: {processed} 件取得 ({counts_str})")

    output_path = os.environ.get("OUTPUT_DIR", ".") + "/category_raw.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"=== 完了: {processed} 件取得, {skipped} 件スキップ(上限超), {errors} 件エラー ===")
    for mp, count in market_counts.items():
        print(f"  {mp}: {count} カテゴリ取得")


if __name__ == "__main__":
    main()
