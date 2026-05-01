# category_master × ConditionDescriptors 必須スペック連携 詳細設計調査

**調査日**: 2026-05-02  
**調査対象リポジトリ**: bay-auto (~/ebay-gas-automation)  
**背景PR**: #45 (ConditionDescriptors実装 - パターンB: 手動列管理方式)  
**目的**: category_master を参照してカテゴリ選択だけで必要スペックを自動判定する設計案の策定

---

## Task 1: 現在の category_master 構造

### 1-1. 列構造

`category_master_EBAY_XX.csv` は現在 **15列**:

| # | 列名 | 型 | 内容 |
|---|------|----|------|
| 1 | `marketplace_id` | string | EBAY_US / EBAY_GB / EBAY_DE / EBAY_AU |
| 2 | `category_tree_id` | int | 0/3/77/15 |
| 3 | `category_id` | string | eBayカテゴリID |
| 4 | `category_name` | string | カテゴリ名 |
| 5 | `required_specs_json` | JSON array | 必須スペック名リスト |
| 6 | `recommended_specs_json` | JSON array | 推奨スペック名リスト |
| 7 | `optional_specs_json` | JSON array | 任意スペック名リスト |
| 8 | `aspect_values_json` | JSON object | スペックの選択肢一覧 |
| 9 | `aspect_modes_json` | JSON object | スペックのモード (FREE_TEXT / SELECTION_ONLY) |
| 10 | `multi_value_aspects_json` | JSON array | 複数選択可スペック名リスト |
| 11 | `conditions_json` | JSON array | 有効なConditionオブジェクト一覧 |
| 12 | `condition_group` | string | A-Z のグループラベル |
| 13 | `fvf_rate` | float | 最終落札手数料率 |
| 14 | `fvf_note` | string | 手数料注記 |
| 15 | `last_synced` | date | 最終同期日 |

**重要**: `conditions_json` の各オブジェクト形式は `{"id": "2750", "name": "Graded", "enum": "", "category_display": "Graded"}`.

### 1-2. カテゴリ 183454 (CCG Individual Cards) の実データ

```
marketplace_id : EBAY_US
category_id    : 183454
category_name  : CCG Individual Cards
required_specs_json    : ["Game"]
recommended_specs_json : ["Card Name", "Character", "Grade", "Age Level", "Card Type",
                          "Speciality", "Set", "Rarity", "Features", "Language",
                          "Manufacturer", "Finish", "Graded", "Card Condition",
                          "Professional Grader", "Certification Number", ...]
conditions_json: [
  {"id": "2750", "name": "Graded",   "category_display": "Graded"},
  {"id": "3000", "name": "Used",     "category_display": "Used"},
  {"id": "4000", "name": "Ungraded", "category_display": "Ungraded"}
]
condition_group: N  ← 後述の注意点参照
fvf_rate       : (空)
last_synced    : 2026-05-01
```

**観察**: `recommended_specs_json` に "Grade", "Graded", "Card Condition", "Professional Grader" が含まれているが、これは Item Specifics (Taxonomy API) の情報であり、ConditionDescriptors (Trading API) とは別物。

### 1-3. ConditionDescriptors に関する情報

現在の category_master には **ConditionDescriptors に関する列は存在しない**。  
ただし `conditions_json` に ConditionID 2750 (Graded) または 4000 (Ungraded) が含まれているかを見ることで、  
ConditionDescriptors が必要なカテゴリかどうかを**既存データのみで判定できる**。

### 1-4. condition_group の注意点 (不一致)

| データソース | カテゴリ183454のグループ | [2750, 3000, 4000] セットのラベル |
|---|---|---|
| category_master CSV (generate_csv.py 動的生成) | N | N |
| condition_ja_map (SyncCategoryMaster.gs ハードコード) | O | O |

**不一致が存在する**: CSVのcondition_group "N" とcondition_ja_mapの "O" が同じ条件セットを表している。  
`generate_csv.py` はカテゴリ出現順で A/B/C... を割り当てるため、月次同期のたびに変わりうる。  
`SyncCategoryMaster.gs` の `importConditionJaMap()` は2026-04-10時点のスナップショットをハードコードしている。  
この不一致は既存の設計課題として別途対応が必要だが、本調査のスコープ外とする。

### 1-5. トレカ系グループ判定ロジック

`generate_csv.py` に既存の `is_trading_card_group()` 関数:

```python
def is_trading_card_group(ids: frozenset) -> bool:
    return (
        {"2750", "4000"}.issubset(ids)
        and not ids.intersection({"5000", "6000", "7000", "2500"})
    )
```

つまり「2750 と 4000 を両方含み、かつ消耗品的コンディションを含まない」= トレカ系カテゴリ。  
**このロジックは追加APIコール不要で、既存 conditions_json から完全に導出できる。**

---

## Task 2: eBay API で取得可能な ConditionDescriptors 仕様情報

### 2-1. GetCategoryFeatures

- **ステータス**: **deprecated** (docs/investigations/ebay-condition-error-21920350-investigation-20260501.md に記載)
- **現状**: 調査ドキュメント内のテスト関数として存在するのみ。本番コードには未使用。
- **FeatureID**: ConditionValues, ConditionDescriptorInfo を指定すれば ConditionDescriptors 対応情報を取得できるが、deprecated API の使用は推奨しない。

### 2-2. 現行の月次同期 API

| API | 用途 | ConditionDescriptors情報 |
|-----|------|--------------------------|
| Taxonomy API (`fetch_item_aspects`) | required/recommended/optional スペック | なし |
| Sell Metadata API (`getItemConditionPolicies`) | conditions_json | ConditionID のみ (Descriptorsメタなし) |

**結論**: 月次同期で利用する既存 API からは ConditionDescriptors の詳細仕様（有効なGrader/Grade値ID等）は取得できない。  
ただし「そのカテゴリでConditionDescriptorsが必要かどうか」は conditions_json から判定可能。

### 2-3. GetCategorySpecifics

- Item Specifics に関する情報を返すが、ConditionDescriptors とは異なる概念（Item Specifics は Taxonomy API 経由で取得済み）。
- ConditionDescriptors の仕様情報は含まれない。

### 2-4. まとめ

ConditionDescriptors の **有効な Grader/Grade の ValueID マッピング** (e.g., PSA→275010, 10点→275020) は eBay API から動的取得できず、ハードコードが必要（現状の実装通り）。  
**「このカテゴリでConditionDescriptorsが必要か」** という判定のみが今回の設計対象であり、これは既存データで導出可能。

---

## Task 3: 設計オプション評価

### オプション1: category_master に ConditionDescriptors 情報を追加

**追加列案**:

| 列名 | 型 | 内容 | 自動導出可否 |
|------|----|------|-------------|
| `requires_condition_descriptors` | boolean | TRUE/FALSE | ✅ conditions_json から導出可 |
| `descriptor_type` | string | `graded_card` / `none` | ✅ is_trading_card_group() で判定 |

**自動導出ロジック** (generate_csv.py に追加するだけ):
```python
def get_descriptor_type(ids: frozenset) -> str:
    if is_trading_card_group(ids):
        return "graded_card"
    return "none"
```

**評価**:

| 観点 | 評価 |
|------|------|
| 追加APIコール | なし (既存データから導出) |
| 月次同期への組み込み | ✅ generate_csv.py に数行追加するだけ |
| ebay-db スキーマ変更コスト | 小 (CSV列追加のみ、GAS側でヘッダー参照するだけ) |
| 将来の他カテゴリ拡張性 | ✅ 高 (新カテゴリが2750/4000を持てば自動検出) |
| condition_group不一致問題との関係 | 独立 (conditions_json直接参照のため影響なし) |
| 実装コスト | 小 |

**グループX, Z も対象**:  
SyncCategoryMaster.gs の条件グループ確認により、他にも ConditionDescriptors 対象グループが存在:
- グループ O: [2750, 3000, 4000] → トレカ系 (183454など) ← **メイン対象**
- グループ X: [1000, 2750, 4000] → トレカ+新品あり (is_trading_card_group判定: FALSE ← 5000/6000/7000不含かつ2750/4000含む → TRUE)
- グループ Z: [2750, 4000] → トレカのみ
- グループ E: [1000, 1500, 1750, 2500, 2750, 3000, 4000, 5000, 6000, 7000] → 混在 (is_trading_card_group: FALSE ← 5000/6000/7000含む)

**注**: グループ X ([1000, 2750, 4000]) と グループ Z ([2750, 4000]) は `is_trading_card_group()` の定義上 TRUE になる（5000/6000/7000/2500なし、2750/4000あり）。これら少数カテゴリも自動的に対象になる。

---

### オプション2: ハードコードリストで対応

```javascript
const GRADED_CARD_CATEGORIES = ['183454', '261328', '183050', ...];
```

**評価**:

| 観点 | 評価 |
|------|------|
| 実装コスト | 最小 |
| カテゴリ追加時 | ❌ コード変更が必要 |
| ebay-db との整合性 | ❌ なし |
| 将来の他カテゴリ拡張性 | ❌ 低 |
| category_master 設計思想との整合性 | ❌ 外れる |

カテゴリ183454以外のトレカ系カテゴリが将来増えた際に、コード変更漏れのリスクがある。

---

### オプション3: 出品時に GetCategoryFeatures を動的呼び出し

**評価**:

| 観点 | 評価 |
|------|------|
| 最新仕様への追従 | ✅ |
| API状態 | ❌ deprecated |
| 毎出品時のAPIコール増加 | ❌ レート制限リスク |
| 実装コスト | 大 |

**採用しない理由**: GetCategoryFeatures は deprecated かつ毎出品時の API コールは運用リスクが高い。

---

## Task 4: 出品シートへの「動的要求」の実現方法

### 現状の列読み取り方式 (PR #45 パターンB)

`ListingManager.gs` の `getValueByHeader()` がヘッダー名で動的に列を参照:
```javascript
grader:        getValueByHeader(rowData, headerMapping, 'Grader'),
gradeValue:    getValueByHeader(rowData, headerMapping, 'Grade'),
certNo:        getValueByHeader(rowData, headerMapping, 'Cert No'),
cardCondition: getValueByHeader(rowData, headerMapping, 'Card Condition'),
```

列が存在しない場合は空文字が返るだけで、エラーにはならない。

### 実現方法の評価

#### 方法A: バリデーション警告 (推奨)

出品実行時に category_master を参照し、`requires_condition_descriptors = TRUE` のカテゴリで  
Grader/Grade または Card Condition が未入力の場合に警告を出す。

**実装箇所**: `Validation.gs`
```javascript
// 既存バリデーションに追加
if (categoryMaster.descriptor_type === 'graded_card') {
  var hasGrader = data.grader && String(data.grader).trim() !== '';
  var hasGrade  = data.gradeValue && String(data.gradeValue).trim() !== '';
  var hasCardCond = data.cardCondition && String(data.cardCondition).trim() !== '';
  if (!hasGrader && !hasGrade && !hasCardCond) {
    errors.push(
      'カテゴリ ' + data.categoryId + ' はトレカ系です。' +
      'Grader+Grade（鑑定済み）またはCard Condition（未鑑定）を入力してください'
    );
  }
}
```

**評価**:
- 実装シンプル
- 既存の Validation.gs 拡張で対応可能
- 出品実行後にユーザーが気づく (事前案内は不要な場合が多い)
- PR #45 の実装に最小限の追加で済む

#### 方法B: 列の自動追加 (将来対応)

カテゴリ入力後に `onEdit` トリガーで Grader/Grade 列を自動追加。  
UX最良だが実装複雑かつ既存データとの整合性リスクあり。  
現時点では実装コスト対効果が低いため後回し。

#### 方法C: ガイドシート参照

実装最小だが顧客が自分で確認する必要あり。UX的に劣る。

**推奨**: 方法A (バリデーション警告) で初期実装、方法B は将来の UX 改善フェーズで検討。

---

## Task 5: 既存 ebay-db 設計との整合性

### 5-1. 既存2シート構造との整合性

現在の ebay-db シート構造:
```
ebay-db (スプレッドシート)
├── category_master_EBAY_US  (15列)
├── category_master_EBAY_GB
├── category_master_EBAY_DE
├── category_master_EBAY_AU
├── category_master_EBAY_JP  (予定)
└── condition_ja_map
```

オプション1の場合、新シートは不要。  
`category_master_EBAY_XX.csv` に2列追加するだけで既存構造を維持できる。

### 5-2. 月次同期フローへの組み込み

```
現状フロー:
  fetch_category_master.py → fetch_conditions.py → generate_csv.py → CSV commit
                                                         ↑
                                              ここに2列追加ロジックを組み込む
```

`generate_csv.py` の `build_condition_groups()` 関数内で `descriptor_type` を計算し、  
`category_master` の各行に追加するだけ。既存の月次 cron フローで自動更新される。

### 5-3. known_invalid_conditions (Phase 3候補) との統合可能性

調査ドキュメント `ebay-condition-error-21920350-investigation-20260501.md` で言及されている  
「ConditionID 3000 がトレカカテゴリで無効になっている問題」:

もし `known_invalid_conditions` テーブルを将来追加する場合、  
`descriptor_type = graded_card` のカテゴリに対して ConditionID 3000 (Used) を無効フラグとして管理できる。  
今回の `requires_condition_descriptors` 設計はこの Phase 3 設計とも整合する。

---

## Task 6: 推奨設計

### 推奨設計

**採用オプション**: **オプション1 (category_master に `descriptor_type` 列を追加)**

**理由**:  
追加 API コール不要で既存 `conditions_json` から自動導出可能。  
月次同期フローへの追加コストが最小（generate_csv.py に数行）。  
category_master を「カテゴリ情報の一元管理」とする既存設計思想に合致する。  
新カテゴリが ConditionDescriptors 対応になった場合も自動的に検出できる。

---

### category_master スキーマ変更案

**追加列**: 1列のみ (最小構成)

```
列16: descriptor_type  (string)
  値: "graded_card" | "none"
```

`requires_condition_descriptors` は `descriptor_type != "none"` と等価なため別列不要。  
将来 `graded_coin` 等の新タイプが生まれた場合は値を追加するだけ。

**導出ロジック** (generate_csv.py):
```python
def get_descriptor_type(ids: frozenset) -> str:
    """conditions_json の id セットから ConditionDescriptors タイプを判定"""
    if is_trading_card_group(ids):
        return "graded_card"
    return "none"
```

`generate_csv.py` の行生成部分 (~line 256付近) に:
```python
"descriptor_type": get_descriptor_type(ids),
```
を追加し、ヘッダー定義にも `"descriptor_type"` を追加。

---

### 出品シートへの動的要求方法

**方針**: バリデーション警告方式 (Validation.gs 拡張)

`Validation.gs` の `validateListingData()` 関数に category_master 参照を追加:

1. カテゴリIDから category_master の `descriptor_type` を参照
2. `descriptor_type === "graded_card"` の場合:
   - Grader+Grade (鑑定済み) が両方入力済み → OK
   - Card Condition (未鑑定) が入力済み → OK
   - いずれも空 → 警告エラー (出品ブロック)

**注意**: 現状のバリデーションは「Graderあり+Gradeなし」等の不整合チェックのみ。  
今回は「カテゴリがトレカ系なのにどちらも空」の場合のチェックを追加。

---

### 実装コスト概算

| 作業 | 内容 | コスト |
|------|------|--------|
| generate_csv.py 変更 | `descriptor_type` 列追加 (~10行) | 0.5日 |
| SyncCategoryMaster.gs 更新 | ヘッダー定義に列名追加 | 0.5日 |
| ImportSync.gs 更新 | 整合性チェックへの影響確認 | 0.5日 |
| Validation.gs 変更 | category_master参照 + バリデーション追加 (~30行) | 1日 |
| テスト (手動) | 183454で Grader/Grade 空での警告確認 | 0.5日 |
| **合計** | | **3日** |

---

### 既存 PR #45 との関係

**PR #45 は修正しない。新 PR を立てる。**

PR #45 は「ConditionDescriptors を XML に組み込む機能」として完結している。  
今回の変更は「ConditionDescriptors が必要なカテゴリでバリデーションを強化する」機能追加であり、  
別の責務として分離すべき。

```
PR #45 (マージ済み): ConditionDescriptors XML 生成
PR #46 (新規):       category_master 拡張 + バリデーション強化
```

---

### 移行コスト

| 項目 | 内容 |
|------|------|
| 既存顧客シートへの影響 | なし (既存列の追加・変更なし) |
| Grader/Grade 列の扱い | 変更なし (引き続き任意列) |
| 手動列追加が不要になるタイミング | 方法B (列の自動追加) 実装時 |
| 月次同期後の自動反映 | generate_csv.py 変更後の次回同期から有効 |
| 下位互換性 | `descriptor_type = "none"` で既存カテゴリは変化なし |

---

## 補足: 実装のための具体的なファイルパス

| ファイル | 変更内容 |
|----------|----------|
| `ebay-db/scripts/generate_csv.py` | `get_descriptor_type()` 追加・行生成に descriptor_type 列追加 |
| `gas/ebay-db/container/SyncCategoryMaster.gs` | SYNC_SHEET_NAMES は変更不要、ヘッダー定義の更新も不要 (動的転記のため) |
| `gas/ebay-db/container/ImportSync.gs` | 整合性チェックへの影響確認 (おそらく変更不要) |
| `gas/listing/standalone/Validation.gs` | validateListingData() にカテゴリ参照バリデーション追加 |
| `gas/listing/standalone/ListingManager.gs` | 変更不要 (既存のGrader/Grade読み取りロジックはそのまま) |

---

## 決定のための選択肢まとめ

| 判断 | 内容 | コスト | 推奨度 |
|------|------|--------|--------|
| **オプション1 採用** (推奨) | category_master に `descriptor_type` 追加 + Validation.gs 強化 | 3日 | ⭐⭐⭐ |
| オプション2 採用 | GRADED_CARD_CATEGORIES ハードコードリスト | 0.5日 | ⭐⭐ |
| 今は見送り | PR #45 のまま運用 (手動管理継続) | 0日 | ⭐ |

---

*調査実施: Claude Sonnet 4.6 / 2026-05-02*
