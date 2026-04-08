# eBay API 取得可能データ一覧

**作成日**: 2026-03-10
**目的**: 現在取得可能なすべてのデータを整理・可視化

---

## 📊 データ取得可能性マップ

### 凡例
- ✅ **実装済み**: すぐに使用可能
- 🟢 **実装可能**: API実装で取得可能
- ⚠️ **制限あり**: 条件付きで取得可能
- 🔵 **手動のみ**: UI経由のみ
- ❌ **取得不可**: API提供なし

---

## 1️⃣ 商品リサーチデータ（競合分析）

### Browse API - searchItems（✅ 実装済み）

| データ項目 | 取得可能性 | API | 実装状況 | 用途 |
|-----------|----------|-----|---------|------|
| **Item ID** | ✅ | Browse API | 実装済み | 商品識別 |
| **商品タイトル** | ✅ | Browse API | 実装済み | 商品名 |
| **価格** | ✅ | Browse API | 実装済み | 価格リサーチ |
| **通貨** | ✅ | Browse API | 実装済み | 通貨単位 |
| **コンディション** | ✅ | Browse API | 実装済み | NEW/USED等 |
| **カテゴリID** | ✅ | Browse API | 実装済み | カテゴリ分類 |
| **カテゴリ名** | ✅ | Browse API | 実装済み | カテゴリ名 |
| **商品画像URL** | ✅ | Browse API | 実装済み | 画像表示 |
| **商品URL** | ✅ | Browse API | 実装済み | eBayページ |
| **セラーID** | ✅ | Browse API | 実装済み | セラー識別 |
| **セラー評価%** | ✅ | Browse API | 実装済み | 信頼度 |
| **配送情報** | ✅ | Browse API | 実装済み | 送料等 |
| **販売形式** | ✅ | Browse API | 実装済み | Fixed/Auction |
| **在庫数** | ⚠️ | Browse API | 実装済み | 一部のみ |
| **ウォッチ数** | ⚠️ | Browse API | 未実装 | 要App Check承認 |
| **検索結果総数** | ✅ | Browse API | 実装済み | 競合数 |

**取得例**（`EbayAPI.gs:searchItems()` ですでに実装済み）:
```javascript
const results = searchItems('MacBook Pro', {
  limit: 200,
  filter: 'price:[500..2000],conditions:{NEW}',
  sort: 'price'
});

// 取得可能なデータ
results.itemSummaries.forEach(item => {
  console.log({
    itemId: item.itemId,              // ✅
    title: item.title,                // ✅
    price: item.price.value,          // ✅
    currency: item.price.currency,    // ✅
    condition: item.condition,        // ✅
    categoryId: item.categoryId,      // ✅
    imageUrl: item.image.imageUrl,    // ✅
    itemWebUrl: item.itemWebUrl,      // ✅
    seller: item.seller.username,     // ✅
    feedbackPercentage: item.seller.feedbackPercentage  // ✅
  });
});
```

---

### Browse API - getItem（✅ 実装済み）

| データ項目 | 取得可能性 | API | 実装状況 | 用途 |
|-----------|----------|-----|---------|------|
| **Item Specifics（全て）** | ✅ | Browse API | 実装済み | 商品詳細属性 |
| - Brand | ✅ | Browse API | 実装済み | ブランド名 |
| - Model | ✅ | Browse API | 実装済み | モデル名 |
| - Color | ✅ | Browse API | 実装済み | 色 |
| - Size | ✅ | Browse API | 実装済み | サイズ |
| - Material | ✅ | Browse API | 実装済み | 素材 |
| - その他すべて | ✅ | Browse API | 実装済み | カテゴリ別 |
| **商品説明（HTML）** | ✅ | Browse API | 実装済み | 詳細説明 |
| **商品画像（最大24枚）** | ✅ | Browse API | 実装済み | 全画像 |
| **GTIN/UPC/EAN** | ⚠️ | Browse API | 実装済み | 商品コード（あれば） |
| **ePID** | ⚠️ | Browse API | 実装済み | eBay Product ID |

**取得例**（`EbayAPI.gs:getItem()` ですでに実装済み）:
```javascript
const item = getItem('v1|110588771234|0');

// Item Specifics
item.localizedAspects.forEach(aspect => {
  console.log(`${aspect.name}: ${aspect.value}`);
  // Brand: Apple
  // Model: MacBook Pro
  // Screen Size: 14 in
  // Processor: Apple M3
  // など全属性
});

// 画像URL（最大24枚）
item.image.imageUrl;              // メイン画像
item.additionalImages.forEach(img => {
  console.log(img.imageUrl);      // 追加画像
});
```

---

## 2️⃣ 自分の在庫・出品データ

### Inventory API（✅ 一部実装済み）

| データ項目 | 取得可能性 | API | 実装状況 | 用途 |
|-----------|----------|-----|---------|------|
| **SKU** | ✅ | Inventory API | 実装済み | 在庫識別 |
| **商品タイトル** | ✅ | Inventory API | 実装済み | 商品名 |
| **商品説明** | ✅ | Inventory API | 実装済み | 説明文 |
| **価格** | ✅ | Inventory API | 実装済み | 販売価格 |
| **在庫数** | ✅ | Inventory API | 実装済み | 在庫量 |
| **コンディション** | ✅ | Inventory API | 実装済み | 商品状態 |
| **カテゴリID** | ✅ | Inventory API | 未実装 | カテゴリ |
| **Item Specifics** | ✅ | Inventory API | 実装済み | 商品属性 |
| **商品画像URL** | ✅ | Inventory API | 実装済み | 画像 |
| **Best Offer有効** | 🟢 | Inventory API | 未実装 | 値下げ交渉ON/OFF |
| **自動承認価格** | 🟢 | Inventory API | 未実装 | この価格以上で自動承認 |
| **自動拒否価格** | 🟢 | Inventory API | 未実装 | この価格以下で自動拒否 |
| **Offer ID** | 🟢 | Inventory API | 未実装 | オファー識別 |
| **Listing ID** | 🟢 | Inventory API | 未実装 | リスティング識別 |
| **出品ステータス** | 🟢 | Inventory API | 未実装 | PUBLISHED等 |
| **ビジネスポリシーID** | 🟢 | Inventory API | 未実装 | 配送・支払・返品 |

**現在の実装状況**（`EbayAPI.gs`）:
```javascript
// ✅ 実装済み
function getInventoryItem(sku) {
  return ebayApiRequest(
    `/sell/inventory/v1/inventory_item/${sku}`,
    'GET'
  );
}

function createOrUpdateInventoryItem(sku, inventoryData) {
  return ebayApiRequest(
    `/sell/inventory/v1/inventory_item/${sku}`,
    'PUT',
    null,
    inventoryData
  );
}

// 🟢 実装必要（Phase 1）
function createOffer(offerData) { /* 未実装 */ }
function publishOffer(offerId) { /* 未実装 */ }
function updateOffer(offerId, updateData) { /* 未実装 */ }
```

---

### Trading API - GetMyeBaySelling（🟢 実装可能）

| データ項目 | 取得可能性 | API | 実装状況 | 用途 |
|-----------|----------|-----|---------|------|
| **ウォッチ数** | 🟢 | Trading API | 未実装 | 人気度 |
| **販売個数** | 🟢 | Trading API | 未実装 | 売上実績 |
| **売上金額** | 🟢 | Trading API | 未実装 | 収益 |
| **Sell-through Rate** | 🟢 | Trading API | 未実装 | 売上率 |
| **Active Listings** | 🟢 | Trading API | 未実装 | 出品数 |
| **残り時間** | 🟢 | Trading API | 未実装 | 終了まで |
| **現在価格** | 🟢 | Trading API | 未実装 | リアルタイム価格 |
| **在庫数** | 🟢 | Trading API | 未実装 | 在庫 |

**実装必要**（Phase 1.5）:
```javascript
// TradingAPI.gs（新規作成）
function getMyeBaySelling() {
  // XML API 統合
  // GetMyeBaySelling 実装
}
```

---

## 3️⃣ カテゴリ・商品メタデータ

### Taxonomy API（🟢 実装可能）

| データ項目 | 取得可能性 | API | 実装状況 | 用途 |
|-----------|----------|-----|---------|------|
| **カテゴリツリー** | 🟢 | Taxonomy API | 未実装 | 全カテゴリ |
| **カテゴリID** | 🟢 | Taxonomy API | 未実装 | カテゴリ識別 |
| **カテゴリ名** | 🟢 | Taxonomy API | 未実装 | カテゴリ名 |
| **カテゴリパス** | 🟢 | Taxonomy API | 未実装 | 階層構造 |
| **リーフカテゴリ** | 🟢 | Taxonomy API | 未実装 | 最下層判定 |
| **必須アスペクト** | 🟢 | Taxonomy API | 未実装 | 必須項目 |
| **推奨アスペクト** | 🟢 | Taxonomy API | 未実装 | 推奨項目 |
| **アスペクト値リスト** | 🟢 | Taxonomy API | 未実装 | 選択肢 |
| **アスペクト制約** | 🟢 | Taxonomy API | 未実装 | 入力形式 |

**実装必要**（Phase 1）:
```javascript
// CategoryManager.gs（新規作成）
function getCategoryTree(categoryTreeId) {
  return ebayApiRequest(
    `/commerce/taxonomy/v1/category_tree/${categoryTreeId}`,
    'GET'
  );
}

function getCategoryAspects(categoryTreeId, categoryId) {
  return ebayApiRequest(
    `/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_item_aspects_for_category`,
    'GET',
    { category_id: categoryId }
  );
}
```

---

## 4️⃣ 販売履歴・トレンドデータ

### ❌ 取得不可 / ⚠️ 制限あり

| データ項目 | 取得可能性 | 理由 | 代替手段 |
|-----------|----------|------|---------|
| **過去の販売データ** | ⚠️ | Marketplace Insights API（承認必要） | ZIK Analytics（$29.99/月） |
| **販売個数（競合）** | ⚠️ | Marketplace Insights API（承認必要） | 推定値のみ |
| **販売価格（競合）** | ⚠️ | Marketplace Insights API（承認必要） | - |
| **Best Offer価格** | ❌ | API提供なし | Terapeak（無料・UI） |
| **販売期間** | ⚠️ | Marketplace Insights API（承認必要） | - |
| **3年分の履歴** | ❌ | API提供なし | Terapeak（無料・UI） |
| **Terapeak データ** | ❌ | API提供なし | 手動エクスポート不可 |

**Marketplace Insights API**（⚠️ 制限付き）:
- **取得可能**: 過去90日間の販売データ
- **条件**: eBay の承認が必要（Limited Release）
- **承認難易度**: 高（一般開発者は困難）

---

## 5️⃣ 画像・メディアデータ

### 仕入元サイトから画像取得（🟢 実装可能）

| データ項目 | 取得可能性 | 方法 | 実装状況 | 対応サイト |
|-----------|----------|------|---------|-----------|
| **商品画像URL** | 🟢 | HTMLスクレイピング | 未実装 | Yahoo!ショッピング |
| **商品画像URL** | 🟢 | HTMLスクレイピング | 未実装 | 楽天市場 |
| **商品画像URL** | 🟢 | HTMLスクレイピング | 未実装 | Amazon |
| **商品画像URL** | 🟢 | HTMLスクレイピング | 未実装 | メルカリ |
| **商品画像URL** | 🟢 | HTMLスクレイピング | 未実装 | その他（汎用） |

**実装必要**（Phase 2）:
```javascript
// ImageExtractor.gs（新規作成）
function extractImagesFromYahooShopping(url) {
  const html = UrlFetchApp.fetch(url).getContentText();
  const imageUrls = parseImageUrlsFromHTML(html, 'yahoo');
  return imageUrls;
}
```

**⚠️ 注意**:
- 仕入先との契約で画像使用許諾を確認
- robots.txt とサイト利用規約を遵守

---

## 📋 スプレッドシート カラム設計案

### シート1: 出品管理

| 列番号 | カラム名 | データソース | 取得方法 | 実装状況 |
|-------|---------|------------|---------|---------|
| A | SKU | 手動入力 | - | ✅ |
| B | 商品名 | 手動入力 | - | ✅ |
| C | 商品説明 | 手動入力 | - | ✅ |
| D | カテゴリID | Taxonomy API | getCategoryTree() | 🟢 |
| E | カテゴリ名 | Taxonomy API | getCategoryTree() | 🟢 |
| F | 価格 | 手動入力 | - | ✅ |
| G | 通貨 | 手動入力 | - | ✅ |
| H | 在庫数 | 手動入力 | - | ✅ |
| I | コンディション | 手動入力 | - | ✅ |
| J | Brand | 手動入力 | - | ✅ |
| K | Model | 手動入力 | - | ✅ |
| L | Color | 手動入力 | - | ✅ |
| M | 画像URL1 | 手動入力 | - | ✅ |
| N | 画像URL2 | 手動入力 | - | ✅ |
| O | 画像URL3-24 | 手動入力 | - | ✅ |
| P | 配送ポリシーID | 手動入力 | - | ✅ |
| Q | 支払ポリシーID | 手動入力 | - | ✅ |
| R | 返品ポリシーID | 手動入力 | - | ✅ |
| S | **Best Offer有効** | 手動入力 | TRUE/FALSE | 🟢 |
| T | **自動承認価格** | 手動入力 | - | 🟢 |
| U | **自動拒否価格** | 手動入力 | - | 🟢 |
| V | **Offer ID** | Inventory API | createOffer() | 🟢 |
| W | **Listing ID** | Inventory API | publishOffer() | 🟢 |
| X | **出品ステータス** | Inventory API | getOffer() | 🟢 |
| Y | **ウォッチ数** | Trading API | GetMyeBaySelling | 🟢 |
| Z | **販売個数** | Trading API | GetMyeBaySelling | 🟢 |
| AA | **売上金額** | Trading API | GetMyeBaySelling | 🟢 |
| AB | **Sell-through Rate** | Trading API | GetMyeBaySelling | 🟢 |
| AC | 最終更新日時 | 自動記録 | - | ✅ |

---

### シート2: 価格リサーチ

| 列番号 | カラム名 | データソース | 取得方法 | 実装状況 |
|-------|---------|------------|---------|---------|
| A | 検索キーワード | 手動入力 | - | ✅ |
| B | 検索日時 | 自動記録 | - | ✅ |
| C | **総出品数** | Browse API | searchItems() | ✅ |
| D | **最安値** | Browse API | 統計分析 | 🟢 |
| E | **最高値** | Browse API | 統計分析 | 🟢 |
| F | **平均価格** | Browse API | 統計分析 | 🟢 |
| G | **中央値** | Browse API | 統計分析 | 🟢 |
| H | **25パーセンタイル** | Browse API | 統計分析 | 🟢 |
| I | **75パーセンタイル** | Browse API | 統計分析 | 🟢 |
| J | **推奨価格（低）** | Browse API | 算出 | 🟢 |
| K | **推奨価格（最適）** | Browse API | 算出 | 🟢 |
| L | **推奨価格（高）** | Browse API | 算出 | 🟢 |
| M | 競合数（NEW） | Browse API | フィルター | 🟢 |
| N | 競合数（USED） | Browse API | フィルター | 🟢 |

---

### シート3: 競合商品リスト

| 列番号 | カラム名 | データソース | 取得方法 | 実装状況 |
|-------|---------|------------|---------|---------|
| A | Item ID | Browse API | searchItems() | ✅ |
| B | 商品タイトル | Browse API | searchItems() | ✅ |
| C | 価格 | Browse API | searchItems() | ✅ |
| D | 通貨 | Browse API | searchItems() | ✅ |
| E | コンディション | Browse API | searchItems() | ✅ |
| F | カテゴリID | Browse API | searchItems() | ✅ |
| G | セラーID | Browse API | searchItems() | ✅ |
| H | セラー評価% | Browse API | searchItems() | ✅ |
| I | 送料 | Browse API | searchItems() | ✅ |
| J | 商品URL | Browse API | searchItems() | ✅ |
| K | 画像URL | Browse API | searchItems() | ✅ |
| L | **ウォッチ数** | Browse API | searchItems() | ⚠️ 要承認 |

---

### シート4: Item Specifics 抽出

| 列番号 | カラム名 | データソース | 取得方法 | 実装状況 |
|-------|---------|------------|---------|---------|
| A | 競合URL | 手動入力 | - | ✅ |
| B | Item ID | Browse API | URL解析 | 🟢 |
| C | 商品タイトル | Browse API | getItem() | ✅ |
| D | Brand | Browse API | getItem() | ✅ |
| E | Model | Browse API | getItem() | ✅ |
| F | Color | Browse API | getItem() | ✅ |
| G | Size | Browse API | getItem() | ✅ |
| H | Material | Browse API | getItem() | ✅ |
| I-Z | その他アスペクト | Browse API | getItem() | ✅ |

---

### シート5: カテゴリマスタ

| 列番号 | カラム名 | データソース | 取得方法 | 実装状況 |
|-------|---------|------------|---------|---------|
| A | カテゴリID | Taxonomy API | getCategoryTree() | 🟢 |
| B | カテゴリ名 | Taxonomy API | getCategoryTree() | 🟢 |
| C | カテゴリパス | Taxonomy API | getCategoryTree() | 🟢 |
| D | リーフカテゴリ | Taxonomy API | getCategoryTree() | 🟢 |
| E | 親カテゴリID | Taxonomy API | getCategoryTree() | 🟢 |

---

### シート6: アスペクトマスタ

| 列番号 | カラム名 | データソース | 取得方法 | 実装状況 |
|-------|---------|------------|---------|---------|
| A | カテゴリID | Taxonomy API | - | 🟢 |
| B | アスペクト名 | Taxonomy API | getCategoryAspects() | 🟢 |
| C | 必須/推奨 | Taxonomy API | getCategoryAspects() | 🟢 |
| D | 入力形式 | Taxonomy API | getCategoryAspects() | 🟢 |
| E | 値リスト | Taxonomy API | getCategoryAspects() | 🟢 |

---

### シート7: ログ

| 列番号 | カラム名 | データソース | 取得方法 | 実装状況 |
|-------|---------|------------|---------|---------|
| A | タイムスタンプ | 自動記録 | - | ✅ |
| B | 処理名 | 自動記録 | - | ✅ |
| C | ステータス | 自動記録 | - | ✅ |
| D | メッセージ | 自動記録 | - | ✅ |
| E | エラー詳細 | 自動記録 | - | ✅ |

---

## 🎯 データ取得の優先順位

### Phase 1: 最優先（🔴）

| データ項目 | API | 実装ファイル | 優先度 |
|-----------|-----|------------|--------|
| 出品機能（Offer作成・公開） | Inventory API | Listing.gs | 🔴 |
| 価格リサーチ（統計分析） | Browse API | PriceResearch.gs | 🔴 |
| カテゴリ取得 | Taxonomy API | CategoryManager.gs | 🔴 |
| Item Specifics抽出 | Browse API | ItemSpecificsExtractor.gs | 🔴 |

---

### Phase 1.5: 高優先（🟡）

| データ項目 | API | 実装ファイル | 優先度 |
|-----------|-----|------------|--------|
| **ウォッチ数取得** | Trading API | WatchCount.gs | 🟡 |
| **販売個数・売上** | Trading API | SalesData.gs | 🟡 |
| 価格・在庫変更 | Inventory API | Listing.gs | 🟡 |

---

### Phase 2: 中優先（🟢）

| データ項目 | API | 実装ファイル | 優先度 |
|-----------|-----|------------|--------|
| 画像自動取得 | スクレイピング | ImageExtractor.gs | 🟢 |
| 価格トレンド分析 | Browse API | PriceTrend.gs | 🟢 |

---

### Phase 3: 低優先（🔵）

| データ項目 | API | 実装ファイル | 優先度 |
|-----------|-----|------------|--------|
| AI推奨価格 | 独自ロジック | AIPricing.gs | 🔵 |
| 自動価格改定 | Inventory API | AutoRepricing.gs | 🔵 |

---

## 📈 データ可視化例

### 価格リサーチ結果（例）

```
検索キーワード: MacBook Pro 14 M3
検索日時: 2026-03-10 15:30:00
────────────────────────────────────
総出品数: 1,247件
────────────────────────────────────
価格統計:
  最安値:     $1,599.00
  最高値:     $2,499.00
  平均価格:   $1,899.45
  中央値:     $1,849.00
────────────────────────────────────
価格分布（パーセンタイル）:
  25%:        $1,749.00
  50%:        $1,849.00
  75%:        $1,999.00
────────────────────────────────────
推奨価格帯:
  低価格戦略: $1,749.00  ← 売れやすい
  最適価格:   $1,849.00  ← 推奨
  高価格戦略: $1,999.00  ← 利益重視
────────────────────────────────────
コンディション別競合数:
  NEW:        847件
  USED:       400件
────────────────────────────────────
```

---

### 自分の出品データ（例）

```
SKU: LAPTOP-001
商品名: Apple MacBook Pro 14-inch M3
────────────────────────────────────
出品情報:
  Offer ID:        123456789012
  Listing ID:      110588771234
  ステータス:      PUBLISHED（公開中）
────────────────────────────────────
価格・在庫:
  価格:           $1,849.00
  在庫数:         5個
────────────────────────────────────
パフォーマンス:
  ウォッチ数:      47人
  販売個数:        3個
  売上金額:        $5,547.00
  Sell-through:    60%
────────────────────────────────────
最終更新: 2026-03-10 15:45:00
````

---

## 💡 データ活用例

### ユースケース1: 出品前の価格決定

```
1. 価格リサーチ実行
   ↓ Browse API で競合データ取得
2. 統計分析
   ↓ 最安値、平均、中央値を算出
3. 推奨価格提示
   ↓ パーセンタイルから3つの戦略
4. 価格決定
   ↓ スプレッドシートに入力
5. 出品実行
   ↓ Inventory API で出品
```

---

### ユースケース2: 競合分析

```
1. 競合URLを貼り付け
   ↓ スプレッドシートに入力
2. Item Specifics取得
   ↓ Browse API で詳細取得
3. 自分の商品と比較
   ↓ 差別化ポイント発見
4. 商品説明改善
   ↓ より魅力的な訴求
```

---

### ユースケース3: 在庫・価格の最適化

```
1. ウォッチ数確認
   ↓ Trading API で取得
2. 需要判断
   ↓ ウォッチ数 > 10 なら需要あり
3. 価格戦略
   ↓ ウォッチ多い → 値上げ検討
   ↓ ウォッチ少ない → 値下げ検討
4. 価格変更
   ↓ Inventory API で更新
5. 効果測定
   ↓ 販売個数・売上で確認
```

---

## 🔍 現在取得できないデータ

### ❌ API 提供なし

1. **Terapeak の過去3年分データ**
   - Terapeak API なし
   - UI でのみアクセス可能
   - エクスポート不可

2. **Best Offer 受け入れ価格**
   - API で取得不可
   - 実際の成約価格は不明

3. **競合の正確な販売個数**
   - Marketplace Insights API（要承認）
   - または推定値のみ（ZIK Analytics等）

4. **過去90日以上の販売履歴**
   - Marketplace Insights API でも90日まで
   - それ以上は自前で蓄積が必要

---

### ⚠️ 制限あり

1. **競合のウォッチ数**
   - Browse API で取得可能
   - ただし App Check で承認が必要
   - 承認難易度: 不明

2. **競合の販売履歴**
   - Marketplace Insights API
   - Limited Release（承認必要）
   - 一般開発者には困難

---

## 📚 関連ドキュメント

### 仕様書
1. `listing-tool-spec.md` - 出品ツール仕様書
2. `api-feasibility-check.md` - API実現可能性チェック
3. `price-research-spec.md` - 価格リサーチ仕様書
4. `item-specifics-extraction-spec.md` - Item Specifics取得仕様書
5. `terapeak-investigation.md` - テラピーク調査結果
6. `zik-algopix-comparison.md` - ZIK Analytics vs Algopix

### API ドキュメント
1. `ebay_api_comprehensive_research.md` - eBay API詳細調査

---

## 🎯 次のステップ

### 即座に実装可能（すでにAPIが使える）

1. ✅ **価格リサーチ機能** - `PriceResearch.gs`
2. ✅ **Item Specifics抽出** - `ItemSpecificsExtractor.gs`
3. ✅ **競合商品リスト取得**

### 実装必要（APIは確認済み）

1. 🟢 **出品機能** - `Listing.gs`
2. 🟢 **カテゴリ取得** - `CategoryManager.gs`
3. 🟢 **ウォッチ数取得** - `WatchCount.gs`（Trading API統合）

---

**このドキュメントは、現在取得可能なすべてのデータを網羅しています。**
**実装の優先順位に従って、Phase 1 から順次実装していきます。**
