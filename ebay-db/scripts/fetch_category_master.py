"""
fetch_category_master.py
eBay Taxonomy API の fetchItemAspects で全リーフカテゴリのスペックを取得
出力: category_raw.json
"""

import os
import json
import gzip
import requests

MARKETPLACES = [
    {"marketplace_id": "EBAY_US", "category_tree_id": "0"},
    {"marketplace_id": "EBAY_GB", "category_tree_id": "3"},
    {"marketplace_id": "EBAY_DE", "category_tree_id": "77"},
    {"marketplace_id": "EBAY_AU", "category_tree_id": "15"},
    {"marketplace_id": "EBAY_JP", "category_tree_id": "1"},
]

TAXONOMY_API = "https://api.ebay.com/commerce/taxonomy/v1"


def get_access_token() -> str:
    """eBay OAuth2 Client Credentials でアクセストークンを取得"""
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


def fetch_aspects_for_marketplace(token: str, category_tree_id: str) -> list[dict]:
    """指定マーケットプレイスの全リーフカテゴリスペックを取得"""
    url = f"{TAXONOMY_API}/category_tree/{category_tree_id}/fetch_item_aspects"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/octet-stream",
    }

    resp = requests.get(url, headers=headers, timeout=300, stream=True)
    resp.raise_for_status()

    # fetchItemAspects は常に gzip 圧縮バイナリ（application/octet-stream）を返す
    raw = resp.content
    try:
        decompressed = gzip.decompress(raw)
    except gzip.BadGzipFile:
        # gzip でない場合はそのまま
        decompressed = raw
    data = json.loads(decompressed)

    return data.get("categoryAspects", [])


def build_category_rows(aspects: list[dict], marketplace_id: str, category_tree_id: str) -> list[dict]:
    """APIレスポンスを category_master 行形式に変換"""
    rows = []
    for item in aspects:
        category = item.get("category", {})
        cat_id = category.get("categoryId", "")
        cat_name = category.get("categoryName", "")
        aspect_list = item.get("aspects", [])

        required, recommended, optional = [], [], []
        for asp in aspect_list:
            usage = asp.get("aspectConstraint", {}).get("aspectUsage", "OPTIONAL")
            entry = {
                "name": asp.get("localizedAspectName", ""),
                "values": [v.get("localizedValue", "") for v in asp.get("aspectValues", [])[:50]],
            }
            if usage == "REQUIRED":
                required.append(entry)
            elif usage == "RECOMMENDED":
                recommended.append(entry)
            else:
                optional.append(entry)

        rows.append({
            "marketplace_id": marketplace_id,
            "category_tree_id": category_tree_id,
            "category_id": cat_id,
            "category_name": cat_name,
            "required_specs_json": json.dumps(required, ensure_ascii=False),
            "recommended_specs_json": json.dumps(recommended, ensure_ascii=False),
            "optional_specs_json": json.dumps(optional, ensure_ascii=False),
            "conditions_json": "",      # fetch_conditions.py で補完
            "fvf_rate": "",             # extract_fvf.py で補完
            "last_synced": "",          # generate_csv.py で補完
        })
    return rows


def main():
    print("=== fetch_category_master.py 開始 ===")
    token = get_access_token()
    all_rows = []
    failed_markets = []

    for mp in MARKETPLACES:
        print(f"取得中: {mp['marketplace_id']} (tree_id={mp['category_tree_id']})")
        try:
            aspects = fetch_aspects_for_marketplace(token, mp["category_tree_id"])
            rows = build_category_rows(aspects, mp["marketplace_id"], mp["category_tree_id"])
            all_rows.extend(rows)
            print(f"  → {len(rows)} カテゴリ取得")
        except Exception as e:
            failed_markets.append(mp["marketplace_id"])
            print(f"  ⚠️ {mp['marketplace_id']} 取得失敗: {e}")

    output_path = os.environ.get("OUTPUT_DIR", ".") + "/category_raw.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=2)

    print(f"=== 完了: {len(all_rows)} 行 → {output_path} ===")

    # 全マーケットプレイス失敗 or データ0件なら異常終了
    if len(all_rows) == 0:
        print(f"❌ エラー: データが0件です。失敗: {failed_markets}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
