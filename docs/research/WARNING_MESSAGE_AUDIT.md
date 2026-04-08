# 警告・エラーメッセージ監査結果

## エビデンス確立日
2026-04-04

## 集計結果
- **ユーザー向けメッセージ総数**: 37種類
- **改善済み**: 4種類
- **改善推奨**: 8種類
- **問題なし**: 25種類

---

## 1. 改善済みメッセージ（✅ 完了）

### 1.1 ヘッダーが見つからないエラー
**ファイル**: Functions.gs:432-437
**改善前**:
```
⚠️ 警告: ヘッダー「仕入れキーワード」の列番号がnull/undefinedです（col=null）
```
**改善後**:
```
出品シートのヘッダー行（3行目）に「仕入れキーワード」という列名が見つかりませんでした。

出品シートを開いて、3行目に「仕入れキーワード」列があるか確認してください。
※列名の前後に余計なスペースやタブがないかも確認してください。
```

### 1.2 Item Specifics設定エラー
**ファイル**: Functions.gs:200
**改善前**:
```
⚠️ 色設定エラー[0]: 無効な列番号 colNum=null, colIndex=undefined
```
**改善後**:
```
Item Specificsの設定中にエラーが発生しました。
出品シートのItem Specifics列（項目名列）が正しく設定されているか確認してください。
```

### 1.3 画像列が見つからない警告
**ファイル**: Functions.gs:269, 899
**改善前**:
```
⚠️ 警告: ヘッダー「画像1」の列番号が取得できません（imageCol=null）
```
**改善後**:
```
⚠️ 警告: 出品シートのヘッダー行（3行目）に「画像1」列が見つかりません。この画像の保存をスキップします。
```

### 1.4 転記エラーアラート
**ファイル**: Functions.gs:961
**改善前**:
```
転記エラー:

[エラー内容]

予約した行はクリアされました。
```
**改善後**:
```
転記エラー:

[エラー内容]
```

---

## 2. 改善推奨メッセージ

### 2.1 カテゴリ取得エラー
**ファイル**: Functions.gs:52
**現状**:
```javascript
SpreadsheetApp.getUi().alert('カテゴリ取得エラー:\n\n' + error.toString());
```
**問題点**: `error.toString()`が技術的すぎる
**改善案**:
```javascript
SpreadsheetApp.getUi().alert(
  'eBay商品情報の取得に失敗しました。\n\n' +
  '以下を確認してください:\n' +
  '1. Item URLが正しいeBayのURLか\n' +
  '2. インターネット接続が正常か\n' +
  '3. eBay APIの設定が正しいか（ツール設定シート）'
);
```

### 2.2 担当者未入力エラー
**ファイル**: Functions.gs:115
**現状**: ✅ 既に改善済み（わかりやすい）
```javascript
SpreadsheetApp.getUi().alert('エラー: 担当者が入力されていません\n\nリサーチシートのB2セル（担当者）を入力してください。');
```

### 2.3 Item URL未入力エラー
**ファイル**: Functions.gs:126
**現状**:
```javascript
SpreadsheetApp.getUi().alert('Item URLが入力されていません（E7セル）');
```
**問題点**: セル番号が旧仕様（E7は古い位置）
**改善案**:
```javascript
SpreadsheetApp.getUi().alert('Item URLが入力されていません\n\nリサーチシートのItem URL欄を入力してください。');
```

### 2.4 初期設定エラー
**ファイル**: Setup.gs:116-117
**現状**:
```javascript
ui.alert(
  '初期設定エラー',
  '初期設定中にエラーが発生しました。\n\n' + error.toString(),
  ui.ButtonSet.OK
);
```
**問題点**: `error.toString()`が技術的
**改善案**:
```javascript
ui.alert(
  '初期設定エラー',
  '初期設定中にエラーが発生しました。\n\n' +
  '以下を確認してください:\n' +
  '1. ツール設定シートの必須項目が全て入力されているか\n' +
  '2. 出品シートのスプレッドシートIDが正しいか\n\n' +
  '詳細: ' + error.message,
  ui.ButtonSet.OK
);
```

### 2.5 eBay APIエラー
**ファイル**: EbayAPI.gs:105, 108
**現状**:
```javascript
throw new Error('eBay API エラー(' + statusCode + '): ' + errorMessage);
```
**問題点**: 技術的すぎる、ユーザーが対処方法を理解できない
**改善案**:
```javascript
let userMessage = 'eBay商品情報の取得に失敗しました。\n\n';
if (statusCode === 404) {
  userMessage += '指定された商品が見つかりません。Item URLを確認してください。';
} else if (statusCode === 401 || statusCode === 403) {
  userMessage += 'eBay APIの認証に失敗しました。\nツール設定シートのApp ID、Cert IDを確認してください。';
} else {
  userMessage += 'eBay APIでエラーが発生しました。\n時間をおいて再度お試しください。';
}
throw new Error(userMessage);
```

### 2.6 Fulfillment Policy取得失敗
**ファイル**: PolicyManager.gs:45
**現状**:
```javascript
throw new Error('Fulfillment Policy取得失敗(' + statusCode + '): ' + responseText);
```
**問題点**: 技術的すぎる
**改善案**:
```javascript
throw new Error(
  '発送ポリシーの取得に失敗しました。\n\n' +
  'eBay Seller Hubで発送ポリシーが正しく設定されているか確認してください。'
);
```

### 2.7 Return Policy取得失敗
**ファイル**: PolicyManager.gs:96
**現状**:
```javascript
throw new Error('Return Policy取得失敗(' + statusCode + '): ' + responseText);
```
**改善案**:
```javascript
throw new Error(
  '返品ポリシーの取得に失敗しました。\n\n' +
  'eBay Seller Hubで返品ポリシーが正しく設定されているか確認してください。'
);
```

### 2.8 Payment Policy取得失敗
**ファイル**: PolicyManager.gs:146
**現状**:
```javascript
throw new Error('Payment Policy取得失敗(' + statusCode + '): ' + responseText);
```
**改善案**:
```javascript
throw new Error(
  '支払いポリシーの取得に失敗しました。\n\n' +
  'eBay Seller Hubで支払いポリシーが正しく設定されているか確認してください。'
);
```

---

## 3. 問題なしメッセージ（現状維持でOK）

### 3.1 シートが見つからない系
- Functions.gs:16 「リサーチ」シートが見つかりません ✅
- Functions.gs:150 「ツール設定」シートの「出品シート」が設定されていません ✅
- Functions.gs:157 転記先に「出品シート」シートが見つかりません ✅
- AmazonSidebarCode.gs:31 リサーチシートが見つかりません ✅

### 3.2 URL・入力エラー系
- Functions.gs:23 URLが入力されていません ✅
- EbayAPI.gs:15 有効なURLを入力してください ✅
- Test.gs:1325 有効なAmazon URLを指定してください ✅

### 3.3 設定・権限エラー系
- Setup.gs:225 設定エラー:\n[エラー一覧] ✅
- Setup.gs:174-175 権限の承認中にエラーが発生しました ✅
- AmazonSidebarCode.gs:108 画像フォルダが設定されていません ✅

### 3.4 その他
- Setup.gs:38, 94, 158, 248, 291, 328, 350, 379, 410, 437 各種成功メッセージ ✅
- EbayAPI.gs:177 アイテムグループにバリエーションが見つかりませんでした ✅
- EbayAPI.gs:194 カテゴリ情報が見つかりません ✅

---

## 4. 推奨アクション

### 優先度：高
1. **カテゴリ取得エラー**（Functions.gs:52）- ユーザー頻出エラーの可能性
2. **eBay APIエラー**（EbayAPI.gs:105, 108）- ステータスコード別の対処方法提示

### 優先度：中
3. **初期設定エラー**（Setup.gs:116-117）- 初回セットアップ時のUX改善
4. **ポリシー取得エラー**（PolicyManager.gs:45, 96, 146）- わかりやすい表現に

### 優先度：低
5. **Item URL未入力エラー**（Functions.gs:126）- セル番号の古い記述を修正

---

## 5. HTML/フロントエンド系メッセージ（確認済み）

### AmazonSidebar.html
- alert('拡張機能IDを入力してください') ✅
- alert('❌ URL取得エラー: ' + err.message) ✅
- alert('❌ 拡張機能エラー: ' + chrome.runtime.lastError.message) ✅
- alert('❌ 画像抽出失敗: ' + (response ? response.error : '不明なエラー')) ✅
- alert('❌ GASエラー: ' + err.message) ✅

**判定**: HTML側のメッセージは開発者向けデバッグ用のため、現状維持でOK

---

## まとめ

- **改善済み**: 4種類（2026-04-04）
- **改善推奨**: 8種類（優先度付き）
- **問題なし**: 25種類

改善推奨の8種類について、優先度に応じて順次改善することを推奨します。
