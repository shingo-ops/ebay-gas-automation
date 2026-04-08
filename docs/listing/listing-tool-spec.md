# eBay 出品ツール 仕様書

**バージョン**: 1.0.0
**作成日**: 2026-03-10
**作成者**: 谷澤真吾

---

## 目次

1. [概要](#概要)
2. [機能要件](#機能要件)
3. [画面設計](#画面設計)
4. [データ項目定義](#データ項目定義)
5. [処理フロー](#処理フロー)
6. [API利用仕様](#api利用仕様)
7. [バリデーション](#バリデーション)
8. [エラーハンドリング](#エラーハンドリング)
9. [制約事項](#制約事項)
10. [開発ロードマップ](#開発ロードマップ)

---

## 概要

### 目的

Google スプレッドシートから eBay へ商品を簡単に出品できるツールを提供する。
SKU ベースの在庫管理と、効率的な一括出品機能を実現する。

### 対象ユーザー

- eBay セラー（個人・法人）
- 複数商品を効率的に出品したい事業者
- 在庫管理と出品を一元管理したいユーザー

### 主要機能

1. **商品情報入力**: スプレッドシートで商品データを管理
2. **画像アップロード**: Google Drive 連携で画像を管理
3. **カテゴリ選択**: eBay カテゴリの検索と選択
4. **価格・配送設定**: 柔軟な価格設定と配送オプション
5. **下書き保存**: 出品前の内容確認
6. **一括出品**: 複数商品の一括リスティング作成
7. **ステータス管理**: 出品状況の追跡

---

## 機能要件

### 1. 商品情報管理機能

#### FR-001: 商品データ入力
- **優先度**: 高
- **説明**: スプレッドシートで商品情報を入力・編集できる
- **入力項目**:
  - SKU（必須）
  - 商品名（必須）
  - 商品説明（必須）
  - カテゴリID（必須）
  - 価格（必須）
  - 在庫数（必須）
  - コンディション（必須）
  - 画像URL（必須、最大24枚）
  - ブランド
  - UPC/EAN/ISBN
  - 商品アスペクト（カテゴリ別の属性）
  - 配送設定
  - 返品ポリシー

#### FR-002: データバリデーション
- **優先度**: 高
- **説明**: 入力データの妥当性をチェック
- **検証内容**:
  - 必須項目の入力チェック
  - データ型の検証（数値、URL など）
  - 文字数制限の確認
  - 重複 SKU のチェック
  - カテゴリIDの有効性確認

#### FR-003: テンプレート機能
- **優先度**: 中
- **説明**: カテゴリ別の入力テンプレートを提供
- **機能**:
  - カテゴリごとの必須アスペクトを自動表示
  - サンプルデータの提供
  - 入力ガイドの表示

### 2. 画像管理機能

#### FR-004: 画像URL管理
- **優先度**: 高
- **説明**: 商品画像のURLを管理
- **機能**:
  - 複数画像URLの入力（カンマ区切り）
  - 画像の順序管理
  - 画像URLの検証

#### FR-005: Google Drive 連携（オプション）
- **優先度**: 低
- **説明**: Google Drive の画像を自動アップロード
- **機能**:
  - Drive フォルダから画像を選択
  - eBay Media API へのアップロード
  - アップロード済み画像の管理

### 3. カテゴリ選択機能

#### FR-006: カテゴリ検索
- **優先度**: 高
- **説明**: eBay カテゴリを検索して選択
- **機能**:
  - キーワードでカテゴリ検索
  - カテゴリツリーの表示
  - カテゴリIDの自動入力
  - カテゴリ推奨機能（商品タイトルから推測）

#### FR-007: カテゴリアスペクト取得
- **優先度**: 高
- **説明**: 選択したカテゴリの必須・推奨アスペクトを取得
- **機能**:
  - カテゴリ別の必須項目表示
  - アスペクトの選択肢表示
  - デフォルト値の設定

### 4. 出品実行機能

#### FR-008: 単一商品出品
- **優先度**: 高
- **説明**: 1商品をeBayにリスティング
- **処理**:
  1. 在庫アイテムの作成（Inventory API）
  2. オファーの作成（Inventory API）
  3. リスティングの公開
- **出力**: 出品結果とリスティングURL

#### FR-009: 一括出品
- **優先度**: 高
- **説明**: 複数商品を一括でリスティング
- **機能**:
  - 選択した行の一括出品
  - 全行の一括出品
  - バッチ処理（50件ずつ）
  - プログレス表示
  - エラー発生時も継続処理

#### FR-010: 下書き保存
- **優先度**: 中
- **説明**: リスティングを下書きとして保存
- **機能**:
  - 在庫アイテムのみ作成（オファーなし）
  - 下書き一覧の管理
  - 下書きから公開

### 5. ステータス管理機能

#### FR-011: 出品ステータス追跡
- **優先度**: 高
- **説明**: 各商品の出品状況を管理
- **ステータス**:
  - 未出品
  - 下書き
  - 出品中
  - エラー
  - 終了
- **機能**:
  - ステータスの自動更新
  - 色分け表示
  - フィルタリング

#### FR-012: エラー管理
- **優先度**: 高
- **説明**: エラー内容の記録と表示
- **機能**:
  - エラーメッセージの記録
  - エラー行のハイライト
  - エラーログシートへの出力
  - リトライ機能

### 6. 価格・配送設定機能

#### FR-013: 価格設定
- **優先度**: 高
- **説明**: 柔軟な価格設定と Best Offer（値下げ交渉）機能
- **機能**:
  - **固定価格**: 定価での販売
  - **Best Offer 有効化**: 買い手からの価格交渉を受け付ける
  - **自動承認価格**: この価格以上のオファーを自動承認
  - **自動拒否価格**: この価格以下のオファーを自動拒否
  - **手動対応範囲**: 自動拒否〜自動承認の間は手動判断
- **Best Offer の動作**:
  - カテゴリによって利用可否が異なる（事前確認が必要）
  - マルチバリエーションリスティングでは利用不可
  - 自動承認価格は出品価格より低く設定
  - 自動拒否価格は自動承認価格より低く設定
- **バリデーション**:
  - 出品価格 > 自動承認価格 > 自動拒否価格 の論理チェック
  - Best Offer 有効時は自動承認価格・自動拒否価格のいずれかを推奨

#### FR-014: 配送設定
- **優先度**: 高
- **説明**: 配送オプションの設定
- **機能**:
  - 配送サービスの選択
  - 配送料金の設定
  - 無料配送の設定
  - 取扱時間の設定
  - 配送除外地域の設定

### 7. 補助機能

#### FR-015: 出品プレビュー
- **優先度**: 中
- **説明**: 出品内容を事前確認
- **機能**:
  - HTML プレビュー生成
  - ダイアログ表示
  - eBay での表示イメージ

#### FR-016: 一括編集
- **優先度**: 中
- **説明**: 複数商品の一括更新
- **機能**:
  - 価格の一括変更
  - 在庫数の一括変更
  - カテゴリの一括変更

#### FR-017: テンプレート保存・読み込み
- **優先度**: 低
- **説明**: よく使う設定をテンプレート化
- **機能**:
  - 設定のテンプレート保存
  - テンプレートの読み込み
  - テンプレート一覧管理

---

## 画面設計

### シート構成

#### 1. 出品管理シート（メイン）

| 列 | 項目名 | 必須 | データ型 | 説明 | 例 |
|----|--------|------|----------|------|-----|
| A | SKU | ◯ | 文字列 | 在庫管理コード | LAPTOP-001 |
| B | 商品名 | ◯ | 文字列 | 商品タイトル（80文字以内） | Apple MacBook Pro 14-inch M3 |
| C | 商品説明 | ◯ | 文字列 | 商品の詳細説明（HTML可） | 新品未開封のMacBook Pro... |
| D | カテゴリID | ◯ | 数値 | eBayカテゴリID | 111422 |
| E | カテゴリ名 | - | 文字列 | カテゴリ名（参照用） | Laptops & Netbooks |
| F | 価格 | ◯ | 数値 | 販売価格 | 1999.99 |
| G | 通貨 | ◯ | 文字列 | 通貨コード | USD |
| H | 在庫数 | ◯ | 数値 | 在庫数量 | 10 |
| I | コンディション | ◯ | 選択 | 商品状態 | NEW |
| J | ブランド | △ | 文字列 | ブランド名 | Apple |
| K | UPC/EAN | △ | 文字列 | 商品コード | 194252721693 |
| L | 画像URL1 | ◯ | URL | メイン画像 | https://... |
| M | 画像URL2-24 | - | URL | サブ画像 | https://... |
| N | 配送サービス | ◯ | 選択 | 配送方法 | USPS Priority Mail |
| O | 配送料金 | ◯ | 数値 | 配送料 | 0（無料配送） |
| P | 取扱時間 | ◯ | 数値 | 発送までの日数 | 1 |
| Q | **Best Offer有効** | - | 選択 | TRUE/FALSE | TRUE |
| R | **自動承認価格** | - | 数値 | この価格以上で自動承認 | 1800.00 |
| S | **自動拒否価格** | - | 数値 | この価格以下で自動拒否 | 1600.00 |
| T | ステータス | - | 選択 | 出品状況 | 未出品 |
| U | Offer ID | - | 文字列 | eBay Offer ID | 987654321098 |
| V | Listing ID | - | 文字列 | eBay Listing ID | 123456789012 |
| W | エラー内容 | - | 文字列 | エラーメッセージ | - |
| X | 出品日時 | - | 日時 | 出品実行日時 | 2026-03-10 15:30 |

#### 2. カテゴリマスタシート

| 列 | 項目名 | 説明 |
|----|--------|------|
| A | カテゴリID | eBayカテゴリID |
| B | カテゴリ名 | カテゴリ名（英語） |
| C | カテゴリパス | 階層パス |
| D | 親カテゴリID | 親カテゴリのID |
| E | リーフカテゴリ | 最下層フラグ |

#### 3. アスペクトマスタシート

| 列 | 項目名 | 説明 |
|----|--------|------|
| A | カテゴリID | 対象カテゴリID |
| B | アスペクト名 | 属性名（例: Color） |
| C | 必須フラグ | 必須/推奨/任意 |
| D | データ型 | 文字列/数値/選択 |
| E | 選択肢 | 選択可能な値（カンマ区切り） |

#### 4. 配送テンプレートシート

| 列 | 項目名 | 説明 |
|----|--------|------|
| A | テンプレート名 | テンプレート識別名 |
| B | 配送サービス | 配送方法 |
| C | 配送料金 | 料金設定 |
| D | 取扱時間 | 発送までの日数 |
| E | 無料配送 | 有効/無効 |

#### 5. ログシート

既存のログシートを使用（出品関連のログを記録）

---

## データ項目定義

### 商品コンディション（Condition）

| 値 | 表示名 | 説明 |
|----|--------|------|
| NEW | 新品 | 未開封・未使用の新品 |
| LIKE_NEW | ほぼ新品 | 開封済みだが未使用 |
| USED_EXCELLENT | 中古（優良） | 使用感が少ない |
| USED_GOOD | 中古（良好） | 通常の使用感 |
| USED_ACCEPTABLE | 中古（可） | 明確な使用感あり |
| FOR_PARTS_OR_NOT_WORKING | ジャンク | 部品取り・動作不良 |

### 出品ステータス

| ステータス | 説明 | 色 |
|-----------|------|-----|
| 未出品 | 出品前の状態 | グレー |
| 検証中 | バリデーション実行中 | 青 |
| 下書き | 下書き保存済み | 黄 |
| 出品中 | リスティング公開中 | 緑 |
| エラー | 出品失敗 | 赤 |
| 終了 | リスティング終了 | 黒 |

### 配送サービス（米国の例）

| サービス名 | 説明 | 目安日数 |
|-----------|------|---------|
| USPS First Class | ファーストクラス | 2-5日 |
| USPS Priority Mail | プライオリティメール | 1-3日 |
| USPS Priority Mail Express | エクスプレス | 1-2日 |
| FedEx Ground | FedEx地上便 | 1-5日 |
| FedEx 2Day | FedEx 2日配送 | 2日 |
| UPS Ground | UPS地上便 | 1-5日 |

### Best Offer（ベストオファー）設定

#### Best Offer とは
買い手が希望価格を提示し、セラーが承認・拒否・カウンターオファーを返す値下げ交渉機能。

#### 設定項目

| 項目 | 説明 | 設定例 |
|------|------|--------|
| **Best Offer 有効** | TRUE で機能を有効化 | TRUE |
| **自動承認価格** | この価格以上のオファーは自動で承認される | $1,800.00 |
| **自動拒否価格** | この価格以下のオファーは自動で拒否される | $1,600.00 |

#### 動作例

```
出品価格: $1,899.00
自動承認価格: $1,800.00
自動拒否価格: $1,600.00
────────────────────────────────────
買い手のオファー → セラーの対応
────────────────────────────────────
$1,850.00 → 自動承認（$1,800以上）
$1,750.00 → 手動対応が必要
$1,550.00 → 自動拒否（$1,600以下）
```

#### 制約事項

1. **カテゴリ制限**:
   - すべてのカテゴリで利用可能ではない
   - Taxonomy API で事前確認が必要

2. **バリエーション制限**:
   - マルチバリエーションリスティング（サイズ・色違い等）では利用不可
   - 単一商品のみ対応

3. **価格の論理関係**:
   - 必須: `出品価格 > 自動承認価格 > 自動拒否価格`
   - 自動承認価格のみ設定も可能（自動拒否なし）
   - 自動拒否価格のみ設定も可能（自動承認なし）

4. **API フィールド**:
   - `listingPolicies.bestOfferTerms.bestOfferEnabled`: boolean
   - `listingPolicies.bestOfferTerms.autoAcceptPrice`: Amount
   - `listingPolicies.bestOfferTerms.autoDeclinePrice`: Amount

---

## 処理フロー

### 1. 単一商品出品フロー

```
[開始]
  ↓
[行データ取得]
  ↓
[バリデーション実行]
  ├─NG→ [エラー表示] → [終了]
  ↓OK
[画像URLの検証]
  ├─NG→ [エラー表示] → [終了]
  ↓OK
[カテゴリアスペクト取得]
  ↓
[在庫アイテム作成]
  ├─失敗→ [エラー記録] → [終了]
  ↓成功
[オファー作成]
  ├─失敗→ [エラー記録] → [終了]
  ↓成功
[リスティング公開]
  ├─失敗→ [エラー記録] → [終了]
  ↓成功
[ステータス更新]
  ↓
[リスティングID記録]
  ↓
[成功メッセージ表示]
  ↓
[終了]
```

### 2. 一括出品フロー

```
[開始]
  ↓
[全行データ取得]
  ↓
[ステータス='未出品'の行を抽出]
  ↓
[50件ずつにバッチ分割]
  ↓
[バッチループ開始]
  ↓
  [行ループ開始]
    ↓
    [バリデーション]
      ├─NG→ [エラー記録] → [次の行へ]
      ↓OK
    [在庫アイテム作成]
      ├─失敗→ [エラー記録] → [次の行へ]
      ↓成功
    [オファー作成]
      ├─失敗→ [エラー記録] → [次の行へ]
      ↓成功
    [リスティング公開]
      ├─失敗→ [エラー記録] → [次の行へ]
      ↓成功
    [ステータス更新]
      ↓
    [成功カウント++]
      ↓
    [レート制限遅延]
      ↓
  [行ループ終了]
    ↓
  [バッチ間遅延（5秒）]
    ↓
[バッチループ終了]
  ↓
[結果サマリー表示]
  ↓
[終了]
```

### 3. 下書き保存フロー

```
[開始]
  ↓
[行データ取得]
  ↓
[バリデーション実行]
  ├─NG→ [エラー表示] → [終了]
  ↓OK
[在庫アイテムのみ作成]
  ├─失敗→ [エラー記録] → [終了]
  ↓成功
[ステータスを'下書き'に更新]
  ↓
[成功メッセージ表示]
  ↓
[終了]
```

---

## API利用仕様

### 使用するAPI

1. **Inventory API** - 在庫とリスティング管理
2. **Taxonomy API** - カテゴリ情報取得
3. **Media API** - 画像アップロード（オプション）

### API呼び出しシーケンス

#### 1. 在庫アイテムの作成

**エンドポイント**: `PUT /sell/inventory/v1/inventory_item/{sku}`

**リクエストボディ例**:
```json
{
  "product": {
    "title": "Apple MacBook Pro 14-inch M3",
    "description": "新品未開封のMacBook Pro...",
    "aspects": {
      "Brand": ["Apple"],
      "Processor": ["Apple M3"],
      "Screen Size": ["14 in"]
    },
    "brand": "Apple",
    "mpn": "MRX33LL/A",
    "imageUrls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ]
  },
  "condition": "NEW",
  "availability": {
    "shipToLocationAvailability": {
      "quantity": 10
    }
  }
}
```

#### 2. オファーの作成

**エンドポイント**: `POST /sell/inventory/v1/offer`

**リクエストボディ例（Best Offer 有効）**:
```json
{
  "sku": "LAPTOP-001",
  "marketplaceId": "EBAY_US",
  "format": "FIXED_PRICE",
  "listingDescription": "新品未開封のMacBook Pro...",
  "availableQuantity": 10,
  "categoryId": "111422",
  "listingPolicies": {
    "fulfillmentPolicyId": "...",
    "paymentPolicyId": "...",
    "returnPolicyId": "...",
    "bestOfferTerms": {
      "bestOfferEnabled": true,
      "autoAcceptPrice": {
        "value": "1800.00",
        "currency": "USD"
      },
      "autoDeclinePrice": {
        "value": "1600.00",
        "currency": "USD"
      }
    }
  },
  "pricingSummary": {
    "price": {
      "value": "1899.00",
      "currency": "USD"
    }
  },
  "merchantLocationKey": "warehouse-1"
}
```

**リクエストボディ例（Best Offer 無効）**:
```json
{
  "sku": "LAPTOP-001",
  "marketplaceId": "EBAY_US",
  "format": "FIXED_PRICE",
  "listingDescription": "新品未開封のMacBook Pro...",
  "availableQuantity": 10,
  "categoryId": "111422",
  "listingPolicies": {
    "fulfillmentPolicyId": "...",
    "paymentPolicyId": "...",
    "returnPolicyId": "..."
  },
  "pricingSummary": {
    "price": {
      "value": "1999.99",
      "currency": "USD"
    }
  },
  "merchantLocationKey": "warehouse-1"
}
```

#### 3. リスティングの公開

**エンドポイント**: `POST /sell/inventory/v1/offer/{offerId}/publish`

**レスポンス例**:
```json
{
  "listingId": "123456789012",
  "warnings": []
}
```

#### 4. カテゴリアスペクトの取得

**エンドポイント**: `GET /commerce/taxonomy/v1/category_tree/{category_tree_id}/get_item_aspects_for_category`

**パラメータ**: `category_id=111422`

---

## バリデーション

### 入力値検証ルール

#### 必須項目チェック

| 項目 | ルール |
|------|--------|
| SKU | 空でない、50文字以内 |
| 商品名 | 空でない、80文字以内 |
| 商品説明 | 空でない |
| カテゴリID | 数値、有効なカテゴリ |
| 価格 | 0より大きい数値 |
| 在庫数 | 0以上の整数 |
| コンディション | 有効な値 |
| 画像URL1 | 有効なURL |

#### データ型検証

```javascript
// SKU検証
function validateSKU(sku) {
  if (!sku || sku.trim() === '') {
    return { valid: false, error: 'SKUは必須です' };
  }
  if (sku.length > 50) {
    return { valid: false, error: 'SKUは50文字以内で入力してください' };
  }
  if (!/^[A-Za-z0-9\-_]+$/.test(sku)) {
    return { valid: false, error: 'SKUは英数字、ハイフン、アンダースコアのみ使用できます' };
  }
  return { valid: true };
}

// 価格検証
function validatePrice(price) {
  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    return { valid: false, error: '価格は0より大きい数値で入力してください' };
  }
  if (numPrice > 999999.99) {
    return { valid: false, error: '価格が上限を超えています' };
  }
  return { valid: true };
}

// URL検証
function validateImageUrl(url) {
  if (!url || url.trim() === '') {
    return { valid: false, error: '画像URLは必須です' };
  }
  const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif)$/i;
  if (!urlPattern.test(url)) {
    return { valid: false, error: '有効な画像URL（jpg, png, gif）を入力してください' };
  }
  return { valid: true };
}

// Best Offer 検証
function validateBestOffer(rowData) {
  const errors = [];
  const listingPrice = parseFloat(rowData.価格);
  const bestOfferEnabled = rowData.BestOffer有効 === true || rowData.BestOffer有効 === 'TRUE';
  const autoAcceptPrice = rowData.自動承認価格 ? parseFloat(rowData.自動承認価格) : null;
  const autoDeclinePrice = rowData.自動拒否価格 ? parseFloat(rowData.自動拒否価格) : null;

  // Best Offer が無効の場合はスキップ
  if (!bestOfferEnabled) {
    return { valid: true, errors: [] };
  }

  // 自動承認価格のチェック
  if (autoAcceptPrice !== null) {
    if (isNaN(autoAcceptPrice) || autoAcceptPrice <= 0) {
      errors.push('自動承認価格は0より大きい数値で入力してください');
    }
    if (autoAcceptPrice >= listingPrice) {
      errors.push(`自動承認価格（${autoAcceptPrice}）は出品価格（${listingPrice}）より低く設定してください`);
    }
  }

  // 自動拒否価格のチェック
  if (autoDeclinePrice !== null) {
    if (isNaN(autoDeclinePrice) || autoDeclinePrice <= 0) {
      errors.push('自動拒否価格は0より大きい数値で入力してください');
    }
    if (autoDeclinePrice >= listingPrice) {
      errors.push(`自動拒否価格（${autoDeclinePrice}）は出品価格（${listingPrice}）より低く設定してください`);
    }
  }

  // 自動承認価格と自動拒否価格の関係チェック
  if (autoAcceptPrice !== null && autoDeclinePrice !== null) {
    if (autoDeclinePrice >= autoAcceptPrice) {
      errors.push(`自動拒否価格（${autoDeclinePrice}）は自動承認価格（${autoAcceptPrice}）より低く設定してください`);
    }
  }

  // Best Offer 有効時の推奨チェック
  if (autoAcceptPrice === null && autoDeclinePrice === null) {
    errors.push('警告: Best Offer が有効ですが、自動承認価格・自動拒否価格のいずれも設定されていません。すべてのオファーを手動対応する必要があります。');
  }

  return {
    valid: errors.length === 0 || errors[0].startsWith('警告'),
    errors: errors,
    warnings: errors.filter(e => e.startsWith('警告'))
  };
}
```

### カテゴリアスペクト検証

```javascript
// カテゴリ必須アスペクトのチェック
function validateCategoryAspects(categoryId, aspects) {
  const requiredAspects = getRequiredAspects(categoryId);
  const errors = [];

  requiredAspects.forEach(required => {
    if (!aspects[required.name]) {
      errors.push(`${required.name}は必須です`);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}
```

---

## エラーハンドリング

### エラー分類

#### 1. 入力エラー（Validation Error）
- **原因**: ユーザー入力の不備
- **対応**: エラーメッセージ表示、該当セルをハイライト
- **リトライ**: 不要（ユーザーが修正）

#### 2. API エラー（API Error）
- **原因**: eBay API からのエラーレスポンス
- **対応**: エラー内容を記録、ログシートに出力
- **リトライ**: 可能（条件による）

#### 3. ネットワークエラー（Network Error）
- **原因**: 通信障害
- **対応**: リトライ実行
- **リトライ**: 3回まで

### エラーメッセージ一覧

| エラーコード | メッセージ | 対処方法 |
|-------------|-----------|---------|
| VAL-001 | SKUが入力されていません | SKUを入力してください |
| VAL-002 | 商品名が入力されていません | 商品名を入力してください |
| VAL-003 | 価格が無効です | 0より大きい数値を入力してください |
| VAL-004 | 画像URLが無効です | 有効な画像URLを入力してください |
| API-001 | カテゴリIDが無効です | 有効なカテゴリIDを指定してください |
| API-002 | 在庫アイテム作成に失敗しました | 入力内容を確認してください |
| API-003 | オファー作成に失敗しました | ポリシー設定を確認してください |
| API-004 | リスティング公開に失敗しました | eBayのステータスを確認してください |
| NET-001 | ネットワークエラー | しばらく待ってから再試行してください |

### エラー記録形式

```javascript
// エラーオブジェクトの構造
{
  timestamp: '2026-03-10 15:30:45',
  sku: 'LAPTOP-001',
  errorCode: 'API-002',
  errorMessage: '在庫アイテム作成に失敗しました',
  details: 'カテゴリアスペクト "Brand" は必須です',
  apiResponse: {...},  // APIレスポンス全体
  row: 5  // スプレッドシートの行番号
}
```

---

## 制約事項

### 技術的制約

1. **API レート制限**
   - デフォルト制限内での動作
   - 呼び出し間隔: 100ms（設定可能）
   - バッチサイズ: 50件

2. **Google Apps Script の制限**
   - 実行時間: 最大6分
   - 1日の実行時間: 90分（無料アカウント）
   - URLFetch 呼び出し: 20,000回/日

3. **スプレッドシートの制限**
   - 最大行数: 10,000行（推奨）
   - 1セルの文字数: 50,000文字

### eBay API の制約

1. **画像**
   - 最大24枚
   - 対応形式: JPG, PNG, GIF
   - 最小サイズ: 500px x 500px
   - 最大サイズ: 12MB

2. **商品タイトル**
   - 最大80文字
   - 特定の記号は使用不可

3. **商品説明**
   - HTML使用可能
   - 外部リンク制限あり

4. **カテゴリ**
   - リーフカテゴリのみ指定可能
   - カテゴリごとに必須アスペクトが異なる

### ビジネス上の制約

1. **出品可能商品**
   - eBay の禁止品目に該当しないこと
   - 適切なカテゴリが存在すること

2. **セラー要件**
   - eBay セラーアカウントが必要
   - ビジネスポリシーの設定が必要
   - 支払い方法の設定が必要

---

## 開発ロードマップ

### Phase 1: 基本機能（2週間）

- [x] プロジェクト構造作成
- [ ] 出品管理シートのテンプレート作成
- [ ] バリデーション機能実装
- [ ] 単一商品出品機能
- [ ] ステータス管理機能
- [ ] エラーハンドリング実装

**成果物**:
- Listing.gs（出品処理）
- ValidationRules.gs（バリデーション）
- ListingSheet テンプレート

### Phase 2: 一括処理（1週間）

- [ ] 一括出品機能実装
- [ ] バッチ処理実装
- [ ] プログレス表示
- [ ] エラーリカバリー機能

**成果物**:
- BatchListing.gs（バッチ処理）
- 一括出品UI

### Phase 3: カテゴリ管理（1週間）

- [ ] カテゴリ検索機能
- [ ] カテゴリマスタ管理
- [ ] アスペクト取得機能
- [ ] カテゴリ推奨機能

**成果物**:
- CategoryManager.gs
- カテゴリマスタシート

### Phase 4: 画像管理（オプション）

- [ ] Google Drive 連携
- [ ] Media API 統合
- [ ] 画像アップロード機能
- [ ] 画像プレビュー

**成果物**:
- ImageManager.gs
- 画像管理UI

### Phase 5: 高度な機能（オプション）

- [ ] 出品プレビュー機能
- [ ] テンプレート機能
- [ ] 一括編集機能
- [ ] スケジュール出品

---

## 付録

### A. サンプルデータ

```csv
SKU,商品名,商品説明,カテゴリID,カテゴリ名,価格,通貨,在庫数,コンディション,ブランド,UPC,画像URL1,配送サービス,配送料金,取扱時間
LAPTOP-001,Apple MacBook Pro 14-inch M3,新品未開封のMacBook Pro 14インチ M3モデル,111422,Laptops & Netbooks,1999.99,USD,10,NEW,Apple,194252721693,https://example.com/image1.jpg,USPS Priority Mail,0,1
PHONE-001,iPhone 15 Pro 128GB,iPhone 15 Pro ブラックチタニウム 128GB,9355,Cell Phones & Smartphones,999.99,USD,5,NEW,Apple,194253433620,https://example.com/phone1.jpg,USPS Priority Mail,0,1
```

### B. 参考リンク

- [eBay Inventory API Documentation](https://developer.ebay.com/api-docs/sell/inventory/overview.html)
- [eBay Taxonomy API Documentation](https://developer.ebay.com/api-docs/commerce/taxonomy/overview.html)
- [eBay Category Structure](https://developer.ebay.com/DevZone/merchandising/docs/Concepts/CategoryStructure.html)

---

**変更履歴**

| バージョン | 日付 | 変更内容 | 作成者 |
|-----------|------|---------|--------|
| 1.0.0 | 2026-03-10 | 初版作成 | 谷澤真吾 |
