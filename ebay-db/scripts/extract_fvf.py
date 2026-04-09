"""
extract_fvf.py
eBay 公式料率ページ HTML → Gemini 2.5 Flash-Lite で FVF レートを抽出
出力: fvf_rates.json  { "EBAY_US": { "category_id": rate, ... }, ... }
"""

import os
import json
import requests

GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"

FVF_PAGES = {
    "EBAY_US": "https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822",
    "EBAY_GB": "https://www.ebay.co.uk/help/selling/fees-credits-invoices/selling-fees?id=4822",
}


def fetch_fvf_page(url: str) -> str:
    """料率ページの HTML を取得"""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ebay-db-sync/1.0)"}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.text[:50000]  # 最大 50,000 文字（トークン節約）


def extract_fvf_with_gemini(html: str, marketplace_id: str) -> dict:
    """Gemini 2.5 Flash-Lite で HTML からカテゴリ別 FVF レートを抽出"""
    api_key = os.environ["GEMINI_API_KEY"]

    prompt = (
        f"以下は eBay ({marketplace_id}) の販売手数料ページの HTML です。\n"
        "カテゴリ名と最終価値手数料(FVF)率(%)のリストを JSON 配列で返してください。\n"
        "形式: [{\"category_name\": \"Electronics\", \"fvf_rate\": 13.25}]\n\n"
        f"HTML:\n{html}"
    )

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "category_name": {"type": "STRING"},
                        "fvf_rate": {"type": "NUMBER"},
                    },
                    "required": ["category_name", "fvf_rate"],
                },
            },
        },
    }

    resp = requests.post(
        f"{GEMINI_API}?key={api_key}",
        json=body,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    resp.raise_for_status()

    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    rates_list = json.loads(text)

    # category_name → fvf_rate の辞書に変換
    return {item["category_name"]: item["fvf_rate"] for item in rates_list}


def main():
    print("=== extract_fvf.py 開始 ===")
    all_rates = {}

    for marketplace_id, url in FVF_PAGES.items():
        print(f"取得中: {marketplace_id} ({url})")
        try:
            html = fetch_fvf_page(url)
            rates = extract_fvf_with_gemini(html, marketplace_id)
            all_rates[marketplace_id] = rates
            print(f"  → {len(rates)} カテゴリのレートを抽出")
        except Exception as e:
            print(f"  ⚠️ {marketplace_id} 取得失敗: {e}")
            all_rates[marketplace_id] = {}

    output_path = os.environ.get("OUTPUT_DIR", ".") + "/fvf_rates.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_rates, f, ensure_ascii=False, indent=2)

    print(f"=== 完了 → {output_path} ===")


if __name__ == "__main__":
    main()
