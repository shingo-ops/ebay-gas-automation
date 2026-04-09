"""
fetch_category_master.py
eBay Taxonomy API の fetchItemAspects で全リーフカテゴリのスペックを取得
出力: category_raw_{marketplace_id}.json (--marketplace 指定時)
      category_raw.json (--combine 時に全ファイルを結合)
"""

import os
import json
import gzip
import time
import glob
import argparse
import requests

MAX_RETRIES = 3
RETRY_WAIT_SECS = [10, 30, 60]

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
    """指定マーケットプレイスの全リーフカテゴリスペックを取得（500エラー時はリトライ）"""
    url = f"{TAXONOMY_API}/category_tree/{category_tree_id}/fetch_item_aspects"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Accept-Encoding": "gzip",   # 明示指定 → requests は自動展開しない（手動展開）
    }

    for attempt in range(MAX_RETRIES):
        resp = requests.get(url, headers=headers, timeout=300)

        if resp.status_code == 500 and attempt < MAX_RETRIES - 1:
            wait = RETRY_WAIT_SECS[attempt]
            print(f"  500エラー、{wait}秒後にリトライ ({attempt + 1}/{MAX_RETRIES}) ...")
            time.sleep(wait)
            continue

        resp.raise_for_status()

        raw = resp.content
        if not raw:
            raise ValueError(f"レスポンスが空です (tree_id={category_tree_id})")

        # Accept-Encoding: gzip を明示した場合 requests は自動展開しないため手動展開
        try:
            content = gzip.decompress(raw)
        except Exception:
            content = raw

        data = json.loads(content)
        # application/json レスポンス → aspectMetadataResponses キー
        # application/octet-stream レスポンス → categoryAspects キー（フォールバック）
        return data.get("aspectMetadataResponses") or data.get("categoryAspects", [])

    raise RuntimeError(f"最大リトライ回数 ({MAX_RETRIES}) に達しました: tree_id={category_tree_id}")


def build_category_rows(aspects: list[dict], marketplace_id: str, category_tree_id: str) -> list[dict]:
    """APIレスポンスを category_master 行形式に変換"""
    rows = []
    for item in aspects:
        # application/json 形式: categoryId/categoryName がトップレベル
        # application/octet-stream 形式: category.categoryId/category.categoryName
        category = item.get("category", {})
        cat_id = category.get("categoryId") or item.get("categoryId", "")
        cat_name = category.get("categoryName") or item.get("categoryName", "")
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


def cmd_fetch(marketplace_id: str):
    """1マーケットのみ取得して category_raw_{marketplace_id}.json に保存"""
    target = next((mp for mp in MARKETPLACES if mp["marketplace_id"] == marketplace_id), None)
    if not target:
        print(f"❌ 不明なマーケットプレイス: {marketplace_id}")
        raise SystemExit(1)

    print(f"=== fetch_category_master.py [{marketplace_id}] 開始 ===")
    token = get_access_token()

    print(f"取得中: {target['marketplace_id']} (tree_id={target['category_tree_id']})")
    try:
        aspects = fetch_aspects_for_marketplace(token, target["category_tree_id"])
        rows = build_category_rows(aspects, target["marketplace_id"], target["category_tree_id"])
        print(f"  → {len(rows)} カテゴリ取得")
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            print(f"  ⚠️ {marketplace_id} は fetchItemAspects 非対応 (404)。スキップします")
            rows = []
        else:
            raise

    out_dir = os.environ.get("OUTPUT_DIR", ".")
    output_path = f"{out_dir}/category_raw_{marketplace_id}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)

    print(f"=== 完了: {len(rows)} 行 → {output_path} ===")


def cmd_combine():
    """全マーケットの category_raw_*.json を結合して category_raw.json に出力"""
    out_dir = os.environ.get("OUTPUT_DIR", ".")
    pattern = f"{out_dir}/category_raw_EBAY_*.json"
    files = sorted(glob.glob(pattern))

    if not files:
        print(f"❌ エラー: {pattern} にファイルが見つかりません")
        raise SystemExit(1)

    all_rows = []
    for path in files:
        with open(path, encoding="utf-8") as f:
            rows = json.load(f)
        print(f"  {os.path.basename(path)}: {len(rows)} 行")
        all_rows.extend(rows)

    output_path = f"{out_dir}/category_raw.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False)

    print(f"=== combine 完了: 合計 {len(all_rows)} 行 → {output_path} ===")


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")

    fetch_parser = subparsers.add_parser("fetch", help="1マーケット取得")
    fetch_parser.add_argument("marketplace_id", help="例: EBAY_US")

    subparsers.add_parser("combine", help="全マーケットファイルを結合")

    args = parser.parse_args()

    if args.command == "fetch":
        cmd_fetch(args.marketplace_id)
    elif args.command == "combine":
        cmd_combine()
    else:
        # 後方互換: 引数なしで全マーケット順次取得
        print("=== fetch_category_master.py 開始 (全マーケット) ===")
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
            json.dump(all_rows, f, ensure_ascii=False)

        print(f"=== 完了: {len(all_rows)} 行 → {output_path} ===")

        if len(all_rows) == 0:
            print(f"❌ エラー: データが0件です。失敗: {failed_markets}")
            raise SystemExit(1)


if __name__ == "__main__":
    main()
