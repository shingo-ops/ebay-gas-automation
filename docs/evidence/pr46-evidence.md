# PR #46 エビデンス文書
# category_master × ConditionDescriptors 連携実装

**作成日**: 2026-05-02  
**対象PR**: #46  
**前提PR**: #45 (ConditionDescriptors送信実装)

---

## E1: eBay公式ドキュメントの確認

### E1-1: ConditionDescriptors が必須となるカテゴリの公式定義

**公式ソース**: [Condition Descriptor IDs for Trading Cards | eBay Developers Program](https://developer.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-condition-descriptor-ids-for-trading-cards.html)

> "For trading card listings in **Non-Sport Trading Card Singles (183050)**, **CCG Individual Cards (183454)**, and **Sports Trading Card Singles (261328)** categories, sellers must use either LIKE_NEW (2750) or USED_VERY_GOOD (4000) item condition to specify the card as Graded or Ungraded, respectively."

> "If either of these condition IDs are used, the seller is required to use this container to provide one or more applicable Condition Descriptor name-value pairs."

**参考**: [ConditionDescriptorsType - Trading API Reference](https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/ConditionDescriptorsType.html)

**結論**: 3カテゴリが公式に明示されている。

### E1-2: 各ConditionIDのConditionDescriptors要件

#### ConditionID 2750 (Graded) — ConditionDescriptors 必須

**公式ソース**: [eBay Connect 2023 Condition Grading - Trading Cards](https://developer.ebay.com/cms/files/connect-2023/condition_grading_trading_cards.pdf)

> "When using Condition ID 2750 (Graded) for trading cards, the seller is required to use the ConditionDescriptors container to provide one or more applicable Condition Descriptor name-value pairs."
> "For graded cards, the condition descriptors for Grader and Grade are **required**, while the condition descriptor for Certification Number is optional."

**XMLフォーマット**:
```xml
<ConditionID>2750</ConditionID>
<ConditionDescriptors>
  <ConditionDescriptor>
    <Name>27501</Name>  <!-- Grader -->
    <Value>275010</Value>  <!-- PSA=275010, BGS=275013, SGC=275016 ... -->
  </ConditionDescriptor>
  <ConditionDescriptor>
    <Name>27502</Name>  <!-- Grade -->
    <Value>275020</Value>  <!-- 10=275020, 9.5=275021, ... 5.5=275029 -->
  </ConditionDescriptor>
  <!-- Name=27503 (Cert No) は任意 -->
</ConditionDescriptors>
```

#### ConditionID 4000 (Ungraded) — Name=40001 が必須

**公式ソース**: [Condition Descriptor IDs for Trading Cards](https://developer.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-condition-descriptor-ids-for-trading-cards.html)

> "If the card is ungraded, enter 4000 in ConditionID. The ID **40001** represents the ungraded condition in categories 183050, 183454, and 261328."

**有効値**:
| Value | 表示 |
|-------|------|
| 400010 | Near Mint or Better |
| 400011 | Excellent (Lightly Played) |
| 400012 | Very Good (Moderately Played) |
| 400013 | Poor (Heavily Played) |

**XMLフォーマット**:
```xml
<ConditionID>4000</ConditionID>
<ConditionDescriptors>
  <ConditionDescriptor>
    <Name>40001</Name>
    <Value>400010</Value>
  </ConditionDescriptor>
</ConditionDescriptors>
```

### E1-3: ConditionID 3000 (Used) — 2023年に廃止

**公式アナウンス**: eBay Developer Program (2023年)

> "After **October 23, 2023**: NO new listings, relists, or revisions will be accepted in the trading card (singles) categories if they do not adhere to eBay's new Condition policies."
> "By **January 22, 2024**: ALL existing listings must be modified to include Condition Descriptors."

**実証**: Trading API エラー 21920350
> "Condition information 3000 does not exists or is not a valid condition for category 183454"

**参考**: [eBay Community - Error Code 21920350](https://community.ebay.com/t5/Traditional-APIs-Selling/Error-Code-21920350-Condition-information-3000-is-not-valid-for/td-p/34307514)

**現状**: Sell Metadata API は依然 3000 を有効として返す（APIの不整合）。  
Trading API では拒否されるため、category_master の conditions_json は不正確な情報を含む。  
→ `known_invalid_conditions` 列 (Phase 3候補) でこの不整合を管理予定。

### E1-4: is_trading_card_group() の判定ロジック妥当性検証

**既存ロジック** (`generate_csv.py`):
```python
def is_trading_card_group(ids: frozenset) -> bool:
    return (
        {"2750", "4000"}.issubset(ids)
        and not ids.intersection({"5000", "6000", "7000", "2500"})
    )
```

**設計根拠**:
- 2750 (Graded) + 4000 (Ungraded) = トレカカテゴリの必要条件（eBay公式から）
- 5000/6000/7000 = 一般中古品コンディション（トレカカテゴリには存在しない）
- 2500 = Seller Refurbished（トレカカテゴリには存在しない）

**EBAY_US での実データ検証結果** (category_master_EBAY_US.csv 45,915行から):

```
graded_card 該当カテゴリ: 8件
  261328  Trading Card Singles        [2750, 3000, 4000]  ← 本番利用
  183454  CCG Individual Cards        [2750, 3000, 4000]  ← 本番利用（メイン対象）
  183050  Trading Card Singles        [2750, 3000, 4000]  ← 本番利用
  178089  Category 2                  [1000, 2750, 4000]  ← テスト/sandbox
  37563   Attributes6_Test            [2750, 4000]        ← テストカテゴリ
  37566   Attributes8                 [2750, 3000, 4000]  ← テストカテゴリ
  37567   Attributes9                 [2750, 3000, 4000]  ← テストカテゴリ
  37568   Attributes10                [2750, 3000, 4000]  ← テストカテゴリ
```

**誤検知の検証**:
- 37xxx番台と178089はeBay sandbox/テスト用カテゴリ。本番出品では使用されない
- 実際に顧客が使用するカテゴリ: 261328, 183454, 183050 の3件
- 誤検知なし（非トレカカテゴリで 2750+4000 が含まれるケースは存在しない）

**見落としの検証**:
- Group E: [2750, 4000, 5000, 6000, 7000, ...] → `is_trading_card_group` = FALSE（正しく除外）
- Group G: [2750, 4000, 5000, 6000] → FALSE（正しく除外）
- これらは一般中古品カテゴリ（Magazines, Posters等）であり除外が正しい

**結論**: 判定ロジックは正確に機能している。

### E1-5: PR #45 実機検証結果（最強エビデンス）

`docs/investigations/ebay-condition-descriptors-verification-20260501.md` より:

| ケース | カテゴリ | ConditionID | ConditionDescriptors | 結果 |
|--------|----------|-------------|----------------------|------|
| 1 | 183454 | 2750 (Graded) | Grader=PSA, Grade=10 | ✅ 出品成功 |
| 3 | 183454 | 4000 (Ungraded) | Name=40001, Value=400010 | ✅ 出品成功 |
| 4 | 183454 | 4000 (Ungraded) | DescriptorsなしCGC | ❌ エラー21920355 |
| 5 | 183454 | 3000 (Used) | なし | ❌ エラー21920350 |

**エラー21920355の意味**: Ungraded (4000) でConditionDescriptors未指定は拒否される

---

## E2: 既存の設計課題の記録

### E2-1: condition_group のラベル不一致

**問題**: category_master CSV と condition_ja_map でグループラベルが一致しない

| データソース | [2750, 3000, 4000] セットのラベル | 生成タイミング |
|---|---|---|
| category_master_EBAY_US.csv (generate_csv.py) | N (動的割り当て) | 月次同期時に全カテゴリ横断で再割当 |
| condition_ja_map (SyncCategoryMaster.gs ハードコード) | O (固定) | 2026-04-10 時点スナップショット |

**影響範囲**:
- `ConditionDropdown.gs` は condition_group を使って condition_ja_map を引く
- ラベル不一致の場合、トレカカテゴリの Condition ドロップダウンが正しく機能しない可能性
- `ImportSync.gs` の `checkConditionIdExists()` で "condition_group が未登録" エラーが出る可能性

**根本原因**: `importConditionJaMap()` は手動実行専用のハードコード書き込み関数であり、`generate_csv.py` が動的にグループラベルを割り当てるロジックと同期していない

**PR #46 での対応方針**: 今回スコープ外として別issueで管理する  
**理由**: PR #46 の `descriptor_type` は `conditions_json` を直接参照するため condition_group には依存しない。condition_group 不一致は別途修正が必要だが、トレカ出品ブロックの緊急度よりも低い。  
**管理**: issue #47 として登録予定

### E2-2: conditions_json に無効な ConditionID 3000 が含まれる問題

**問題**: Sell Metadata API が依然として ConditionID 3000 を有効として返す
- Trading API は 3000 を拒否する (エラー21920350)
- 顧客が「中古」を選択して出品すると必ずエラーになる

**影響範囲**:
- 現在の error translation (Validation.gs:213-221) でエラーを日本語化して対応中
- 根本解決ではなく対症療法の状態

**将来の対応**:
```
known_invalid_conditions 列 (Phase 3) を category_master に追加:
  "183454": ["3000"]  ← 3000 は Trading API で拒否される
```
月次同期で自動的に検知できるようにする（eBay API 不整合の自動フラグ管理）。  
**管理**: Phase 3 課題として設計書に記録

---

## E3: 再発防止の網羅性確認

### E3-1: is_trading_card_group() 該当カテゴリ全件リスト (EBAY_US)

| category_id | category_name | conditions | 本番利用 |
|-------------|---------------|-----------|---------|
| 261328 | Trading Card Singles | [2750, 3000, 4000] | ✅ |
| 183454 | CCG Individual Cards | [2750, 3000, 4000] | ✅ |
| 183050 | Trading Card Singles | [2750, 3000, 4000] | ✅ |
| 178089 | Category 2 | [1000, 2750, 4000] | ❌ テスト |
| 37563 | Attributes6_Test | [2750, 4000] | ❌ テスト |
| 37566 | Attributes8 | [2750, 3000, 4000] | ❌ テスト |
| 37567 | Attributes9 | [2750, 3000, 4000] | ❌ テスト |
| 37568 | Attributes10 | [2750, 3000, 4000] | ❌ テスト |

**結論**: 顧客が実際に使用する本番カテゴリは 3 件（261328, 183454, 183050）。  
テストカテゴリは検出されるが、本番出品では使用されないため実害なし。

### E3-2: 今後eBayが新たにConditionDescriptors必須カテゴリを追加した場合

**自動検出フロー**:
1. Sell Metadata API が新カテゴリに 2750/4000 を返す
2. 月次同期で `generate_csv.py` が `is_trading_card_group()` により `descriptor_type = "graded_card"` を自動設定
3. category_master に反映 → 同期後、自動的にバリデーション対象になる

**検出できないケース**:
- eBay が新たな ConditionDescriptors タイプを追加した場合（e.g., コインのGrading）
- この場合は `get_descriptor_type()` に新タイプを追加する必要がある
- **対応フロー**: eBay Developer Program のアナウンスを監視し、必要時に対応

**結論**: 月次同期で自動追跡できる。新カテゴリが出現しても追加コードなしで対応可能。

### E3-3: Grader/Grade 入力ミスパターンの網羅性確認

| パターン | 現状の対応 | PR #46後 |
|---------|-----------|----------|
| Grader あり + Grade なし | ❌ バリデーションエラー (ListingManager.gs:531) | 変更なし（既存で対応済み） |
| Grade あり + Grader なし | ❌ バリデーションエラー (ListingManager.gs:534) | 変更なし（既存で対応済み） |
| 両方空 + Card Condition も空（トレカカテゴリ） | ✅ **サイレント失敗** → PR #46 で修正 | ❌ バリデーションエラー |
| Grade が 5.5〜10 範囲外 | ❌ `_GRADE_VALUE_MAP_` に存在しないキー → Gradeがnullに | 変更なし（将来対応） |
| CGC を Grader に入力 | Other (2750123) として送信、警告なし | 変更なし（将来対応） |
| 非トレカカテゴリで Grader/Grade 入力 | 無視されて通常出品 | 変更なし（仕様通り） |

**PR #46 の修正範囲**: 「両方空 + Card Condition も空（トレカカテゴリ）」のサイレント失敗のみ  
残りは別途対応検討（優先度低）

---

## 既知の制限事項（実装後も残る課題）

| 制限 | 内容 | 対応方針 |
|------|------|---------|
| Grade は 5.5〜10 のみ対応 | eBay API の `_GRADE_VALUE_MAP_` 定義による | eBay APIが追加した場合に対応 |
| CGC は Other 扱い | eBayの公式リストに CGC が存在しない | 現状維持（Other送信で問題なし） |
| condition_group N/O 不一致 | Condition ドロップダウンに影響の可能性 | issue #47 として別途修正 |
| 3000 (Used) が conditions_json に残留 | Metadata API の不整合 | Phase 3: known_invalid_conditions |
| EBAY_GB/DE/AU のトレカカテゴリ | EBAY_US のみ検証済み | 英/独/豪向け出品時に別途確認 |

---

## 将来の課題 (Phase 3+)

```markdown
Phase 3: known_invalid_conditions 列の追加
  目的: Trading API で拒否されるが Metadata API が有効と返す ConditionID を管理
  実装: category_master に known_invalid_conditions JSON 列を追加
  対象: 183454, 261328, 183050 の ConditionID 3000

Phase 4: Column auto-suggestion
  目的: トレカカテゴリ選択時に Grader/Grade 列の追加を自動提案
  実装: onEdit トリガーで列がなければダイアログで案内
  前提: PR #46 のバリデーション警告が先
```

---

*エビデンス作成: Claude Sonnet 4.6 / 2026-05-02*
