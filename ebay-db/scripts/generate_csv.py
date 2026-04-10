"""
generate_csv.py
category_raw.json + fvf_rates.json を結合して
category_master_EBAY_XX.csv と condition_ja_map.csv を生成

condition_group 設計:
  全カテゴリ・全マーケットの conditions_json を分析し、
  同一の condition_id セットを持つカテゴリを同じグループ（A/B/C...）に分類。
  - category_master_EBAY_XX.csv に condition_group 列を追加（15列）
  - condition_ja_map.csv を 1グループ1行の構造に変更（6列）
"""

import os
import json
import csv
from datetime import datetime, timezone

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", ".")
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")

# condition_enum ハードコードマッピング
# sell/metadata/v1 getItemConditionPolicies は conditionEnum を返さないため静的定義
CONDITION_ENUM_MAP: dict[int, str] = {
    1000: "NEW",
    1500: "NEW_OTHER",
    1750: "NEW_WITH_DEFECTS",
    1900: "UNUSED",
    2000: "CERTIFIED_REFURBISHED",
    2010: "EXCELLENT_REFURBISHED",
    2020: "VERY_GOOD_REFURBISHED",
    2030: "GOOD_REFURBISHED",
    2500: "SELLER_REFURBISHED",
    2750: "LIKE_NEW",
    2990: "PRE_OWNED_EXCELLENT",
    3000: "USED_EXCELLENT",
    3010: "PRE_OWNED_FAIR",
    4000: "USED_VERY_GOOD",
    5000: "USED_GOOD",
    6000: "USED_ACCEPTABLE",
    7000: "FOR_PARTS_OR_NOT_WORKING",
}

# ja_display デフォルト値（eBay標準コンディション向け）
JA_DISPLAY_DEFAULT: dict[int, str] = {
    1000: "新品/未使用",
    1500: "未使用に近い",
    1750: "新品/未使用（訳あり）",
    1900: "未使用",
    2000: "メーカー整備済み",
    2010: "整備済み - 非常に良い",
    2020: "整備済み - 良い",
    2030: "整備済み - やや傷あり",
    2500: "整備済み",
    2750: "ほぼ新品",
    2990: "目立った傷や汚れなし",
    3000: "目立った傷や汚れなし",
    3010: "傷や汚れあり",
    4000: "やや傷や汚れあり",
    5000: "傷や汚れあり",
    6000: "全体的に状態が悪い",
    7000: "ジャンク品",
}

# トレカ系グループ用の特別表記
JA_DISPLAY_TRADING_CARD: dict[str, str] = {
    "2750": "鑑定済み（Graded）",
    "3000": "中古",
    "4000": "未鑑定（Ungraded）",
}


def load_json(path: str) -> any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def is_trading_card_group(ids: frozenset) -> bool:
    """トレカ系グループ判定

    2750（Like New）と4000（Very Good）を含み、
    かつ消耗品的なコンディション（5000/6000/7000/2500）を含まないグループ。
    → Trading Card Singles / CCG 等の鑑定済み/未鑑定系カテゴリ
    """
    return (
        {"2750", "4000"}.issubset(ids)
        and not ids.intersection({"5000", "6000", "7000", "2500"})
    )


def is_apparel_group(ids: frozenset) -> bool:
    """アパレル系グループ判定

    1750（New with defects）・2990（Pre-owned Excellent）・3010（Pre-owned Fair）を
    すべて含むグループ → 衣類・ファッション系カテゴリ
    """
    return {"1750", "2990", "3010"}.issubset(ids)


def build_ja_map_json(condition_items: list[dict], ids: frozenset) -> str:
    """グループの ja_map_json を生成

    JA_DISPLAY_DEFAULT をベースに、グループ種別で上書き・曖昧さ回避を適用。

    優先順:
      1. TCG グループ: 2750→鑑定済み（Graded）, 3000→中古, 4000→未鑑定（Ungraded）
      2. アパレルグループ: 1000→新品・タグ付き
      3. デフォルト
      4. 曖昧さ回避: 2990+3000 共存 → 3000に「（使用感あり）」付加
                     3010+5000 共存 → 5000に「（使用感あり）」付加

    Args:
        condition_items: conditions_json のパース済みリスト
        ids: condition_id の frozenset

    Returns:
        JSON文字列 {"1000": "新品/未使用", ...}
    """
    tcg = is_trading_card_group(ids)
    apparel = is_apparel_group(ids)
    ja_map: dict[str, str] = {}

    for item in condition_items:
        cid = str(item.get("id", ""))
        if not cid:
            continue
        cid_int = int(cid) if cid.isdigit() else None

        if tcg and cid in JA_DISPLAY_TRADING_CARD:
            ja_map[cid] = JA_DISPLAY_TRADING_CARD[cid]
        elif apparel and cid == "1000":
            ja_map[cid] = "新品・タグ付き"
        else:
            ja_map[cid] = JA_DISPLAY_DEFAULT.get(cid_int, "")

    # 曖昧さ回避: 2990（Pre-owned Excellent）と3000（Used Excellent）が共存
    if "2990" in ja_map and "3000" in ja_map:
        ja_map["3000"] = "目立った傷や汚れなし（使用感あり）"

    # 曖昧さ回避: 3010（Pre-owned Fair）と5000（Good）が共存
    if "3010" in ja_map and "5000" in ja_map:
        ja_map["5000"] = "傷や汚れあり（使用感あり）"

    return json.dumps(ja_map, ensure_ascii=False)


def build_condition_groups(
    rows: list[dict],
) -> tuple[list[str], dict[frozenset, dict]]:
    """全行の conditions_json を分析してグループを割り当てる

    全マーケット横断で同一の condition_id セットを同じグループラベル（A/B/C...）に分類。
    グループ数が26を超える場合は "27", "28", ... の文字列ラベルを使用。

    Args:
        rows: category_raw.json の全行（全マーケット）

    Returns:
        row_group_labels: rows と並行した各行のグループラベルリスト
        group_registry: {frozenset(ids): {label, ids, count, examples, condition_items}}
    """
    groups: dict[frozenset, str] = {}
    group_registry: dict[frozenset, dict] = {}
    group_counter = 0
    row_group_labels: list[str] = []

    for row in rows:
        try:
            conds = json.loads(row.get("conditions_json", "[]") or "[]")
            ids = frozenset(
                str(c["id"]) for c in conds if isinstance(c, dict) and "id" in c
            )
        except Exception:
            ids = frozenset()
            conds = []

        if ids not in groups:
            label = (
                chr(65 + group_counter) if group_counter < 26 else str(group_counter + 1)
            )
            groups[ids] = label
            group_registry[ids] = {
                "label": label,
                "ids": ids,
                "count": 0,
                "examples": [],
                "condition_items": conds,
            }
            group_counter += 1

        label = groups[ids]
        info = group_registry[ids]
        info["count"] += 1
        cat_name = row.get("category_name", "")
        if cat_name and len(info["examples"]) < 3:
            info["examples"].append(cat_name)

        row_group_labels.append(label)

    return row_group_labels, group_registry


def generate_category_master(
    rows: list[dict], fvf_rates: dict, row_group_labels: list[str]
) -> None:
    """マーケットプレイスごとに category_master_EBAY_XX.csv を生成（15列）

    列定義: marketplace_id, category_tree_id, category_id, category_name,
            required_specs_json, recommended_specs_json, optional_specs_json,
            aspect_values_json, aspect_modes_json, multi_value_aspects_json,
            conditions_json, condition_group, fvf_rate, fvf_note, last_synced
    """
    fieldnames = [
        "marketplace_id", "category_tree_id", "category_id", "category_name",
        "required_specs_json", "recommended_specs_json", "optional_specs_json",
        "aspect_values_json", "aspect_modes_json", "multi_value_aspects_json",
        "conditions_json", "condition_group", "fvf_rate", "fvf_note", "last_synced",
    ]

    # マーケットプレイスごとに分類（行インデックスを保持）
    by_market: dict[str, list[tuple[int, dict]]] = {}
    for idx, row in enumerate(rows):
        mp = row.get("marketplace_id", "UNKNOWN")
        by_market.setdefault(mp, []).append((idx, row))

    total = 0
    for mp, indexed_rows in sorted(by_market.items()):
        output_path = f"{OUTPUT_DIR}/category_master_{mp}.csv"
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            fvf_map = fvf_rates.get(mp, {})
            for idx, row in indexed_rows:
                cat_name = row.get("category_name", "")

                # FVF レートをカテゴリ名で紐付け（部分一致）
                fvf_rate = ""
                fvf_note = ""
                for key, info in fvf_map.items():
                    if key.lower() in cat_name.lower() or cat_name.lower() in key.lower():
                        fvf_rate = info.get("fvf_rate", "")
                        fvf_note = info.get("fvf_note", "")
                        break

                writer.writerow({
                    "marketplace_id":           mp,
                    "category_tree_id":         row.get("category_tree_id", ""),
                    "category_id":              row.get("category_id", ""),
                    "category_name":            cat_name,
                    "required_specs_json":      row.get("required_specs_json",      "[]"),
                    "recommended_specs_json":   row.get("recommended_specs_json",   "[]"),
                    "optional_specs_json":      row.get("optional_specs_json",      "[]"),
                    "aspect_values_json":       row.get("aspect_values_json",       "{}"),
                    "aspect_modes_json":        row.get("aspect_modes_json",        "{}"),
                    "multi_value_aspects_json": row.get("multi_value_aspects_json", "[]"),
                    "conditions_json":          row.get("conditions_json",          "[]"),
                    "condition_group":          row_group_labels[idx],
                    "fvf_rate":                 fvf_rate,
                    "fvf_note":                 fvf_note,
                    "last_synced":              TODAY,
                })

        print(f"  {output_path}: {len(indexed_rows)} 行")
        total += len(indexed_rows)

    print(f"category_master_EBAY_*.csv 生成完了: 合計 {total} 行（condition_group列追加）")


def generate_condition_ja_map(group_registry: dict[frozenset, dict]) -> None:
    """condition_ja_map.csv を生成（1グループ1行）

    ヘッダー:
      condition_group   : グループラベル（A/B/C...）
      condition_ids_json: [1000, 3000] 等（整数配列JSON）
      ja_map_json       : {"1000": "新品、未使用", ...}
      category_count    : 該当カテゴリ数
      example_categories: 代表カテゴリ名3つ（カンマ区切り）
      last_synced       : 更新日

    トレカ系グループ（2750/4000含み 5000/6000/7000/2500 不含）は
    2750 → 鑑定済み / 4000 → 未鑑定 を適用。
    """
    fieldnames = [
        "condition_group", "condition_ids_json", "ja_map_json",
        "category_count", "example_categories", "last_synced",
    ]

    # グループラベル順でソート
    sorted_groups = sorted(group_registry.values(), key=lambda g: g["label"])

    output_path = f"{OUTPUT_DIR}/condition_ja_map.csv"
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for g in sorted_groups:
            ids = g["ids"]

            # condition_ids_json: 数値昇順でソート
            sorted_ids = sorted(ids, key=lambda x: int(x) if x.isdigit() else 0)
            condition_ids_json = json.dumps(
                [int(x) if x.isdigit() else x for x in sorted_ids],
                ensure_ascii=False,
            )

            # condition_items を condition_id 昇順にソート
            items_sorted = sorted(
                g["condition_items"],
                key=lambda c: int(str(c.get("id", 0))) if str(c.get("id", "")).isdigit() else 0,
            )

            writer.writerow({
                "condition_group":    g["label"],
                "condition_ids_json": condition_ids_json,
                "ja_map_json":        build_ja_map_json(items_sorted, ids),
                "category_count":     g["count"],
                "example_categories": ", ".join(g["examples"]),
                "last_synced":        TODAY,
            })

    print(f"condition_ja_map.csv 生成: {len(sorted_groups)} グループ → {output_path}")

    # サマリー出力
    for g in sorted_groups:
        tcg_mark = " [TCG]" if is_trading_card_group(g["ids"]) else ""
        ids_str = sorted(g["ids"], key=lambda x: int(x) if x.isdigit() else 0)
        print(f"  グループ{g['label']}{tcg_mark}: {ids_str} → {g['count']}カテゴリ")


def main():
    print("=== generate_csv.py 開始 ===")

    category_raw = load_json(f"{OUTPUT_DIR}/category_raw.json")
    fvf_rates = load_json(f"{OUTPUT_DIR}/fvf_rates.json")

    # Step1: グローバルグループ計算（全マーケット横断）
    print("[Step1] condition_group グループ計算中...")
    row_group_labels, group_registry = build_condition_groups(category_raw)
    print(f"  グループ数: {len(group_registry)}")

    # 未定義 condition_id の警告
    all_ids_in_groups = set()
    for ids in group_registry:
        all_ids_in_groups.update(ids)
    undefined = sorted(
        (cid for cid in all_ids_in_groups if not (cid.isdigit() and int(cid) in CONDITION_ENUM_MAP)),
        key=lambda x: int(x) if x.isdigit() else x,
    )
    if undefined:
        print(f"[WARN] マッピング辞書未定義の condition_id ({len(undefined)} 件): "
              + ", ".join(undefined))
    else:
        print("[INFO] 未定義 condition_id なし（全IDがマッピング済み）")

    # Step2: category_master CSV生成
    print("[Step2] category_master_EBAY_*.csv 生成中...")
    generate_category_master(category_raw, fvf_rates, row_group_labels)

    # Step3: condition_ja_map CSV生成
    print("[Step3] condition_ja_map.csv 生成中...")
    generate_condition_ja_map(group_registry)

    print("=== 完了 ===")


if __name__ == "__main__":
    main()
