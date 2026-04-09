"""
fetch_conditions.py
eBay Taxonomy API の getItemConditionPolicies で各カテゴリのコンディションを取得

Usage:
  fetch <MARKETPLACE_ID>  -- 1マーケットの category_raw_EBAY_XX.json を更新
  combine                 -- 全マーケットファイルを category_raw.json に結合

戦略:
  - マーケットごとに最初の SAMPLE_PER_MARKET カテゴリのみ API 取得（デフォルト20）
  - eBay のコンディション ID は市場内で繰り返されるため、サンプルで全種類を網羅できる
  - サンプル外のカテゴリは conditions_json を空のまま（integrity check はスキップされる）
"""

import os
import json
import glob
import time
import argparse
import requests

TAXONOMY_API = "https://api.ebay.com/commerce/taxonomy/v1"
SAMPLE_PER_MARKET = int(os.environ.get("CONDITIONS_SAMPLE_PER_MARKET", "20"))
API_TIMEOUT_SECS = int(os.environ.get("CONDITIONS_API_TIMEOUT", "5"))


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


def fetch_conditions_for_category(token: str, category_tree_id: str, category_id: str) -> list[dict]:
    """指定カテゴリのコンディションポリシーを取得"""
    url = (
        f"{TAXONOMY_API}/category_tree/{category_tree_id}"
        f"/get_item_condition_policies?category_id={category_id}"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    resp = requests.get(url, headers=headers, timeout=API_TIMEOUT_SECS)
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


def cmd_fetch(marketplace_id: str):
    """1マーケットの category_raw_EBAY_XX.json にコンディションを補完して上書き保存"""
    out_dir = os.environ.get("OUTPUT_DIR", ".")
    input_path = f"{out_dir}/category_raw_{marketplace_id}.json"

    print(f"=== fetch_conditions.py [{marketplace_id}] 開始 (サンプル上限: {SAMPLE_PER_MARKET}) ===")

    with open(input_path, encoding="utf-8") as f:
        rows = json.load(f)

    if not rows:
        print(f"  {marketplace_id}: データなし。スキップ")
        return

    token = get_access_token()

    processed = 0
    errors = 0
    attempts = 0  # 成否にかかわらず試行回数をカウント

    for row in rows:
        if attempts >= SAMPLE_PER_MARKET:
            break  # 試行回数上限に達したら早期終了

        tree_id = row["category_tree_id"]
        cat_id = row["category_id"]
        attempts += 1

        try:
            conditions = fetch_conditions_for_category(token, tree_id, cat_id)
            row["conditions_json"] = json.dumps(conditions, ensure_ascii=False)
            processed += 1
        except Exception as e:
            errors += 1
            row["conditions_json"] = "[]"
            if errors <= 5:
                print(f"  ⚠️ cat_id={cat_id}: {e}")

        time.sleep(0.1)

    # 上書き保存（indent なし → ファイルサイズ削減）
    with open(input_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)

    print(f"=== 完了: {processed} 件取得, {errors} 件エラー → {input_path} ===")


def cmd_combine():
    """全マーケットの category_raw_EBAY_*.json を結合して category_raw.json に出力"""
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

    fetch_parser = subparsers.add_parser("fetch", help="1マーケットのコンディションを補完")
    fetch_parser.add_argument("marketplace_id", help="例: EBAY_US")

    subparsers.add_parser("combine", help="全マーケットファイルを結合")

    args = parser.parse_args()

    if args.command == "fetch":
        cmd_fetch(args.marketplace_id)
    elif args.command == "combine":
        cmd_combine()
    else:
        parser.print_help()
        raise SystemExit(1)


if __name__ == "__main__":
    main()
