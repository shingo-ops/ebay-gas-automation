# eBay出品更新時のEPS/Self Hosted画像混在エラー 調査レポート

**調査日**: 2026-04-30  
**対象リポジトリ**: `ebay-gas-automation` (bay-auto)  
**エラー発生箇所**: スプレッドシート 69行目、更新操作  
**ステータス**: 読み取り専用調査（コード変更なし）

---

## 1. 関連ファイルマップ

| ファイル | 役割 |
|---------|------|
| `gas/listing/standalone/ListingManager.gs` | メインロジック: 画像URL収集 (`extractImageUrls`)、シート読み取り (`readListingDataFromSheet`)、API呼び出し (`reviseFixedPriceItem`、`addItemWithTradingApi`)、EPS URL書き戻し (`writeEpsUrlsToSheet`) |
| `gas/listing/standalone/EbayAPI.gs` | Drive URL変換 (`convertDriveUrlForEbay`)、EPSアップロード (`uploadImageToEPS`、`uploadAllImagesToEPS`) |
| `gas/listing/standalone/Validation.gs` | バリデーション・エラー翻訳。**EPS/Self Hosted混在チェックなし** |
| `gas/listing/standalone/Config.gs` | eBay API認証情報などの設定管理 |

---

## 2. 画像URL処理フロー

### 新規出品 (AddFixedPriceItem)

```
readListingDataFromSheet()
  └─ extractImageUrls()
       ├─ 画像1〜23列: Drive URL → convertDriveUrlForEbay() → lh3.googleusercontent.com/d/{ID}
       └─ ストア画像列: Drive URL → convertDriveUrlForEbay()
            ↓
       [Self Hosted URL 配列]
            ↓
Phase1.5: uploadAllImagesToEPS()
  ├─ i.ebayimg.com URL → スキップ (そのまま)
  └─ それ以外 → uploadImageToEPS() → EPS URL に変換
            ↓
  [EPS URLのみの配列] → writeEpsUrlsToSheet() でシートに書き戻し
            ↓
addItemWithTradingApi(): PictureDetails XML に EPS URLを追加 → API送信
```

### 更新 (ReviseFixedPriceItem) ← **問題箇所**

```
readListingDataFromSheet()
  └─ extractImageUrls()
       ├─ 画像1〜23列: シートの値を convertDriveUrlForEbay()
       └─ ストア画像列: シートの値を convertDriveUrlForEbay()
            ↓
       [Self Hosted URL + ★EPS URL 混在の可能性]
            ↓
       ❌ uploadAllImagesToEPS() 呼び出しなし
            ↓
reviseFixedPriceItem(): PictureDetails XML に混在配列をそのまま追加 → API送信
→ "A mixture of Self Hosted and EPS pictures are not allowed."
```

---

## 3. API呼び出し詳細

### 使用API

| 操作 | API Call | 定義箇所 |
|------|----------|---------|
| 新規出品 | `AddFixedPriceItem` | ListingManager.gs line 1516 |
| 出品更新 | `ReviseFixedPriceItem` | ListingManager.gs line 1191 |
| 在庫0更新 | `ReviseFixedPriceItem` | ListingManager.gs line 1278 |
| 出品終了 | `EndFixedPriceItem` / `EndItem` | ListingManager.gs line 980, 1037 |

### PictureDetails XML構築 (reviseFixedPriceItem)

```javascript
// ListingManager.gs line 1132-1138
if (listingData.images && listingData.images.length > 0) {
  xmlBody += '<PictureDetails>';
  listingData.images.forEach(function(url) {
    xmlBody += '<PictureURL>' + escapeXml(url) + '</PictureURL>';
  });
  xmlBody += '</PictureDetails>';
}
```

`listingData.images` は `extractImageUrls()` の戻り値をそのまま使用。EPS変換なし。

### エラーハンドリング (reviseFixedPriceItem)

```javascript
// line 1250-1254
const errEl  = root.getChild('Errors', ns);
const errMsg = errEl
  ? (errEl.getChild('ShortMessage', ns) || { getText: function() { return responseText; } }).getText()
  : responseText;
throw new Error('APIエラー: ' + errMsg);
```

`<Errors>` の最初の1件のみ取得。`LongMessage` は取得しない（AddFixedPriceItem は複数エラー + LongMessage を取得するが、Revise は未対応）。

---

## 4. 混在発生の仮説 (可能性高い順)

### 仮説1 ★★★★★ — ReviseFixedPriceItem にEPS処理が存在しない

**根拠**:
- `addItemWithTradingApi()` は Phase1.5 で `uploadAllImagesToEPS()` を呼ぶ（line 2634-2651）
- `reviseFixedPriceItem()` は `uploadAllImagesToEPS()` を呼ばない
- `extractImageUrls()` は新規出品・更新で共通。ストア画像列に EPS URL が含まれていれば、そのまま配列に混入する

**発生シナリオ**:
1. 新規出品成功 → `writeEpsUrlsToSheet()` がストア画像列に `https://i.ebayimg.com/...` を書き戻す
2. シート状態: 画像1〜23 = `lh3.googleusercontent.com/...` (Self Hosted)、ストア画像 = `i.ebayimg.com/...` (EPS)
3. 更新操作 → `extractImageUrls()` で両方を配列に混入
4. EPS処理なしで送信 → **エラー**

### 仮説2 ★★★★☆ — ストア画像列にEPS URLが書き戻されている

**根拠** (`writeEpsUrlsToSheet()` line 2310-2349):
```javascript
// line 2326
imageColNames.push('ストア画像');
// ...
sheet.getRange(rowNumber, colNum).setValue(epsUrls[epsIndex]);  // EPS URLを書き戻し
```

`画像1〜23` + `ストア画像` の全列にEPS URLを書き戻す処理が存在する。  
→ 新規出品後のシートでは ストア画像列が `i.ebayimg.com/...` になっている可能性が高い。

### 仮説3 ★★★☆☆ — DB転記時にEPS URLが出品シートに混入

**根拠** (line 2163-2186):
```javascript
imageColNames.push('ストア画像');  // ストア画像列にもEPS URLを書き込む
safeSetValue(outputColMap[colName] + 1, epsImages[epsIndex], colName);
```

出品DB → 出品シートへのデータ転記時にも EPS URL がそのまま転記される可能性がある。

### 仮説4 ★★★☆☆ — ユーザーが手動でEPS URLを画像列に貼り付けた

**根拠**:
- `convertDriveUrlForEbay()` は `https://` で始まるURLはすべてそのまま返す
- `i.ebayimg.com` URLも `https://` で始まるため変換されずに配列に入る
- ユーザーが eBay管理画面からURLをコピーして貼り付けた場合に発生しうる

### 仮説5 ★★☆☆☆ — extractImageUrls の空欄スキップによりインデックスずれ

**根拠** (line 337-342):
```javascript
const url = getValueByHeader(rowData, headerMapping, imageHeader);
if (url && String(url).trim() !== '') {
  const convertedUrl = convertDriveUrlForEbay(String(url).trim()) || String(url).trim();
  urls.push(convertedUrl);
}
```

空欄の画像列はスキップするため、`epsUrls` のインデックスと画像列のインデックスがずれる可能性がある。  
→ `writeEpsUrlsToSheet()` が誤った列にEPS URLを書き戻す → 次回更新時に混在

---

## 5. 69行目の実際のURL

スプレッドシートにはローカルから直接アクセスできないため実際値は未確認。  
ただし仮説1・2のシナリオに基づいて以下が推定される:

```
画像1: https://lh3.googleusercontent.com/d/{DRIVE_FILE_ID}  ← Self Hosted
画像2: https://lh3.googleusercontent.com/d/{DRIVE_FILE_ID}  ← Self Hosted
...
ストア画像: https://i.ebayimg.com/00/s/{...}/$(KGrHq...)$(KGrHq...).JPG  ← EPS URL
```

`extractImageUrls()` が返す配列:
```
[
  "https://lh3.googleusercontent.com/...",  // Self Hosted
  "https://lh3.googleusercontent.com/...",  // Self Hosted
  "https://i.ebayimg.com/..."               // EPS ← 混在の原因
]
```

---

## 6. 既存バリデーションの状態

### 実装済み

| チェック内容 | 実装場所 |
|------------|---------|
| タイトル80文字 | Validation.gs |
| 状態説明・Description文字数 | Validation.gs |
| Item Specifics 65文字 | Validation.gs |
| UPC/EAN無効 | Validation.gs `translateEbayError()` |
| Shipping/Return/Payment Policy不一致 | Validation.gs `translateEbayError()` |
| Brand必須チェック | ListingManager.gs line 544-553 |

### 欠落

| 未実装チェック | 影響 |
|-------------|------|
| ❌ EPS/Self Hosted 混在チェック | 今回のエラーの直接原因 |
| ❌ `i.ebayimg.com` URLの検出 | 混在を事前に防げない |
| ❌ 更新時のEPSアップロード | ReviseFixedPriceItem の根本的な欠落 |
| ❌ `translateEbayError()` に混在パターンなし | エラーが英語のまま表示される |

---

## 7. 推奨される次アクション

### A【最優先】ReviseFixedPriceItem にEPS処理を追加

`reviseFixedPriceItem()` 内、`readListingDataFromSheet()` 呼び出し後に `uploadAllImagesToEPS()` を挿入する。

```
addItemWithTradingApi の Phase1.5 相当の処理を reviseFixedPriceItem にも追加:
  listingData.images = uploadAllImagesToEPS(listingData.images, token).epsUrls
```

### B【次優先】送信前の混在チェックをバリデーションに追加

`Validation.gs` の `validateListingData()` または送信直前に:

```javascript
function hasEpsMixing(images) {
  var hasEps = images.some(function(u) { return u.includes('i.ebayimg.com'); });
  var hasSelf = images.some(function(u) { return !u.includes('i.ebayimg.com'); });
  return hasEps && hasSelf;
}
```

混在していれば「ストア画像列を空にするか、画像列のURLを統一してください」を返す。

### C【対症療法】更新前にストア画像列をクリア

更新時はストア画像を送らない選択肢。ストア画像は新規出品時のみ使用するポリシーとする。  
`reviseFixedPriceItem()` 内で `extractImageUrls()` の前にストア画像を除外する。

### D【エラーメッセージ改善】translateEbayError() に混在パターンを追加

```javascript
{
  pattern: /mixture.*Self Hosted.*EPS|Self Hosted.*EPS.*not allowed/i,
  handler: function() {
    return 'EPS画像とSelf Hosted画像が混在しています\n' +
           '→ ストア画像列を空にするか、すべての画像列を同じ形式に統一してください';
  }
}
```

### E【根本対策】writeEpsUrlsToSheet() の書き戻し範囲を見直し

ストア画像列へのEPS URL書き戻しが混在の温床になっているため、  
書き戻し対象を `画像1〜23` のみに限定し、ストア画像列は書き戻さない設計に変更する。

---

## 付記: grep結果サマリー

| 検索パターン | 結果 |
|------------|------|
| `ebayimg.com` in standalone/ | `uploadAllImagesToEPS()` 内のスキップ条件のみ (EbayAPI.gs) |
| `UploadSiteHostedPictures` | EbayAPI.gs に `uploadImageToEPS()` として実装済み |
| `GetItem` | standalone/ 内では呼び出しなし |
| `既存.*画像` / `storeImage` / `ストア画像` | `extractImageUrls()` でストア画像列を末尾に追加 (ListingManager.gs) |
| `.images` push/concat | `extractImageUrls()` 内でのみ (他のソースとのマージなし) |
