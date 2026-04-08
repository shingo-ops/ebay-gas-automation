# 仕入元URLから画像自動取得機能 仕様書

**作成日**: 2026-03-10
**バージョン**: 1.0.0

---

## 結論：技術的には可能 ✅（ただし注意事項あり）

仕入元サイトのURLから商品画像を自動取得することは**技術的に実現可能**です。
ただし、法的・倫理的な制約を理解した上で実装する必要があります。

---

## 目次

1. [実装方法の比較](#実装方法の比較)
2. [推奨実装方法](#推奨実装方法)
3. [技術仕様](#技術仕様)
4. [注意事項と制約](#注意事項と制約)
5. [実装例](#実装例)
6. [よくある仕入元サイト別の対応](#よくある仕入元サイト別の対応)

---

## 実装方法の比較

### 方法1: HTMLスクレイピング（推奨）⭐

**概要**: ページのHTMLを取得して画像URLを抽出

**メリット**:
- シンプルな実装
- Google Apps Scriptで完結
- 外部サービス不要

**デメリット**:
- 静的HTMLのみ対応（JavaScript動的生成は困難）
- サイト構造変更に弱い
- robots.txt、利用規約の確認必要

**実現可能性**: ⭐⭐⭐⭐⭐

**推奨度**: ⭐⭐⭐⭐☆

---

### 方法2: 画像ダウンロード → Google Drive → eBay

**概要**: 画像をダウンロードしてDriveに保存、URLを使用

**メリット**:
- 画像の永続的な保存
- 仕入元サイトの画像削除に影響されない
- 画像の編集・加工が可能
- eBay Media APIで正式にアップロード可能

**デメリット**:
- Driveストレージを消費
- 処理時間が長い
- 著作権の明確な許諾が必要

**実現可能性**: ⭐⭐⭐⭐⭐

**推奨度**: ⭐⭐⭐⭐⭐

---

### 方法3: 外部URLを直接使用

**概要**: 仕入元の画像URLをそのまま使用

**メリット**:
- 最もシンプル
- 処理不要

**デメリット**:
- 画像が削除される可能性
- eBayのポリシー違反の可能性
- リンク切れのリスク

**実現可能性**: ⭐⭐☆☆☆

**推奨度**: ⭐☆☆☆☆（非推奨）

---

### 方法4: API経由（仕入元がAPI提供している場合）

**概要**: 仕入元サイトの公式APIを使用

**メリット**:
- 公式な方法
- 安定性が高い
- 利用規約に準拠

**デメリット**:
- APIを提供しているサイトが限定的
- API利用申請が必要な場合がある

**実現可能性**: ⭐⭐⭐☆☆（サイト依存）

**推奨度**: ⭐⭐⭐⭐⭐（API提供時）

---

## 推奨実装方法

### ベストプラクティス：方法2（画像ダウンロード → Drive → eBay Media API）

```
仕入元URL入力
  ↓
① HTMLスクレイピングで画像URL抽出
  ↓
② 画像をダウンロード（UrlFetchApp.fetch）
  ↓
③ Google Driveにアップロード
  ↓
④ eBay Media APIで画像アップロード
  ↓
⑤ eBay画像URLを取得
  ↓
⑥ 出品データに使用
```

**理由**:
- 仕入元サイトの変更に強い（一度保存すれば永続）
- eBayの公式方法に準拠
- 画像の品質管理が可能
- バックアップとして機能

---

## 技術仕様

### 1. HTMLスクレイピングによる画像URL抽出

#### 実装コード（基本版）

```javascript
/**
 * URLから商品画像URLを抽出
 *
 * @param {string} productUrl - 商品ページURL
 * @returns {Array<string>} 画像URLの配列
 */
function extractImageUrlsFromPage(productUrl) {
  try {
    // HTTPリクエスト
    const response = UrlFetchApp.fetch(productUrl, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      throw new Error(`HTTPエラー: ${statusCode}`);
    }

    const html = response.getContentText();
    const imageUrls = [];

    // 方法1: <img>タグから抽出
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const url = match[1];

      // 絶対URLに変換
      const absoluteUrl = convertToAbsoluteUrl(url, productUrl);

      // 商品画像っぽいURLのみフィルタリング
      if (isProductImage(absoluteUrl)) {
        imageUrls.push(absoluteUrl);
      }
    }

    // 方法2: og:imageメタタグから抽出（OGP）
    const ogImageRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
    const ogMatch = html.match(ogImageRegex);
    if (ogMatch) {
      imageUrls.unshift(ogMatch[1]);  // メイン画像として先頭に追加
    }

    // 重複削除
    const uniqueUrls = [...new Set(imageUrls)];

    Logger.log(`画像URL抽出成功: ${uniqueUrls.length}件`);
    return uniqueUrls;

  } catch (error) {
    Logger.log(`画像URL抽出エラー: ${error.toString()}`);
    throw error;
  }
}

/**
 * 相対URLを絶対URLに変換
 */
function convertToAbsoluteUrl(url, baseUrl) {
  // すでに絶対URLの場合
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // プロトコル相対URL (//example.com/image.jpg)
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  // ベースURLから基準を取得
  const base = new URL(baseUrl);

  // ルート相対URL (/images/product.jpg)
  if (url.startsWith('/')) {
    return base.protocol + '//' + base.host + url;
  }

  // 相対URL (images/product.jpg)
  const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/'));
  return base.protocol + '//' + base.host + basePath + '/' + url;
}

/**
 * 商品画像かどうか判定
 */
function isProductImage(url) {
  // サムネイルや小さい画像を除外
  if (url.includes('thumb') || url.includes('icon') || url.includes('logo')) {
    return false;
  }

  // 画像拡張子チェック
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasImageExtension = imageExtensions.some(ext =>
    url.toLowerCase().includes(ext)
  );

  return hasImageExtension;
}
```

#### 実装コード（サイト別カスタマイズ版）

```javascript
/**
 * サイト別の画像抽出ロジック
 */
function extractImagesByDomain(productUrl) {
  const url = new URL(productUrl);
  const domain = url.hostname;

  // ドメイン別の処理
  if (domain.includes('yahoo.co.jp') || domain.includes('shopping.yahoo.co.jp')) {
    return extractImagesFromYahooShopping(productUrl);
  } else if (domain.includes('rakuten.co.jp')) {
    return extractImagesFromRakuten(productUrl);
  } else if (domain.includes('amazon.co.jp')) {
    return extractImagesFromAmazon(productUrl);
  } else if (domain.includes('mercari.com')) {
    return extractImagesFromMercari(productUrl);
  } else {
    // 汎用処理
    return extractImageUrlsFromPage(productUrl);
  }
}

/**
 * Yahoo!ショッピング専用
 */
function extractImagesFromYahooShopping(productUrl) {
  const html = UrlFetchApp.fetch(productUrl).getContentText();
  const imageUrls = [];

  // Yahoo!ショッピングの画像はJSON-LD形式で埋め込まれている場合が多い
  const jsonLdRegex = /<script type="application\/ld\+json">(.+?)<\/script>/gs;
  const matches = html.match(jsonLdRegex);

  if (matches) {
    matches.forEach(scriptTag => {
      try {
        const jsonContent = scriptTag.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const data = JSON.parse(jsonContent);

        if (data.image) {
          if (Array.isArray(data.image)) {
            imageUrls.push(...data.image);
          } else {
            imageUrls.push(data.image);
          }
        }
      } catch (e) {
        // JSON解析エラーは無視
      }
    });
  }

  // 通常のimgタグからも抽出
  const imgUrls = extractImageUrlsFromPage(productUrl);
  imageUrls.push(...imgUrls);

  return [...new Set(imageUrls)];
}

/**
 * 楽天市場専用
 */
function extractImagesFromRakuten(productUrl) {
  const html = UrlFetchApp.fetch(productUrl).getContentText();
  const imageUrls = [];

  // 楽天の高解像度画像URLパターン
  // 例: https://image.rakuten.co.jp/xxx/cabinet/xxx.jpg
  const rakutenImageRegex = /https?:\/\/image\.rakuten\.co\.jp\/[^"'\s]+\.(jpg|jpeg|png|gif)/gi;
  let match;
  while ((match = rakutenImageRegex.exec(html)) !== null) {
    imageUrls.push(match[0]);
  }

  return [...new Set(imageUrls)];
}

/**
 * Amazon専用
 */
function extractImagesFromAmazon(productUrl) {
  const html = UrlFetchApp.fetch(productUrl).getContentText();
  const imageUrls = [];

  // AmazonのJSON形式の画像データを抽出
  const imageDataRegex = /"hiRes":"([^"]+)"/g;
  let match;
  while ((match = imageDataRegex.exec(html)) !== null) {
    imageUrls.push(match[1]);
  }

  // 汎用抽出も実行
  const genericUrls = extractImageUrlsFromPage(productUrl);
  imageUrls.push(...genericUrls);

  return [...new Set(imageUrls)];
}

/**
 * メルカリ専用
 */
function extractImagesFromMercari(productUrl) {
  const html = UrlFetchApp.fetch(productUrl).getContentText();
  const imageUrls = [];

  // メルカリの画像URLパターン
  // 例: https://static.mercdn.net/item/detail/orig/photos/xxx.jpg
  const mercariImageRegex = /https?:\/\/static\.mercdn\.net\/item\/detail\/orig\/photos\/[^"'\s]+\.(jpg|jpeg|png)/gi;
  let match;
  while ((match = mercariImageRegex.exec(html)) !== null) {
    imageUrls.push(match[0]);
  }

  return [...new Set(imageUrls)];
}
```

### 2. 画像のダウンロードとGoogle Driveへの保存

```javascript
/**
 * 画像をダウンロードしてGoogle Driveに保存
 *
 * @param {string} imageUrl - 画像URL
 * @param {string} fileName - ファイル名
 * @param {string} folderId - DriveフォルダID（オプション）
 * @returns {Object} Driveファイル情報
 */
function downloadImageToDrive(imageUrl, fileName, folderId) {
  try {
    // 画像をダウンロード
    const response = UrlFetchApp.fetch(imageUrl, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('画像のダウンロードに失敗しました');
    }

    const blob = response.getBlob();

    // ファイル名を設定（拡張子を保持）
    const extension = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const fullFileName = fileName + (extension ? extension[0] : '.jpg');
    blob.setName(fullFileName);

    // Driveに保存
    let folder;
    if (folderId) {
      folder = DriveApp.getFolderById(folderId);
    } else {
      // デフォルトフォルダ作成
      folder = getOrCreateFolder('eBay商品画像');
    }

    const file = folder.createFile(blob);

    // 公開設定（eBayからアクセス可能にする）
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    Logger.log('画像を保存しました: ' + file.getName());

    return {
      fileId: file.getId(),
      url: file.getUrl(),
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
      name: file.getName()
    };

  } catch (error) {
    Logger.log('画像保存エラー: ' + error.toString());
    throw error;
  }
}

/**
 * フォルダを取得または作成
 */
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}
```

### 3. eBay Media APIへのアップロード（オプション）

```javascript
/**
 * eBay Media APIに画像をアップロード
 *
 * @param {Blob} imageBlob - 画像Blob
 * @param {string} fileName - ファイル名
 * @returns {string} eBay画像URL
 */
function uploadImageToEbayMedia(imageBlob, fileName) {
  try {
    // Media APIエンドポイント
    const endpoint = '/sell/media/v1/image';

    const token = getAccessToken();
    if (!token) {
      throw new Error('認証トークンがありません');
    }

    const baseUrl = getBaseUrl();
    const url = baseUrl + endpoint;

    // マルチパートフォームデータの作成
    const boundary = '----WebKitFormBoundary' + Utilities.getUuid();

    const payload = Utilities.newBlob(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="image"; filename="' + fileName + '"\r\n' +
      'Content-Type: ' + imageBlob.getContentType() + '\r\n\r\n'
    ).getBytes()
    .concat(imageBlob.getBytes())
    .concat(Utilities.newBlob('\r\n--' + boundary + '--\r\n').getBytes());

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 201) {
      const data = JSON.parse(response.getContentText());
      Logger.log('eBayに画像をアップロードしました: ' + data.imageUrl);
      return data.imageUrl;
    } else {
      throw new Error('eBay Media API エラー: ' + response.getContentText());
    }

  } catch (error) {
    Logger.log('eBay画像アップロードエラー: ' + error.toString());
    throw error;
  }
}
```

### 4. 統合処理（URLから出品まで）

```javascript
/**
 * 仕入元URLから画像を取得してeBay用に準備
 *
 * @param {string} sourceUrl - 仕入元商品URL
 * @param {string} sku - SKU
 * @returns {Array<string>} eBayで使用可能な画像URLの配列
 */
function prepareImagesFromSourceUrl(sourceUrl, sku) {
  try {
    Logger.log('画像取得開始: ' + sourceUrl);

    // 1. 画像URLを抽出
    const imageUrls = extractImagesByDomain(sourceUrl);

    if (imageUrls.length === 0) {
      throw new Error('画像が見つかりませんでした');
    }

    Logger.log('画像URL抽出成功: ' + imageUrls.length + '件');

    // 2. 最大24枚に制限
    const limitedUrls = imageUrls.slice(0, 24);

    // 3. 各画像をDriveに保存
    const ebayImageUrls = [];

    limitedUrls.forEach((imageUrl, index) => {
      try {
        const fileName = `${sku}_${index + 1}`;
        const driveFile = downloadImageToDrive(imageUrl, fileName);

        // Driveの公開URLを使用
        // または、eBay Media APIにアップロード
        ebayImageUrls.push(driveFile.downloadUrl);

        // レート制限対策
        Utilities.sleep(500);

      } catch (error) {
        Logger.log(`画像${index + 1}の処理エラー: ${error.message}`);
        // エラーでも継続
      }
    });

    Logger.log('画像準備完了: ' + ebayImageUrls.length + '件');
    return ebayImageUrls;

  } catch (error) {
    Logger.log('画像準備エラー: ' + error.toString());
    throw error;
  }
}
```

---

## 注意事項と制約

### 法的・倫理的な注意事項 ⚠️

#### 1. 著作権
- **画像の著作権は仕入元または製造元に帰属**
- 商品を仕入れる正規の取引関係がある場合は、通常、商品画像の使用は許可される
- **使用許諾の明確化が重要**

#### 2. 利用規約
各サイトの利用規約を確認：
- スクレイピングが禁止されていないか
- 商用利用が許可されているか
- robots.txtの確認

#### 3. robots.txt の確認

```javascript
/**
 * robots.txtをチェック
 */
function checkRobotsTxt(url) {
  const urlObj = new URL(url);
  const robotsUrl = urlObj.protocol + '//' + urlObj.host + '/robots.txt';

  try {
    const response = UrlFetchApp.fetch(robotsUrl, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const robotsTxt = response.getContentText();
      Logger.log('robots.txt:\n' + robotsTxt);

      // User-agent: * のDisallowをチェック
      if (robotsTxt.includes('Disallow: /')) {
        Logger.log('警告: スクレイピングが制限されている可能性があります');
        return false;
      }
    }

    return true;
  } catch (error) {
    Logger.log('robots.txt確認エラー: ' + error.message);
    return true;  // エラーの場合は続行
  }
}
```

#### 4. 推奨事項

✅ **推奨**:
- 正規の仕入先との契約で画像使用許諾を明記
- 製造元の公式画像を使用
- 自社で撮影した商品画像を使用

⚠️ **注意**:
- アクセス頻度を制限（レート制限）
- User-Agentの設定
- エラー時の適切な処理

❌ **禁止**:
- 競合他社の画像の無断使用
- 利用規約で禁止されているスクレイピング
- 過度なアクセスによるサーバー負荷

---

### 技術的な制約

#### 1. JavaScript動的生成への対応

多くの現代的なサイトは、JavaScriptで画像を動的に読み込みます。
Google Apps Scriptでは、JavaScriptの実行環境がないため、これらのサイトには対応困難です。

**対処方法**:
- Puppeteerなどの外部サービスを使用（高度）
- 手動で画像URLを取得
- API提供サイトを優先

#### 2. サイト構造の変更

サイトのHTMLデザインが変更されると、抽出ロジックが動作しなくなる可能性があります。

**対処方法**:
- 複数の抽出方法を併用（imgタグ、OGP、JSON-LDなど）
- 定期的なメンテナンス
- エラー通知機能の実装

#### 3. 画像形式

WebP形式など、eBayで対応していない画像形式がある場合があります。

**対処方法**:
- 対応形式に変換（JPG、PNGなど）
- Google Apps Scriptでは画像変換が困難なため、外部サービス利用

---

## 実装例

### スプレッドシートへの統合

```javascript
/**
 * スプレッドシートから仕入元URLを読み取り、画像を自動取得
 */
function autoFetchImagesFromSheet() {
  const sheet = getOrCreateSheet('出品管理');
  const data = readDataFromSheet('出品管理', { startRow: 2 });

  data.forEach((row, index) => {
    const sku = row[0];             // A列: SKU
    const sourceUrl = row[26];      // AA列: 仕入元URL（新規追加）
    const hasImages = row[11];      // L列: 画像URL1

    // 仕入元URLがあり、まだ画像が取得されていない場合
    if (sourceUrl && !hasImages) {
      try {
        Logger.log(`画像自動取得: ${sku}`);

        // 画像URL取得
        const imageUrls = prepareImagesFromSourceUrl(sourceUrl, sku);

        // スプレッドシートに書き込み
        const rowNumber = index + 2;  // ヘッダー行を考慮

        imageUrls.forEach((url, imgIndex) => {
          const col = 12 + imgIndex;  // L列から開始（画像URL1〜24）
          sheet.getRange(rowNumber, col).setValue(url);
        });

        Logger.log(`画像取得成功: ${imageUrls.length}件`);

        // レート制限
        Utilities.sleep(2000);

      } catch (error) {
        Logger.log(`画像取得エラー (${sku}): ${error.message}`);
        logToSheet('ERROR', '画像自動取得エラー', `SKU: ${sku}, ${error.message}`);
      }
    }
  });

  SpreadsheetApp.getUi().alert('画像の自動取得が完了しました');
}
```

---

## よくある仕入元サイト別の対応

### 対応可否マトリクス

| 仕入元サイト | 対応難易度 | 推奨方法 | 備考 |
|------------|-----------|---------|------|
| Yahoo!ショッピング | ⭐⭐⭐⭐ | スクレイピング | JSON-LD対応 |
| 楽天市場 | ⭐⭐⭐⭐ | スクレイピング | 高解像度画像URL |
| Amazon | ⭐⭐⭐ | スクレイピング | 動的生成多い |
| メルカリ | ⭐⭐⭐⭐ | スクレイピング | 静的URL |
| AliExpress | ⭐⭐ | API（要申請） | スクレイピング困難 |
| 自社ECサイト | ⭐⭐⭐⭐⭐ | 直接制御可能 | - |

### サイト別のポイント

#### Yahoo!ショッピング
- JSON-LD形式で構造化データあり
- OGP（Open Graph Protocol）タグ使用
- 比較的安定

#### 楽天市場
- 画像URLが`image.rakuten.co.jp`ドメイン
- 高解像度画像が取得可能
- URL構造が一貫

#### Amazon
- 動的JavaScriptで画像読み込み
- JSON形式のデータが埋め込まれている
- `hiRes`フィールドに高解像度画像

#### メルカリ
- 静的な画像URL
- `static.mercdn.net`ドメイン
- シンプルな構造

---

## まとめ

### 実現可能性

✅ **技術的には完全に実現可能**

### 推奨実装

1. **HTMLスクレイピング**で画像URLを抽出
2. **Google Drive**に画像を保存
3. DriveのURLを**eBay出品**に使用
4. または**eBay Media API**に正式アップロード

### 重要な前提条件

⚠️ 以下を確認してから実装：
1. 仕入元との契約で画像使用許諾を確認
2. 各サイトの利用規約を確認
3. robots.txtを確認
4. 著作権・知的財産権を尊重

### 次のステップ

1. 画像取得機能の実装（`ImageExtractor.gs`）
2. サイト別抽出ロジックの実装
3. エラーハンドリングの強化
4. スプレッドシートUIの追加（仕入元URL列）

---

**免責事項**:
この仕様書は技術的な実現可能性を示すものであり、法的助言ではありません。
実装前に必ず法務担当者または弁護士に相談し、関連する法律・規約を遵守してください。
