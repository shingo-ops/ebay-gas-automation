"""
fetch_conditions.py
eBay Taxonomy API の getItemConditionPolicies で全カテゴリのコンディションを取得

Usage:
  fetch <MARKETPLACE_ID>  -- 1マーケットの category_raw_EBAY_XX.json を更新
  combine                 -- 全マーケットファイルを category_raw.json に結合

戦略:
  - 全カテゴリを対象に BATCH_SIZE 件ずつ並列で API 取得
  - ThreadPoolExecutor(max_workers=BATCH_SIZE) で各バッチを並列処理
  - 1バッチのうち最も遅いレスポンスが終わってから次バッチを開始
"""

import os
import json
import glob
import argparse
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

TAXONOMY_API = "https://api.ebay.com/commerce/taxonomy/v1"
BATCH_SIZE = int(os.environ.get("CONDITIONS_BATCH_SIZE", "50"))
API_TIMEOUT_SECS = int(os.environ.get("CONDITIONS_API_TIMEOUT", "10"))


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


def _fetch_one(args: tuple) -> tuple:
    """ThreadPoolExecutor 用ワーカー: (token, tree_id, cat_id, row_idx) → (row_idx, conditions, error)"""
    token, tree_id, cat_id, row_idx = args
    try:
        conditions = fetch_conditions_for_category(token, tree_id, cat_id)
        return row_idx, conditions, None
    except Exception as e:
        return row_idx, [], str(e)


def cmd_fetch(marketplace_id: str):
    """1マーケットの全カテゴリのコンディションを BATCH_SIZE 件並列で取得して上書き保存"""
    out_dir = os.environ.get("OUTPUT_DIR", ".")
    input_path = f"{out_dir}/category_raw_{marketplace_id}.json"

    print(f"=== fetch_conditions.py [{marketplace_id}] 開始 (batch_size={BATCH_SIZE}) ===")

    with open(input_path, encoding="utf-8") as f:
        rows = json.load(f)

    if not rows:
        print(f"  {marketplace_id}: データなし。スキップ")
        return

    token = get_access_token()
    total = len(rows)
    processed = 0
    errors = 0
    report_interval = BATCH_SIZE * 10  # 500件ごとに進捗報告

    for batch_start in range(0, total, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, total)
        tasks = [
            (token, rows[i]["category_tree_id"], rows[i]["category_id"], i)
            for i in range(batch_start, batch_end)
        ]

        with ThreadPoolExecutor(max_workers=len(tasks)) as executor:
            futures = [executor.submit(_fetch_one, task) for task in tasks]
            for future in as_completed(futures):
                row_idx, conditions, err = future.result()
                rows[row_idx]["conditions_json"] = json.dumps(conditions, ensure_ascii=False)
                if err:
                    errors += 1
                    if errors <= 5:
                        print(f"  ⚠️ row_idx={row_idx}: {err}")
                else:
                    processed += 1

        # 一定間隔で進捗報告
        if batch_end % report_interval == 0 or batch_end == total:
            pct = batch_end * 100 // total
            print(f"  進捗: {batch_end}/{total} ({pct}%) processed={processed} errors={errors}")

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
