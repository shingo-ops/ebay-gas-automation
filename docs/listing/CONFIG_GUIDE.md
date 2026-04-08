# Config.js - シート・列マッピング設定ガイド

## 概要

`Config.js` は、スプレッドシートのシート名と列名を一元管理するための設定ファイルです。

### メリット

| 従来の方法 | Config.js 使用 |
|-----------|----------------|
| シート名・列名がコード内にハードコード | 設定ファイルで一元管理 |
| 修正時に複数ファイルを編集 | Config.jsのみ編集 |
| 変更漏れが発生しやすい | 定義ミスはすぐにエラーで検知 |
| コードの可読性が低い | `getColumnIndex('development', 'sourceUrl')` のように直感的 |

---

## 基本構造

### SHEET_CONFIG

すべてのシート設定を定義するオブジェクト。

```javascript
const SHEET_CONFIG = {
  development: {
    name: '開発用',
    columns: {
      sourceUrl: '仕入元URL',
      sourceName: '仕入元',
      image1: '画像1',
      // ...
    }
  },

  errorLog: {
    name: 'エラーログ',
    columns: {
      timestamp: 'タイムスタンプ',
      rowNumber: '行番号',
      // ...
    }
  }
};
```

### SHEET_KEYS

シート設定にアクセスするためのキー定義。

```javascript
const SHEET_KEYS = {
  DEVELOPMENT: 'development',
  ERROR_LOG: 'errorLog',
  // ...
};
```

### SETTING_KEYS

ツール設定シートの設定項目キー定義。

```javascript
const SETTING_KEYS = {
  IMAGE_FOLDER: '画像フォルダ',
  EBAY_TOKEN: 'eBayトークン',
  // ...
};
```

---

## 主要API

### 1. getSheetName(sheetKey)

シート名を取得します。

```javascript
const sheetName = getSheetName(SHEET_KEYS.DEVELOPMENT);
// => '開発用'
```

### 2. getSheetByKey(sheetKey)

シートオブジェクトを取得します。

```javascript
const sheet = getSheetByKey(SHEET_KEYS.DEVELOPMENT);
// => Sheetオブジェクト
```

### 3. getColumnName(sheetKey, columnKey)

ヘッダー名を取得します。

```javascript
const columnName = getColumnName(SHEET_KEYS.DEVELOPMENT, 'sourceUrl');
// => '仕入元URL'
```

### 4. getColumnIndex(sheetKey, columnKey)

列番号を取得します（1始まり）。

```javascript
const col = getColumnIndex(SHEET_KEYS.DEVELOPMENT, 'sourceUrl');
// => 5 (例)
```

### 5. getColumnIndices(sheetKey, columnKeys)

複数の列番号を一度に取得します（パフォーマンス最適化）。

```javascript
const cols = getColumnIndices(SHEET_KEYS.DEVELOPMENT, ['sourceUrl', 'sourceName', 'image1']);
// => { sourceUrl: 5, sourceName: 6, image1: 7 }
```

**推奨**: 複数列を取得する場合は、この関数を使用してヘッダー読み取りを1回で済ませます。

### 6. hasColumn(sheetKey, columnKey)

列が存在するか検証します。

```javascript
if (hasColumn(SHEET_KEYS.DEVELOPMENT, 'sourceUrl')) {
  // 処理
}
```

### 7. validateRequiredColumns(sheetKey, requiredColumns)

必須列の存在を検証します。

```javascript
const validation = validateRequiredColumns(SHEET_KEYS.DEVELOPMENT, ['sourceUrl', 'image1']);

if (!validation.valid) {
  ui.alert(`必須列が見つかりません: ${validation.missingColumns.join(', ')}`);
  return;
}
```

### 8. getConfigValue(settingName)

ツール設定シートから値を取得します。

```javascript
const imageFolderUrl = getConfigValue(SETTING_KEYS.IMAGE_FOLDER);
// => 'https://drive.google.com/...'
```

---

## 使用例

### 例1: シートと列の取得（従来 vs Config.js）

**従来の方法（ハードコード）:**
```javascript
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName('開発用');  // シート名ハードコード
const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
const sourceUrlCol = headers.indexOf('仕入元URL') + 1;  // 列名ハードコード
const image1Col = headers.indexOf('画像1') + 1;
```

**Config.js を使用:**
```javascript
const sheet = getSheetByKey(SHEET_KEYS.DEVELOPMENT);  // 設定から取得
const cols = getColumnIndices(SHEET_KEYS.DEVELOPMENT, ['sourceUrl', 'image1']);
// => { sourceUrl: 5, image1: 7 }
```

### 例2: 値の読み書き

```javascript
// シート取得
const sheet = getSheetByKey(SHEET_KEYS.DEVELOPMENT);
const cols = getColumnIndices(SHEET_KEYS.DEVELOPMENT, ['sourceUrl', 'sourceName', 'image1']);

// 値の読み取り
const sourceUrl = sheet.getRange(2, cols.sourceUrl).getValue();

// 値の書き込み
sheet.getRange(2, cols.sourceName).setValue('メルカリ');
sheet.getRange(2, cols.image1, 1, 12).setValues([imageUrls]);
```

### 例3: エラーハンドリング

```javascript
try {
  const sheet = getSheetByKey(SHEET_KEYS.DEVELOPMENT);
} catch (e) {
  ui.alert('エラー', `シートが見つかりません: ${e.message}`, ui.ButtonSet.OK);
  return;
}

const validation = validateRequiredColumns(SHEET_KEYS.DEVELOPMENT, ['sourceUrl', 'image1']);
if (!validation.valid) {
  ui.alert('エラー', `必須列が見つかりません:\n${validation.missingColumns.join('\n')}`, ui.ButtonSet.OK);
  return;
}
```

---

## 新しいシートや列を追加する方法

### ステップ1: Config.js に定義を追加

```javascript
const SHEET_CONFIG = {
  // 既存の設定...

  // 新規シートを追加
  inventory: {
    name: '在庫管理',
    columns: {
      sku: 'SKU',
      stock: '在庫数',
      warehouse: '倉庫',
      lastUpdate: '最終更新'
    }
  }
};

const SHEET_KEYS = {
  // 既存のキー...
  INVENTORY: 'inventory'  // 新しいキーを追加
};
```

### ステップ2: コードで使用

```javascript
// 在庫管理シートを取得
const inventorySheet = getSheetByKey(SHEET_KEYS.INVENTORY);

// 列マッピングを取得
const cols = getColumnIndices(SHEET_KEYS.INVENTORY, ['sku', 'stock', 'warehouse']);

// データを書き込み
inventorySheet.getRange(2, cols.sku).setValue('ABC123');
inventorySheet.getRange(2, cols.stock).setValue(50);
```

### ステップ3: clasp push

```bash
clasp push
```

完了！

---

## 列名を変更する場合

### ❌ 悪い例（複数ファイルを修正）

```javascript
// TestRunner.js
const sourceUrlCol = headers.indexOf('仕入元URL') + 1;

// コード.js
const sourceUrlCol = headers.indexOf('仕入元URL') + 1;

// ErrorHandler.js
// 仕入元URL列を参照...
```

シート上で「仕入元URL」を「商品URL」に変更した場合、**3ファイル**を修正する必要があります。

### ✅ 良い例（Config.jsのみ修正）

**Config.js:**
```javascript
const SHEET_CONFIG = {
  development: {
    columns: {
      sourceUrl: '商品URL',  // ここだけ変更
      // ...
    }
  }
};
```

**他のファイル（修正不要）:**
```javascript
// TestRunner.js
const cols = getColumnIndices(SHEET_KEYS.DEVELOPMENT, ['sourceUrl']);

// コード.js
const cols = getColumnIndices(SHEET_KEYS.DEVELOPMENT, ['sourceUrl']);
```

Config.jsを変更してclasp pushするだけで、すべてのコードが新しい列名に対応します。

---

## トラブルシューティング

### Q1: 「シートが見つかりません」エラー

**原因**: スプレッドシート上のシート名とConfig.jsの定義が一致していない。

**解決法**:
1. スプレッドシートを開き、シート名を確認
2. Config.jsの `SHEET_CONFIG.{key}.name` を修正
3. `clasp push`

### Q2: 「列設定が見つかりません」エラー

**原因**: コードで使用しているcolumnKeyがConfig.jsに定義されていない。

**解決法**:
```javascript
// エラー例
const cols = getColumnIndices(SHEET_KEYS.DEVELOPMENT, ['nonExistentKey']);

// Config.jsに追加
const SHEET_CONFIG = {
  development: {
    columns: {
      nonExistentKey: '新しい列名'  // 追加
    }
  }
};
```

### Q3: getColumnIndex が 0 を返す

**原因**: スプレッドシート上にその列が存在しない。

**解決法**:
1. スプレッドシートでヘッダー行を確認
2. Config.jsの列名定義と一致しているか確認
3. 一致していない場合、Config.jsを修正

```javascript
// 確認方法
const col = getColumnIndex(SHEET_KEYS.DEVELOPMENT, 'sourceUrl');
if (col === 0) {
  Logger.log('列が見つかりません');
  // Config.jsの 'sourceUrl' の値を確認
}
```

---

## ベストプラクティス

### 1. 複数列は `getColumnIndices()` で取得

**❌ 悪い例:**
```javascript
const sourceUrlCol = getColumnIndex(SHEET_KEYS.DEVELOPMENT, 'sourceUrl');
const sourceNameCol = getColumnIndex(SHEET_KEYS.DEVELOPMENT, 'sourceName');
const image1Col = getColumnIndex(SHEET_KEYS.DEVELOPMENT, 'image1');
// ヘッダー読み取りが3回発生
```

**✅ 良い例:**
```javascript
const cols = getColumnIndices(SHEET_KEYS.DEVELOPMENT, ['sourceUrl', 'sourceName', 'image1']);
// ヘッダー読み取りは1回だけ
```

### 2. 必須列は `validateRequiredColumns()` で検証

```javascript
const validation = validateRequiredColumns(SHEET_KEYS.DEVELOPMENT, ['sourceUrl', 'image1']);
if (!validation.valid) {
  ui.alert(`必須列が見つかりません: ${validation.missingColumns.join(', ')}`);
  return;
}
```

### 3. 列名・シート名は直接参照しない

**❌ 悪い例:**
```javascript
const sheet = ss.getSheetByName('開発用');
const sourceUrlCol = headers.indexOf('仕入元URL') + 1;
```

**✅ 良い例:**
```javascript
const sheet = getSheetByKey(SHEET_KEYS.DEVELOPMENT);
const cols = getColumnIndices(SHEET_KEYS.DEVELOPMENT, ['sourceUrl']);
```

### 4. Config.js のキー名は意味のある英語で

```javascript
// ❌ 悪い
const SHEET_KEYS = {
  S1: 'development',
  S2: 'errorLog'
};

// ✅ 良い
const SHEET_KEYS = {
  DEVELOPMENT: 'development',
  ERROR_LOG: 'errorLog'
};
```

---

## まとめ

Config.jsを使用することで:
- ✅ シート名・列名の一元管理
- ✅ 変更時の修正箇所が1ファイルのみ
- ✅ コードの可読性向上
- ✅ エラーの早期発見

**追加・修正は Config.js のみで完結します！**
