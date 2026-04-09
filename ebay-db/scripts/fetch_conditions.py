"""
fetch_conditions.py
eBay Sell Metadata API の getItemConditionPolicies で全カテゴリのコンディションを取得

Usage:
  fetch <MARKETPLACE_ID>  -- 1マーケットの category_raw_EBAY_XX.json を更新
  combine                 -- 全マーケットファイルを category_raw.json に結合

エンドポイント:
  GET /sell/metadata/v1/marketplace/{marketplace_id}/get_item_condition_policies
  → マーケットの全カテゴリのコンディションポリシーを paginate して一括取得
  → category_id をキーにしてマッピング後、category_raw に適用する
  → Application token（client_credentials）で利用可能

注: commerce/taxonomy/v1 の get_item_condition_policies は fetchItemAspects の
    category_id と互換性がないため使用しない。
"""

import os
import json
import glob
import argparse
import requests

SELL_METADATA_API = "https://api.ebay.com/sell/metadata/v1"
PAGE_LIMIT = int(os.environ.get("CONDITIONS_PAGE_LIMIT", "100"))   # max 100
API_TIMEOUT_SECS = int(os.environ.get("CONDITIONS_API_TIMEOUT", "30"))


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


def fetch_all_condition_policies(token: str, marketplace_id: str) -> dict:
    """マーケットの全カテゴリのコンディションポリシーを一括取得。

    Returns:
        dict: {category_id (str): [{"id", "name", "enum", "category_display"}, ...]}
    """
    url = f"{SELL_METADATA_API}/marketplace/{marketplace_id}/get_item_condition_policies"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    cat_conditions: dict[str, list[dict]] = {}
    offset = 0

    while True:
        resp = requests.get(
            url,
            headers=headers,
            params={"limit": PAGE_LIMIT, "offset": offset},
            timeout=API_TIMEOUT_SECS,
        )
        if resp.status_code == 204:
            break
        resp.raise_for_status()

        data = resp.json()
        policies = data.get("itemConditionPolicies", [])

        for policy in policies:
            cat_id = str(policy.get("categoryId", ""))
            conditions = []
            for cond in policy.get("itemConditions", []):
                conditions.append({
                    "id":               cond.get("conditionId", ""),
                    "name":             cond.get("conditionDescription", ""),
                    "enum":             cond.get("conditionEnum", ""),
                    "category_display": cond.get("conditionDescription", ""),
                })
            cat_conditions[cat_id] = conditions

        total = data.get("total", 0)
        offset += len(policies)
        print(f"    ページ取得: {offset}/{total} カテゴリ")

        if offset >= total or not policies:
            break

    return cat_conditions


def cmd_fetch(marketplace_id: str):
    """1マーケットのコンディションポリシーを一括取得して category_raw を更新"""
    out_dir = os.environ.get("OUTPUT_DIR", ".")
    input_path = f"{out_dir}/category_raw_{marketplace_id}.json"

    print(f"=== fetch_conditions.py [{marketplace_id}] 開始 ===")

    with open(input_path, encoding="utf-8") as f:
        rows = json.load(f)

    if not rows:
        print(f"  {marketplace_id}: データなし。スキップ")
        return

    token = get_access_token()

    print(f"  sell/metadata/v1 からポリシーを一括取得中...")
    cat_conditions = fetch_all_condition_policies(token, marketplace_id)
    print(f"  {len(cat_conditions)} カテゴリのポリシーを取得完了")

    matched = 0
    for row in rows:
        cat_id = str(row.get("category_id", ""))
        if cat_id in cat_conditions:
            row["conditions_json"] = json.dumps(cat_conditions[cat_id], ensure_ascii=False)
            matched += 1
        else:
            row["conditions_json"] = "[]"

    with open(input_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)

    print(f"=== 完了: {matched}/{len(rows)} 件マッチ → {input_path} ===")


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
