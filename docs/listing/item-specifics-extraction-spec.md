# eBay競合リスティングからItem Specifics取得機能 仕様書

**作成日**: 2026-03-10
**バージョン**: 1.0.0

---

## 結論：完全に実現可能 ✅（公式API使用）

eBay Browse API を使用することで、競合リスティングから Item specifics を**合法的かつ安定的**に取得できます。

---

## 目次

1. [概要](#概要)
2. [実現方法](#実現方法)
3. [技術仕様](#技術仕様)
4. [実装例](#実装例)
5. [スプレッドシート統合](#スプレッドシート統合)
6. [メリット](#メリット)
7. [注意事項](#注意事項)

---

## 概要

### 目的

競合のeBayリスティングURLを参考にして、正確なItem specificsを取得し、自社の出品に活用する。

### 活用シーン

1. **新規出品時**: 同じ商品の競合出品を参考に正確なItem specificsを設定
2. **カテゴリ要件確認**: そのカテゴリで必須/推奨されるアスペクトを確認
3. **ベストプラクティス学習**: 売れている商品のアスペクト設定を参考にする
4. **効率化**: 手動で調べる時間を大幅削減

### 取得できる情報

- ✅ Item specifics (Brand, Model, Color, Size など)
- ✅ カテゴリID
- ✅ 商品タイトル
- ✅ 商品説明
- ✅ 価格
- ✅ コンディション
- ✅ 配送情報
- ✅ 画像URL（最大24枚）

---

## 実現方法

### 方法1: eBay Browse API（推奨）⭐⭐⭐⭐⭐

**使用API**: Browse API の `getItem` メソッド

**エンドポイント**: `GET /buy/browse/v1/item/{item_id}`

**メリット**:
- ✅ 公式APIで合法的
- ✅ 安定性が高い
- ✅ 構造化されたデータ
- ✅ すべてのマーケットプレイス対応
- ✅ 実装が簡単

**デメリット**:
- Item IDが必要（URLから抽出）
- API制限あり（デフォルト制限内で十分）

---

## 技術仕様

### 1. eBay URLからItem IDを抽出

eBayのリスティングURLには複数のパターンがあります：

#### URL パターン例

```
パターン1（標準）:
https://www.ebay.com/itm/Apple-MacBook-Pro-14-inch/123456789012
→ Item ID: 123456789012

パターン2（短縮）:
https://www.ebay.com/itm/123456789012
→ Item ID: 123456789012

パターン3（クエリパラメータ）:
https://www.ebay.com/itm/product-name?hash=item1234567890
→ Item ID: 1234567890 (hashパラメータから)

パターン4（短縮URL）:
https://ebay.us/abcdef
→ リダイレクト後に取得
```

#### 実装コード

```javascript
/**
 * eBay URLからItem IDを抽出
 *
 * @param {string} ebayUrl - eBayリスティングURL
 * @returns {string} Item ID
 */
function extractItemIdFromUrl(ebayUrl) {
  try {
    // URLの正規化
    let url = ebayUrl.trim();

    // 短縮URLの場合は展開
    if (url.includes('ebay.us/') || url.includes('ebay.to/')) {
      url = expandShortUrl(url);
    }

    // パターン1: /itm/商品名/数字
    let match = url.match(/\/itm\/[^\/]+\/(\d+)/);
    if (match) {
      return match[1];
    }

    // パターン2: /itm/数字
    match = url.match(/\/itm\/(\d+)/);
    if (match) {
      return match[1];
    }

    // パターン3: ?hash=item数字
    match = url.match(/[?&]hash=item([0-9a-f]+)/i);
    if (match) {
      // ハッシュ値を10進数に変換
      return parseInt(match[1], 16).toString();
    }

    // パターン4: クエリパラメータのitem
    const urlObj = new URL(url);
    const itemParam = urlObj.searchParams.get('item');
    if (itemParam) {
      return itemParam;
    }

    throw new Error('Item IDを抽出できませんでした');

  } catch (error) {
    Logger.log('Item ID抽出エラー: ' + error.toString());
    throw new Error('無効なeBay URLです: ' + error.message);
  }
}

/**
 * 短縮URLを展開
 */
function expandShortUrl(shortUrl) {
  try {
    const response = UrlFetchApp.fetch(shortUrl, {
      followRedirects: false,
      muteHttpExceptions: true
    });

    const location = response.getHeaders()['Location'] ||
                     response.getHeaders()['location'];

    if (location) {
      return location;
    }

    return shortUrl;
  } catch (error) {
    Logger.log('短縮URL展開エラー: ' + error.toString());
    return shortUrl;
  }
}
```

### 2. Browse APIで商品詳細を取得

既に実装済みの `getItem()` 関数を使用します。

#### APIレスポンス例

```json
{
  "itemId": "v1|123456789012|0",
  "title": "Apple MacBook Pro 14-inch M3 Chip 16GB RAM 512GB SSD Space Gray",
  "categoryPath": "Computers/Tablets & Networking|Laptops & Netbooks|Apple Laptops",
  "categoryId": "111422",
  "condition": "New",
  "conditionDescription": "Brand New",
  "price": {
    "value": "1999.99",
    "currency": "USD"
  },
  "image": {
    "imageUrl": "https://i.ebayimg.com/images/g/xxx/s-l1600.jpg"
  },
  "additionalImages": [
    {
      "imageUrl": "https://i.ebayimg.com/images/g/yyy/s-l1600.jpg"
    }
  ],
  "product": {
    "title": "Apple MacBook Pro 14-inch",
    "description": "Powerful laptop with M3 chip...",
    "aspects": {
      "Brand": ["Apple"],
      "Model": ["MacBook Pro"],
      "Screen Size": ["14 in"],
      "Processor": ["Apple M3"],
      "RAM Size": ["16 GB"],
      "SSD Capacity": ["512 GB"],
      "Color": ["Space Gray"],
      "Operating System": ["macOS"],
      "Year": ["2023"],
      "Release Year": ["2023"]
    },
    "brand": "Apple",
    "mpn": "MRX33LL/A",
    "imageUrls": [
      "https://i.ebayimg.com/images/g/xxx/s-l1600.jpg"
    ]
  },
  "itemWebUrl": "https://www.ebay.com/itm/123456789012",
  "description": "<div>Full HTML description...</div>",
  "quantityAvailableForPurchase": 5,
  "seller": {
    "username": "seller123",
    "feedbackPercentage": "99.8",
    "feedbackScore": 5000
  }
}
```

### 3. Item Specificsの抽出と整形

```javascript
/**
 * eBay URLからItem Specificsを取得
 *
 * @param {string} ebayUrl - eBayリスティングURL
 * @returns {Object} Item Specifics とその他の情報
 */
function extractItemSpecificsFromEbayUrl(ebayUrl) {
  try {
    Logger.log('Item Specifics取得開始: ' + ebayUrl);

    // 1. URLからItem IDを抽出
    const itemId = extractItemIdFromUrl(ebayUrl);
    Logger.log('Item ID: ' + itemId);

    // 2. Browse APIで商品詳細を取得（既存関数を使用）
    const itemDetails = getItem(itemId);

    // 3. Item Specificsを抽出
    const itemSpecifics = {};
    if (itemDetails.product && itemDetails.product.aspects) {
      // aspectsオブジェクトをコピー
      Object.keys(itemDetails.product.aspects).forEach(key => {
        const values = itemDetails.product.aspects[key];
        // 配列の場合は最初の値を使用、単一値の場合はそのまま
        itemSpecifics[key] = Array.isArray(values) ? values[0] : values;
      });
    }

    // 4. 結果をまとめる
    const result = {
      // Item Specifics
      itemSpecifics: itemSpecifics,

      // 基本情報
      title: itemDetails.title || '',
      categoryId: itemDetails.categoryId || '',
      categoryPath: itemDetails.categoryPath || '',
      condition: itemDetails.condition || '',
      price: itemDetails.price ? itemDetails.price.value : '',
      currency: itemDetails.price ? itemDetails.price.currency : 'USD',

      // 商品情報
      brand: itemDetails.product ? itemDetails.product.brand : '',
      mpn: itemDetails.product ? itemDetails.product.mpn : '',
      description: itemDetails.description || '',

      // 画像URL
      imageUrls: [],

      // 元のURL
      sourceUrl: ebayUrl,
      itemId: itemId
    };

    // 画像URLを収集
    if (itemDetails.image && itemDetails.image.imageUrl) {
      result.imageUrls.push(itemDetails.image.imageUrl);
    }

    if (itemDetails.additionalImages) {
      itemDetails.additionalImages.forEach(img => {
        if (img.imageUrl) {
          result.imageUrls.push(img.imageUrl);
        }
      });
    }

    // product.imageUrlsも確認
    if (itemDetails.product && itemDetails.product.imageUrls) {
      result.imageUrls.push(...itemDetails.product.imageUrls);
    }

    // 重複削除
    result.imageUrls = [...new Set(result.imageUrls)];

    Logger.log('Item Specifics取得成功');
    Logger.log('取得したアスペクト数: ' + Object.keys(itemSpecifics).length);

    return result;

  } catch (error) {
    Logger.log('Item Specifics取得エラー: ' + error.toString());
    throw error;
  }
}
```

---

## 実装例

### 使用例1: 基本的な取得

```javascript
// eBay URLを指定
const ebayUrl = "https://www.ebay.com/itm/123456789012";

// Item Specificsを取得
const result = extractItemSpecificsFromEbayUrl(ebayUrl);

// 結果を確認
Logger.log('カテゴリID: ' + result.categoryId);
Logger.log('ブランド: ' + result.itemSpecifics.Brand);
Logger.log('モデル: ' + result.itemSpecifics.Model);
Logger.log('色: ' + result.itemSpecifics.Color);

// すべてのItem Specificsを表示
Object.keys(result.itemSpecifics).forEach(key => {
  Logger.log(`${key}: ${result.itemSpecifics[key]}`);
});
```

**出力例**:
```
カテゴリID: 111422
ブランド: Apple
モデル: MacBook Pro
色: Space Gray
Brand: Apple
Model: MacBook Pro
Screen Size: 14 in
Processor: Apple M3
RAM Size: 16 GB
SSD Capacity: 512 GB
Color: Space Gray
Operating System: macOS
Year: 2023
```

### 使用例2: スプレッドシートへの反映

```javascript
/**
 * スプレッドシートに取得したItem Specificsを書き込む
 */
function fillItemSpecificsToSheet(rowIndex, itemSpecifics) {
  const sheet = getOrCreateSheet('出品管理');

  // カテゴリIDを書き込み
  if (itemSpecifics.categoryId) {
    sheet.getRange(rowIndex, 4).setValue(itemSpecifics.categoryId);  // D列
  }

  // ブランドを書き込み
  if (itemSpecifics.itemSpecifics.Brand) {
    sheet.getRange(rowIndex, 10).setValue(itemSpecifics.itemSpecifics.Brand);  // J列
  }

  // 商品名を書き込み（参考用）
  if (itemSpecifics.title) {
    sheet.getRange(rowIndex, 2).setValue(itemSpecifics.title);  // B列
  }

  // 画像URLを書き込み（最大24枚）
  itemSpecifics.imageUrls.forEach((url, index) => {
    if (index < 24) {
      sheet.getRange(rowIndex, 12 + index).setValue(url);  // L列から
    }
  });

  // Item Specificsを別シートに詳細記録
  writeItemSpecificsDetail(rowIndex, itemSpecifics);
}

/**
 * Item Specificsの詳細を別シートに記録
 */
function writeItemSpecificsDetail(rowIndex, itemSpecifics) {
  const sheet = getOrCreateSheet('Item Specifics詳細');

  // ヘッダーがない場合は追加
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1:D1').setValues([
      ['行番号', 'Attribute', 'Value', '参照URL']
    ]);
    sheet.getRange('A1:D1')
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
  }

  // 各Item Specificを1行ずつ記録
  Object.keys(itemSpecifics.itemSpecifics).forEach(key => {
    const value = itemSpecifics.itemSpecifics[key];
    sheet.appendRow([
      rowIndex,
      key,
      value,
      itemSpecifics.sourceUrl
    ]);
  });
}
```

---

## スプレッドシート統合

### 出品管理シートの拡張

新しい列を追加：

| 列 | 項目名 | 説明 |
|----|--------|------|
| AB | 参考eBay URL | 競合リスティングのURL |
| AC | Item Specifics取得ボタン | 自動取得トリガー |

### 自動取得フロー

```
[参考eBay URL列にURL入力]
  ↓
[「Item Specifics取得」ボタンをクリック]
  ↓
① URLからItem IDを抽出
  ↓
② Browse APIで商品詳細を取得
  ↓
③ Item Specificsを抽出
  ↓
④ スプレッドシートの該当列に自動入力
  ├─ カテゴリID
  ├─ ブランド
  ├─ その他のアスペクト
  └─ 画像URL（オプション）
  ↓
[完了メッセージ表示]
```

### 実装コード（統合版）

```javascript
/**
 * シートから参考URLを読み取り、Item Specificsを自動取得
 */
function autoFetchItemSpecificsFromSheet() {
  const sheet = getOrCreateSheet('出品管理');
  const data = readDataFromSheet('出品管理', { startRow: 2 });

  let successCount = 0;
  let errorCount = 0;

  data.forEach((row, index) => {
    const rowNumber = index + 2;  // ヘッダー行を考慮
    const referenceUrl = row[27];  // AB列: 参考eBay URL
    const hasData = row[3];        // D列: カテゴリID（既に入力済みか確認）

    // 参考URLがあり、まだデータが入力されていない場合
    if (referenceUrl && !hasData) {
      try {
        Logger.log(`Item Specifics取得: 行${rowNumber}`);

        // Item Specificsを取得
        const result = extractItemSpecificsFromEbayUrl(referenceUrl);

        // スプレッドシートに書き込み
        fillItemSpecificsToSheet(rowNumber, result);

        successCount++;
        Logger.log(`成功: 行${rowNumber}`);

        // レート制限対策
        Utilities.sleep(1000);

      } catch (error) {
        errorCount++;
        Logger.log(`エラー: 行${rowNumber} - ${error.message}`);
        logToSheet('ERROR', 'Item Specifics取得エラー', `行${rowNumber}: ${error.message}`);

        // エラーメッセージをセルに記録
        sheet.getRange(rowNumber, 28).setValue('エラー: ' + error.message);  // AC列
      }
    }
  });

  // 結果を表示
  const message =
    `Item Specifics自動取得が完了しました\n\n` +
    `成功: ${successCount}件\n` +
    `エラー: ${errorCount}件`;

  SpreadsheetApp.getUi().alert('完了', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 選択した行のみItem Specificsを取得
 */
function fetchItemSpecificsForSelectedRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const activeRow = sheet.getActiveCell().getRow();

  if (activeRow === 1) {
    SpreadsheetApp.getUi().alert('データ行を選択してください');
    return;
  }

  try {
    const referenceUrl = sheet.getRange(activeRow, 28).getValue();  // AB列

    if (!referenceUrl) {
      SpreadsheetApp.getUi().alert('参考eBay URLが入力されていません');
      return;
    }

    // Item Specificsを取得
    const result = extractItemSpecificsFromEbayUrl(referenceUrl);

    // スプレッドシートに書き込み
    fillItemSpecificsToSheet(activeRow, result);

    SpreadsheetApp.getUi().alert(
      '完了',
      'Item Specificsを取得しました\n\n' +
      `カテゴリ: ${result.categoryPath}\n` +
      `アスペクト数: ${Object.keys(result.itemSpecifics).length}件`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (error) {
    SpreadsheetApp.getUi().alert('エラー', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
```

### カスタムメニューへの追加

```javascript
// Code.gs の onOpen() に追加
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('eBay API')
    .addItem('🔐 認証', 'showAuthDialog')
    .addSeparator()
    .addItem('🔍 商品検索', 'showSearchDialog')
    .addItem('📦 在庫同期', 'syncInventory')
    .addItem('📋 注文取得', 'fetchOrders')
    .addSeparator()
    .addItem('📝 Item Specifics取得（選択行）', 'fetchItemSpecificsForSelectedRow')  // ★追加
    .addItem('📝 Item Specifics一括取得', 'autoFetchItemSpecificsFromSheet')         // ★追加
    .addSeparator()
    .addItem('📊 ダッシュボード作成', 'createDashboard')
    .addSeparator()
    .addItem('⚙️ 設定', 'showSettingsDialog')
    .addItem('ℹ️ バージョン情報', 'showAboutDialog')
    .addToUi();
}
```

---

## メリット

### 1. 作業効率の大幅向上

**従来の方法**:
1. 競合リスティングを開く
2. 画面をスクロールしてItem Specificsを探す
3. 各項目を手動でコピー
4. スプレッドシートに貼り付け
5. 1商品あたり5-10分

**新しい方法**:
1. eBay URLをコピー
2. スプレッドシートに貼り付け
3. ボタンをクリック
4. 1商品あたり10秒 ⚡

### 2. 精度の向上

- ✅ タイプミスの防止
- ✅ 正確なアスペクト名（大文字小文字含む）
- ✅ カテゴリに適した値
- ✅ eBayで使用されている実際の値

### 3. ベストプラクティスの学習

- 売れている商品の設定を参考にできる
- カテゴリごとの推奨アスペクトがわかる
- 競合の戦略を分析できる

### 4. 一貫性の確保

- 同じカテゴリの商品で統一されたアスペクト設定
- ブランド名のスペリング統一
- 業界標準の用語使用

---

## 注意事項

### 1. 合法性と倫理性

✅ **合法的な使用**:
- eBay公式APIを使用
- 公開情報のみ取得
- 利用規約に準拠

⚠️ **注意事項**:
- Item Specificsはあくまで参考情報
- 自社商品に合わせて適切に調整する
- 商品説明や画像の直接コピーは避ける
- 競合の知的財産を尊重する

### 2. API制限

- Browse APIにもレート制限あり
- 連続取得時は1秒間隔を推奨
- 大量取得はバッチ処理で対応

### 3. データの正確性

- 競合が誤った情報を入力している可能性
- 必ず自社商品の実際の仕様を確認
- カテゴリ要件（Taxonomy API）と照合

### 4. マーケットプレイス

- Browse APIは対象マーケットプレイスを指定可能
- 米国の商品から日本の商品へのItem Specifics転用には注意
- カテゴリIDがマーケットプレイスで異なる場合あり

---

## 実装ロードマップ

### Phase 1: 基本機能（1週間）

- [x] getItem() 関数（既存）
- [ ] extractItemIdFromUrl() - URL解析
- [ ] extractItemSpecificsFromEbayUrl() - Item Specifics抽出
- [ ] fillItemSpecificsToSheet() - シートへの書き込み

### Phase 2: UI統合（3日）

- [ ] カスタムメニュー追加
- [ ] 選択行での取得機能
- [ ] 一括取得機能
- [ ] プログレス表示

### Phase 3: 高度な機能（オプション）

- [ ] Item Specifics比較機能
- [ ] カテゴリ別推奨アスペクト表示
- [ ] 競合分析レポート
- [ ] 自動補完機能

---

## まとめ

### 実現可能性

✅ **完全に実現可能**
- eBay公式APIで合法的
- すでに基礎関数は実装済み
- シンプルな追加実装で完成

### 実用性

⭐⭐⭐⭐⭐ **非常に高い**
- 作業時間を90%以上削減
- 精度向上
- ベストプラクティスの学習
- 一貫性の確保

### 推奨度

⭐⭐⭐⭐⭐ **最優先で実装推奨**

この機能は出品ツールの**キラー機能**になる可能性が高いです。

---

## 次のステップ

1. `ItemSpecificsExtractor.gs` の作成
2. URL解析ロジックの実装
3. スプレッドシート統合
4. テストとデバッグ

実装を開始しますか？
