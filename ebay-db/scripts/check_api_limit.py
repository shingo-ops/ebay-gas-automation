"""
check_api_limit.py
eBay API の fetchItemAspects レートリミット状況を確認するプリフライトスクリプト

stream=True + すぐ close することでレスポンスボディをダウンロードせずに
HTTP ステータスコード（200 vs 429）だけを確認する。
ボディを読まなくてもステータスコードはヘッダーで確定するため
クォータ消費量は最小限にとどまる。

Usage:
  python ebay-db/scripts/check_api_limit.py
  EBAY_CLIENT_ID=<CLIENT_ID> EBAY_CLIENT_SECRET=<CLIENT_SECRET> python ...
"""

import os
import sys
import requests

TAXONOMY_API = "https://api.ebay.com/commerce/taxonomy/v1"

# fetchItemAspects を使う代表マーケット（1つだけ確認すれば十分）
CHECK_TREE_ID = "0"   # EBAY_US
CHECK_MARKET  = "EBAY_US"


def get_access_token(client_id: str, client_secret: str) -> str:
    resp = requests.post(
        "https://api.ebay.com/identity/v1/oauth2/token",
        auth=(client_id, client_secret),
        data={
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def check_fetch_item_aspects(token: str, tree_id: str) -> dict:
    """fetchItemAspects のステータスコードだけを確認する。

    stream=True でボディをダウンロードせず、ステータスコード取得後すぐ close。
    429 なら Retry-After ヘッダーも返す。
    """
    url = f"{TAXONOMY_API}/category_tree/{tree_id}/fetch_item_aspects"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=15, stream=True)
        status = resp.status_code
        retry_after = resp.headers.get("Retry-After", "")
        resp.close()   # ボディは読まない
        return {
            "status_code": status,
            "ok": status == 200,
            "rate_limited": status == 429,
            "retry_after": retry_after,
        }
    except requests.exceptions.Timeout:
        return {"status_code": None, "ok": False, "rate_limited": False, "retry_after": "", "error": "timeout"}
    except Exception as e:
        return {"status_code": None, "ok": False, "rate_limited": False, "retry_after": "", "error": str(e)}


def main():
    client_id     = os.environ.get("EBAY_CLIENT_ID")
    client_secret = os.environ.get("EBAY_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("❌ 環境変数 EBAY_CLIENT_ID / EBAY_CLIENT_SECRET が未設定")
        sys.exit(1)

    print("=== eBay API fetchItemAspects レートリミット確認 ===\n")

    # Step1: OAuth トークン取得
    print("[1] OAuth トークン取得...")
    try:
        token = get_access_token(client_id, client_secret)
        print("    ✅ トークン取得成功\n")
    except Exception as e:
        print(f"    ❌ トークン取得失敗: {e}")
        sys.exit(1)

    # Step2: fetchItemAspects のステータス確認（ボディは読まない）
    print(f"[2] fetchItemAspects 確認 ({CHECK_MARKET} / tree_id={CHECK_TREE_ID})...")
    result = check_fetch_item_aspects(token, CHECK_TREE_ID)

    if result.get("error"):
        print(f"    ❌ 接続エラー: {result['error']}")
        sys.exit(1)

    sc = result["status_code"]
    if result["ok"]:
        print(f"    ✅ HTTP {sc} → レートリミット解除済み")
        print("\n✅ フル同期を実行できます:")
        print("   gh workflow run sync-ebay-db.yml --repo shingo-ops/bay-auto")
    elif result["rate_limited"]:
        ra = result["retry_after"]
        if ra:
            print(f"    ⏳ HTTP 429 → まだリミット中（Retry-After: {ra}秒）")
        else:
            print(f"    ⏳ HTTP 429 → まだリミット中")
        print("\n⏳ もう少し待ってから再実行してください")
        sys.exit(1)
    else:
        print(f"    ❌ HTTP {sc} → 予期しないエラー")
        sys.exit(1)


if __name__ == "__main__":
    main()
