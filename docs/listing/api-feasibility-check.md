# API実現可能性チェック結果

## 結論：すべて実現可能 ✅

eBay Inventory API と Taxonomy API を使用することで、要件をすべて満たせます。

---

## 1. スプレッドシートの内容で出品ができる ✅

### 使用API
**Inventory API** (Sell API カテゴリ)

### 実装方法（3ステップ）

#### Step 1: 在庫アイテムの作成
**エンドポイント**: `PUT /sell/inventory/v1/inventory_item/{sku}`

```javascript
// スプレッドシートのデータから在庫アイテムを作成
function createInventoryItemFromSheet(rowData) {
  const inventoryItem = {
    "product": {
      "title": rowData.商品名,
      "description": rowData.商品説明,
      "aspects": {
        "Brand": [rowData.ブランド],
        // カテゴリ別の必須アスペクト
      },
      "imageUrls": [
        rowData.画像URL1,
        rowData.画像URL2,
        // ... 最大24枚
      ]
    },
    "condition": rowData.コンディション,  // "NEW", "USED_EXCELLENT" など
    "availability": {
      "shipToLocationAvailability": {
        "quantity": rowData.在庫数
      }
    }
  };

  // API呼び出し
  return createOrUpdateInventoryItem(rowData.SKU, inventoryItem);
}
```

**レスポンス例**:
```json
{
  "sku": "LAPTOP-001",
  "locale": "en_US",
  "product": {
    "title": "Apple MacBook Pro 14-inch M3",
    ...
  }
}
```

#### Step 2: オファー（リスティング）の作成
**エンドポイント**: `POST /sell/inventory/v1/offer`

```javascript
function createOfferFromSheet(rowData) {
  const offer = {
    "sku": rowData.SKU,
    "marketplaceId": "EBAY_US",
    "format": "FIXED_PRICE",
    "listingDescription": rowData.商品説明,
    "availableQuantity": rowData.在庫数,
    "categoryId": rowData.カテゴリID,
    "pricingSummary": {
      "price": {
        "value": rowData.価格.toString(),
        "currency": rowData.通貨
      }
    },
    "listingPolicies": {
      // ビジネスポリシー（配送、支払い、返品）
      "fulfillmentPolicyId": "配送ポリシーID",
      "paymentPolicyId": "支払いポリシーID",
      "returnPolicyId": "返品ポリシーID"
    }
  };

  return ebayApiRequest('/sell/inventory/v1/offer', 'POST', null, offer);
}
```

**レスポンス例**:
```json
{
  "offerId": "123456789012",
  "sku": "LAPTOP-001",
  "marketplaceId": "EBAY_US",
  "format": "FIXED_PRICE",
  "listingId": null,  // まだ公開されていない
  "status": "UNPUBLISHED"
}
```

#### Step 3: リスティングの公開
**エンドポイント**: `POST /sell/inventory/v1/offer/{offerId}/publish`

```javascript
function publishListing(offerId) {
  const response = ebayApiRequest(
    `/sell/inventory/v1/offer/${offerId}/publish`,
    'POST'
  );

  return response;
}
```

**レスポンス例**:
```json
{
  "listingId": "110588771234",  // eBayリスティングID
  "warnings": []
}
```

### 実装済み機能
- ✅ `createOrUpdateInventoryItem()` - すでに実装済み（EbayAPI.gs:187）
- ❌ `createOffer()` - 実装必要
- ❌ `publishOffer()` - 実装必要

---

## 2. 出品後の価格調整・在庫変更ができる ✅

### 使用API
**Inventory API** (同じく)

### 2-1. 価格変更

**エンドポイント**: `PUT /sell/inventory/v1/offer/{offerId}`

```javascript
function updatePrice(offerId, newPrice, currency) {
  const updateData = {
    "pricingSummary": {
      "price": {
        "value": newPrice.toString(),
        "currency": currency || "USD"
      }
    }
  };

  return ebayApiRequest(
    `/sell/inventory/v1/offer/${offerId}`,
    'PUT',
    null,
    updateData
  );
}
```

**スプレッドシートから一括価格変更の例**:
```javascript
function updatePricesFromSheet() {
  const sheet = getOrCreateSheet('出品管理');
  const data = readDataFromSheet('出品管理', { startRow: 2 });

  data.forEach((row, index) => {
    const offerId = row[19];  // オファーID列
    const newPrice = row[5];  // 価格列
    const currency = row[6];  // 通貨列

    if (offerId && newPrice) {
      try {
        updatePrice(offerId, newPrice, currency);
        Logger.log(`価格更新成功: ${row[0]} - ${newPrice}`);
      } catch (error) {
        Logger.log(`価格更新失敗: ${row[0]} - ${error.message}`);
      }
    }
  });
}
```

### 2-2. 在庫数変更

**エンドポイント**: `PUT /sell/inventory/v1/inventory_item/{sku}`

```javascript
function updateInventoryQuantity(sku, newQuantity) {
  const inventoryUpdate = {
    "availability": {
      "shipToLocationAvailability": {
        "quantity": newQuantity
      }
    }
  };

  return createOrUpdateInventoryItem(sku, inventoryUpdate);
}
```

**スプレッドシートから一括在庫変更の例**:
```javascript
function updateInventoryFromSheet() {
  const sheet = getOrCreateSheet('出品管理');
  const data = readDataFromSheet('出品管理', { startRow: 2 });

  data.forEach((row, index) => {
    const sku = row[0];      // SKU列
    const newQty = row[7];   // 在庫数列

    if (sku && newQty !== undefined) {
      try {
        updateInventoryQuantity(sku, newQty);
        Logger.log(`在庫更新成功: ${sku} - ${newQty}個`);
      } catch (error) {
        Logger.log(`在庫更新失敗: ${sku} - ${error.message}`);
      }
    }
  });
}
```

### 重要な仕様

**即時反映される項目**:
- 在庫数（quantity）
- 価格（price）
- 商品説明（description）

**変更できない項目**:
- SKU（一度作成したら変更不可）
- カテゴリID（再出品が必要）

**ベストプラクティス**:
- 価格・在庫の一括変更は50件ずつバッチ処理
- 各API呼び出し間に100msの遅延
- 変更後、スプレッドシートのステータスを更新

---

## 3. カテゴリを取得できる ✅

### 使用API
**Taxonomy API** (Commerce API カテゴリ)

### 3-1. カテゴリツリーの取得

**エンドポイント**: `GET /commerce/taxonomy/v1/category_tree/{category_tree_id}`

```javascript
function getCategoryTree(categoryTreeId) {
  // category_tree_id は マーケットプレイスごとに異なる
  // EBAY_US = 0
  // EBAY_UK = 3
  // EBAY_DE = 77

  return ebayApiRequest(
    `/commerce/taxonomy/v1/category_tree/${categoryTreeId}`,
    'GET'
  );
}
```

**レスポンス例**:
```json
{
  "categoryTreeId": "0",
  "categoryTreeVersion": "119",
  "rootCategoryNode": {
    "category": {
      "categoryId": "20081",
      "categoryName": "Antiques"
    },
    "childCategoryTreeNodes": [
      {
        "category": {
          "categoryId": "37903",
          "categoryName": "Antiquities"
        },
        "leafCategoryTreeNode": false
      }
    ]
  }
}
```

### 3-2. カテゴリのデフォルトID取得

**エンドポイント**: `GET /commerce/taxonomy/v1/get_default_category_tree_id`

```javascript
function getDefaultCategoryTreeId(marketplaceId) {
  return ebayApiRequest(
    '/commerce/taxonomy/v1/get_default_category_tree_id',
    'GET',
    { marketplace_id: marketplaceId }
  );
}
```

**レスポンス例**:
```json
{
  "categoryTreeId": "0",
  "categoryTreeVersion": "119"
}
```

### 3-3. カテゴリ別の必須アスペクト取得

**エンドポイント**: `GET /commerce/taxonomy/v1/category_tree/{category_tree_id}/get_item_aspects_for_category`

```javascript
function getCategoryAspects(categoryTreeId, categoryId) {
  const params = {
    category_id: categoryId
  };

  return ebayApiRequest(
    `/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_item_aspects_for_category`,
    'GET',
    params
  );
}
```

**レスポンス例**:
```json
{
  "aspects": [
    {
      "aspectConstraint": {
        "aspectRequired": true,
        "aspectMode": "SELECTION_ONLY"
      },
      "aspectValues": [
        {
          "value": "Apple"
        },
        {
          "value": "Dell"
        }
      ],
      "localizedAspectName": "Brand"
    },
    {
      "aspectConstraint": {
        "aspectRequired": false,
        "aspectMode": "FREE_TEXT"
      },
      "localizedAspectName": "Color"
    }
  ]
}
```

### 3-4. スプレッドシートへのカテゴリ情報取得

```javascript
function fetchCategoriesToSheet() {
  const categoryTreeId = '0';  // EBAY_US
  const categories = [];

  // ルートカテゴリから再帰的に取得
  function traverseCategories(node, parentPath = '') {
    const category = node.category;
    const path = parentPath + ' > ' + category.categoryName;

    categories.push({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      categoryPath: path,
      isLeaf: node.leafCategoryTreeNode || false
    });

    if (node.childCategoryTreeNodes) {
      node.childCategoryTreeNodes.forEach(child => {
        traverseCategories(child, path);
      });
    }
  }

  // カテゴリツリーを取得
  const tree = getCategoryTree(categoryTreeId);
  traverseCategories(tree.rootCategoryNode);

  // スプレッドシートに書き込み
  const headers = ['カテゴリID', 'カテゴリ名', 'カテゴリパス', 'リーフカテゴリ'];
  const keys = ['categoryId', 'categoryName', 'categoryPath', 'isLeaf'];

  writeObjectsToSheet('カテゴリマスタ', categories, headers, keys);

  return categories;
}
```

### 3-5. カテゴリ検索機能（補助）

```javascript
function searchCategory(keyword) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('カテゴリマスタ');

  if (!sheet) {
    throw new Error('カテゴリマスタシートが見つかりません');
  }

  const data = sheet.getDataRange().getValues();
  const results = [];

  // キーワードで検索
  data.forEach((row, index) => {
    if (index === 0) return;  // ヘッダー行をスキップ

    const categoryName = row[1];
    const categoryPath = row[2];

    if (categoryName.toLowerCase().includes(keyword.toLowerCase()) ||
        categoryPath.toLowerCase().includes(keyword.toLowerCase())) {
      results.push({
        categoryId: row[0],
        categoryName: categoryName,
        categoryPath: categoryPath,
        isLeaf: row[3]
      });
    }
  });

  return results;
}
```

**使用例**:
```javascript
// "laptop" でカテゴリ検索
const laptopCategories = searchCategory('laptop');
// 結果:
// [
//   { categoryId: "111422", categoryName: "PC Laptops & Netbooks", ... },
//   { categoryId: "175672", categoryName: "Laptop & Desktop Accessories", ... }
// ]
```

---

## まとめ：実装の流れ

### 出品フロー
```
スプレッドシート入力
  ↓
① 在庫アイテム作成 (PUT /inventory_item/{sku})
  ↓
② オファー作成 (POST /offer)
  ↓
③ リスティング公開 (POST /offer/{offerId}/publish)
  ↓
リスティングID取得・記録
```

### 価格・在庫変更フロー
```
スプレッドシートで編集
  ↓
価格変更: PUT /offer/{offerId}
在庫変更: PUT /inventory_item/{sku}
  ↓
eBayに即時反映
```

### カテゴリ取得フロー
```
① デフォルトカテゴリツリーID取得
  ↓
② カテゴリツリー全体取得
  ↓
③ カテゴリマスタシートに書き込み
  ↓
④ キーワード検索で必要なカテゴリを特定
  ↓
⑤ カテゴリアスペクト（必須項目）取得
```

---

## 追加で実装が必要な関数

すでに `EbayAPI.gs` に実装済み:
- ✅ `createOrUpdateInventoryItem()`
- ✅ `getCategoryTree()`

新規実装が必要:
- ❌ `createOffer()` - オファー作成
- ❌ `updateOffer()` - オファー更新（価格変更）
- ❌ `publishOffer()` - リスティング公開
- ❌ `getOfferById()` - オファー詳細取得
- ❌ `getCategoryAspects()` - カテゴリアスペクト取得
- ❌ `getDefaultCategoryTreeId()` - デフォルトカテゴリツリーID取得

これらは次のPhase 1実装で追加します。

---

## API制限事項

### レート制限
- デフォルト：1日あたりの呼び出し制限あり
- 推奨間隔：100ms（設定可能）

### データ制限
- 画像：最大24枚
- 商品タイトル：最大80文字
- SKU：最大50文字

### ビジネスポリシー
出品前に以下のポリシーを eBay で設定する必要があります：
- 配送ポリシー（Fulfillment Policy）
- 支払いポリシー（Payment Policy）
- 返品ポリシー（Return Policy）

これらのIDを取得して、オファー作成時に指定します。

---

## 結論

**すべての要件がeBay APIで実現可能です。**

1. ✅ スプレッドシートから出品可能（Inventory API）
2. ✅ 出品後の価格・在庫変更可能（Inventory API）
3. ✅ カテゴリ取得可能（Taxonomy API）

次のステップは Phase 1 の実装開始です。
