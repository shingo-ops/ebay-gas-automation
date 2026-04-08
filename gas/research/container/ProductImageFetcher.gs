/**
 * 商品ページから画像を取得するモジュール
 * メルカリ、ヤフオク等の商品ページURLから画像URLを抽出してダウンロード
 */

/**
 * 商品ページURLから画像URLを抽出して配列で返す
 *
 * @param {string} productPageUrl 商品ページURL
 * @returns {Array<string>} 画像URLの配列（最大20件）
 */
function extractImageUrlsFromProductPage(productPageUrl) {
  try {
    if (!productPageUrl || productPageUrl.toString().trim() === '') {
      Logger.log('商品ページURLが空です');
      return [];
    }

    const url = productPageUrl.toString();
    Logger.log('商品ページURL: ' + url);

    // メルカリ
    if (url.includes('mercari.com')) {
      Logger.log('📦 メルカリURL検出');
      return extractMercariImageUrls(url);
    }

    // ラクマ（Fril）
    if (url.includes('fril.jp')) {
      Logger.log('🛍️ ラクマURL検出');
      return extractRakumaImageUrls(url);
    }

    // ヤフオク
    if (url.includes('yahoo.co.jp') && url.includes('auction')) {
      Logger.log('🔨 ヤフオクURL検出');
      return extractYahooAuctionImageUrls(url);
    }

    // Yahoo!フリマ（PayPayフリマ）
    if (url.includes('paypayfleamarket.yahoo.co.jp')) {
      Logger.log('🛍️ Yahoo!フリマURL検出');
      return extractYahooFleaMarketImageUrls(url);
    }

    // Yahoo!ショッピング
    if (url.includes('shopping.yahoo.co.jp')) {
      Logger.log('🛒 Yahoo!ショッピングURL検出');
      return extractYahooShoppingImageUrls(url);
    }

    // 楽天市場
    if (url.includes('item.rakuten.co.jp')) {
      Logger.log('🛒 楽天市場URL検出');
      return extractRakutenImageUrls(url);
    }

    // オフモール（ハードオフ・オフハウス等）
    if (url.includes('netmall.hardoff.co.jp')) {
      Logger.log('🏪 オフモールURL検出');
      return extractOffmallImageUrls(url);
    }

    // 駿河屋
    if (url.includes('suruga-ya.jp')) {
      Logger.log('🎮 駿河屋URL検出');
      return extractSurugayaImageUrls(url);
    }

    // デジマート
    if (url.includes('digimart.net')) {
      Logger.log('🎸 デジマートURL検出');
      return extractDigimartImageUrls(url);
    }

    // スーパーデリバリー
    if (url.includes('superdelivery.com')) {
      Logger.log('📦 スーパーデリバリーURL検出');
      return extractSuperdeliveryImageUrls(url);
    }

    // NETSEA（ネッシー）
    if (url.includes('netsea.jp')) {
      Logger.log('🏪 NETSEA URL検出');
      return extractNetseaImageUrls(url);
    }

    // Amazon（非推奨：Bot判定により動作しません）
    if (url.includes('amazon.co.jp') || url.includes('amazon.com')) {
      Logger.log('📦 Amazon URL検出');
      Logger.log('⚠️ 【重要】Amazon画像の自動取得は非推奨です');
      Logger.log('⚠️ Amazon側のBot判定により、GASから直接アクセスすることができません');
      Logger.log('⚠️ ブックマークレット方式を使用してください（AMAZON_BOOKMARKLET_GUIDE.md参照）');
      return extractAmazonImageUrls(url);
    }

    // その他（eBay等）
    Logger.log('⚠️ 未対応のURL: ' + url);
    return [];

  } catch (error) {
    Logger.log('extractImageUrlsFromProductPageエラー: ' + error.toString());
    return [];
  }
}

/**
 * メルカリ商品ページから画像URLを抽出
 *
 * @param {string} productPageUrl メルカリ商品URL
 * @returns {Array<string>} 画像URLの配列
 */
function extractMercariImageUrls(productPageUrl) {
  try {
    // アイテムIDを抽出（例: https://jp.mercari.com/item/m62268499556 → m62268499556）
    const itemIdMatch = productPageUrl.match(/\/item\/(m\d+)/);
    if (!itemIdMatch) {
      Logger.log('メルカリの商品IDを抽出できませんでした');
      return [];
    }
    const itemId = itemIdMatch[1];
    Logger.log('📦 商品ID: ' + itemId);

    // 画像URLの存在確認
    const baseUrl = 'https://static.mercdn.net/item/detail/orig/photos/' + itemId + '_';
    const imageUrls = [];
    const MAX_IMAGES = 20;

    Logger.log('🔍 画像の存在確認を開始...');

    for (let i = 1; i <= MAX_IMAGES; i++) {
      const url = baseUrl + i + '.jpg';

      try {
        const response = UrlFetchApp.fetch(url, {
          muteHttpExceptions: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': productPageUrl,
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'ja,en;q=0.9'
          }
        });

        const statusCode = response.getResponseCode();

        if (statusCode === 200) {
          imageUrls.push(url);
          Logger.log('  ✓ 画像' + i + ': 存在確認OK');
        } else if (statusCode === 404 || statusCode === 403) {
          Logger.log('  ✗ 画像' + i + ': 終端検出 (' + statusCode + ')');
          break;
        } else if (statusCode === 429) {
          Logger.log('  ⚠ リクエスト過多 (429) - 処理を中断');
          break;
        } else {
          Logger.log('  ? 画像' + i + ': 予期しないステータス (' + statusCode + ')');
          break;
        }

      } catch (e) {
        Logger.log('  ✗ 画像' + i + ': 通信エラー - ' + e.message);
        break;
      }

      // レート制限対策
      Utilities.sleep(300 + Math.floor(Math.random() * 400));
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出');
    return imageUrls.slice(0, 20); // 最大20枚

  } catch (error) {
    Logger.log('extractMercariImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * ヤフオク商品ページから画像URLを抽出
 *
 * @param {string} productPageUrl ヤフオク商品URL
 * @returns {Array<string>} 画像URLの配列
 */
function extractYahooAuctionImageUrls(productPageUrl) {
  try {
    // オークションIDを抽出
    const itemIdMatch = productPageUrl.match(/auction\/([a-zA-Z0-9]+)/);
    if (!itemIdMatch) {
      Logger.log('ヤフオクの商品IDを抽出できませんでした');
      return [];
    }
    const itemId = itemIdMatch[1];
    Logger.log('🔨 商品ID: ' + itemId);

    // HTMLを取得
    Logger.log('🔍 商品ページHTMLを取得中...');
    const response = UrlFetchApp.fetch(productPageUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9'
      }
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('HTTP ' + response.getResponseCode() + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText();
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // 商品画像URL抽出（auctions.c.yimg.jp のみ対象）
    // exec()ループでHTML出現順を保証
    const imagePattern = /https:\/\/auctions\.c\.yimg\.jp\/images\.auctions\.yahoo\.co\.jp\/image\/[^"'\s<>]+\.jpg/g;
    const seen = new Set();
    const imageUrls = [];
    let match;

    while ((match = imagePattern.exec(html)) !== null) {
      const url = match[0];
      if (!seen.has(url)) {
        seen.add(url);
        imageUrls.push(url);
        Logger.log('  ✓ 画像' + imageUrls.length + ': ' + url);
      }
      if (imageUrls.length >= 20) break;
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像URLを検出（表示順）');
    return imageUrls;

  } catch (error) {
    Logger.log('extractYahooAuctionImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * Yahoo!フリマ（PayPayフリマ）商品ページから画像URLを抽出
 *
 * @param {string} productPageUrl Yahoo!フリマ商品URL (例: https://paypayfleamarket.yahoo.co.jp/item/z582778536)
 * @returns {Array<string>} 画像URLの配列
 */
function extractYahooFleaMarketImageUrls(productPageUrl) {
  try {
    Logger.log('🛍️ Yahoo!フリマ商品ページから画像を抽出中...');

    // HTMLを取得
    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // auctions.c.yimg.jp ドメインの画像URLを抽出（Yahoo!フリマはヤフオクと同じCDNを使用）
    // src="..." または data-src="..." から抽出
    const pattern = /(?:src|data-src)="(https:\/\/auctions\.c\.yimg\.jp[^"]+\.(jpg|jpeg|png|webp))"/g;
    const seen = new Set();
    const imageUrls = [];
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const imageUrl = match[1];
      if (!seen.has(imageUrl)) {
        seen.add(imageUrl);
        imageUrls.push(imageUrl);
        Logger.log('  ✓ 画像' + imageUrls.length + ': ' + imageUrl);
      }
      if (imageUrls.length >= 20) break;
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出');
    return imageUrls.slice(0, 20); // 最大20枚

  } catch (error) {
    Logger.log('extractYahooFleaMarketImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * Yahoo!ショッピング商品ページから画像URLを抽出
 *
 * @param {string} productPageUrl Yahoo!ショッピング商品URL
 * @returns {Array<string>} 画像URLの配列
 */
function extractYahooShoppingImageUrls(productPageUrl) {
  try {
    Logger.log('🛒 Yahoo!ショッピング商品ページから画像を抽出中...');

    // HTMLを取得
    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // __NEXT_DATA__ タグ内のJSONを抽出（Next.js SSR）
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      Logger.log('⚠️ __NEXT_DATA__ が見つかりませんでした');
      Logger.log('Yahoo!ショッピングのページ構造が変更された可能性があります');
      return [];
    }

    try {
      const nextData = JSON.parse(match[1]);
      Logger.log('✓ __NEXT_DATA__ JSON解析成功');

      // 画像リストを取得
      const displayList = nextData.props.pageProps.item.images.displayItemImageList;

      if (!displayList || displayList.length === 0) {
        Logger.log('⚠️ 画像リストが空です');
        return [];
      }

      Logger.log('画像リスト取得: ' + displayList.length + '件');

      // 高解像度URL（/i/n/ → /i/g/）に変換
      const imageUrls = [];
      for (let i = 0; i < displayList.length; i++) {
        const img = displayList[i];
        if (img && img.src) {
          // 通常サイズ (/i/n/) を高解像度 (/i/g/) に変換
          const highResUrl = img.src.replace('/i/n/', '/i/g/');
          imageUrls.push(highResUrl);
          Logger.log('  ✓ 画像' + (i + 1) + ': ' + highResUrl);
        }
      }

      Logger.log('✅ ' + imageUrls.length + '枚の画像を検出（高解像度版）');
      return imageUrls.slice(0, 20); // 最大20枚

    } catch (jsonError) {
      Logger.log('⚠️ JSON解析エラー: ' + jsonError.toString());
      return [];
    }

  } catch (error) {
    Logger.log('extractYahooShoppingImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * 楽天市場商品ページから画像URLをサイト表示順に抽出
 *
 * @param {string} productPageUrl 楽天市場商品URL
 * @returns {Array<string>} 画像URLの配列（サイト表示順）
 */
function extractRakutenImageUrls(productPageUrl) {
  try {
    Logger.log('🛒 楽天市場商品ページから画像を抽出中...');

    // HTMLを取得
    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    const imageUrls = [];
    const seen = new Set();

    // ① img-box内の画像を順番通りに抽出（サイト表示順を保証）
    // 例: <div class="img-box"> <img src="https://image.rakuten.co.jp/..." alt="商品画像1">
    //     <div class="img-box"> <a...> <img src="https://image.rakuten.co.jp/..." alt="商品画像2">
    const imgBoxPattern = /<div class="img-box">\s*(?:<a[^>]*>)?\s*<img src="(https:\/\/image\.rakuten\.co\.jp[^"]+)"/g;

    let match;
    while ((match = imgBoxPattern.exec(html)) !== null) {
      const url = match[1];
      if (!seen.has(url)) {
        seen.add(url);
        imageUrls.push(url);
        Logger.log('  ✓ 画像' + imageUrls.length + ': ' + url);
      }
    }

    Logger.log('✓ img-box内の画像: ' + imageUrls.length + '枚（表示順）');

    // ② img-boxが見つからない場合のフォールバック: og:image
    if (imageUrls.length === 0) {
      Logger.log('⚠️ img-box内の画像が見つかりません。og:imageを使用します。');
      const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/);
      if (ogImageMatch) {
        imageUrls.push(ogImageMatch[1]);
        Logger.log('✓ og:image取得: ' + ogImageMatch[1]);
      }
    }

    if (imageUrls.length === 0) {
      Logger.log('❌ 画像URLが見つかりませんでした');
      return [];
    }

    Logger.log('');
    Logger.log('--- 画像URL一覧（サイト表示順） ---');
    for (let i = 0; i < Math.min(imageUrls.length, 10); i++) {
      Logger.log('  ' + (i + 1) + '. ' + imageUrls[i]);
    }
    if (imageUrls.length > 10) {
      Logger.log('  ... 他 ' + (imageUrls.length - 10) + '件');
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出（表示順保証）');
    return imageUrls.slice(0, 20); // 最大20枚

  } catch (error) {
    Logger.log('extractRakutenImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * Amazon商品ページから画像URLを抽出
 *
 * @deprecated この関数は非推奨です。AmazonのBot判定により、GASから直接アクセスできません。
 *             代わりにブックマークレット方式（AMAZON_BOOKMARKLET_GUIDE.md）を使用してください。
 *
 * @param {string} productPageUrl Amazon商品URL
 * @returns {Array<string>} 画像URLの配列（Bot判定により空配列を返す可能性が高い）
 */
function extractAmazonImageUrls(productPageUrl) {
  try {
    Logger.log('📦 Amazon商品ページから画像を抽出中...');
    Logger.log('⚠️ 【非推奨機能】この関数は正常に動作しない可能性が高いです');
    Logger.log('⚠️ AmazonのBot判定により、GASから直接HTMLを取得できません（6KBのブロックページのみ取得）');
    Logger.log('⚠️ 解決策：ブックマークレット方式を使用してください（AMAZON_BOOKMARKLET_GUIDE.md参照）');

    // ① Chromeブラウザに偽装したヘッダーを設定（Bot判定回避）
    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // ② Bot判定チェック（50KB以下はブロックページの可能性大）
    if (html.length < 50000) {
      Logger.log('⚠️ HTMLが小さすぎます（Bot判定の可能性）: ' + html.length + ' バイト');
      Logger.log('HTMLプレビュー（先頭500文字）: ' + html.substring(0, 500));

      // ③ 代替手段：URLからASINを抽出して推定
      return extractImagesFromAsinFallback(productPageUrl);
    }

    const imageUrls = [];

    // 方法1: colorImages JavaScriptオブジェクトから抽出（最も確実）
    const colorImagesMatch = html.match(/'colorImages':\s*\{\s*'initial':\s*(\[[\s\S]*?\])/);
    if (colorImagesMatch) {
      try {
        Logger.log('🔍 colorImages オブジェクトから画像を抽出中...');
        const jsonStr = colorImagesMatch[1];
        const colorImagesData = JSON.parse(jsonStr);

        for (let i = 0; i < colorImagesData.length; i++) {
          const imageData = colorImagesData[i];

          // hiRes、large、mainの順に取得
          let imageUrl = null;

          if (imageData.hiRes) {
            imageUrl = imageData.hiRes;
          } else if (imageData.large) {
            imageUrl = imageData.large;
          } else if (imageData.main && typeof imageData.main === 'object') {
            // mainがオブジェクトの場合、最大サイズのURLを取得
            const urls = Object.keys(imageData.main);
            if (urls.length > 0) {
              // サイズでソートして最大のものを選択
              imageUrl = urls.reduce(function(maxUrl, url) {
                const currentSize = imageData.main[url];
                const maxSize = imageData.main[maxUrl];
                return (currentSize && currentSize[0] > maxSize[0]) ? url : maxUrl;
              });
            }
          }

          if (imageUrl && imageUrl !== '') {
            imageUrls.push(imageUrl);
            Logger.log('  ✓ 画像' + (i + 1) + ': ' + imageUrl);
          }
          if (imageUrls.length >= 20) break;
        }

        if (imageUrls.length > 0) {
          Logger.log('✅ colorImagesから ' + imageUrls.length + '枚の画像を検出');
          // 重複除去して最大解像度のみ残す
          const deduplicated = deduplicateAmazonImagesBySize(imageUrls);
          Logger.log('重複除去後: ' + deduplicated.length + '枚');
          return deduplicated;
        }
      } catch (jsonError) {
        Logger.log('⚠️ colorImages JSON解析エラー: ' + jsonError.toString());
      }
    }

    // 方法2: data-a-dynamic-image属性から抽出（JSON形式）
    Logger.log('🔍 data-a-dynamic-image属性から画像を抽出中...');
    const dynamicImagePattern = /data-a-dynamic-image='(\{[^']+\})'/g;
    let match;
    while ((match = dynamicImagePattern.exec(html)) !== null) {
      try {
        const imageData = JSON.parse(match[1]);
        for (const url in imageData) {
          if (imageData.hasOwnProperty(url) && !imageUrls.includes(url)) {
            imageUrls.push(url);
            Logger.log('  ✓ 画像' + imageUrls.length + ': ' + url);
          }
          if (imageUrls.length >= 20) break;
        }
      } catch (e) {
        Logger.log('  ⚠️ JSON解析エラー: ' + e.toString());
      }
      if (imageUrls.length >= 20) break;
    }

    if (imageUrls.length > 0) {
      Logger.log('✅ data-a-dynamic-imageから ' + imageUrls.length + '枚の画像を検出');
      // 重複除去して最大解像度のみ残す
      const deduplicated = deduplicateAmazonImagesBySize(imageUrls);
      Logger.log('重複除去後: ' + deduplicated.length + '枚');
      return deduplicated;
    }

    // 方法3: data-old-hires属性から抽出
    Logger.log('🔍 data-old-hires属性から画像を抽出中...');
    const hiresPattern = /data-old-hires="(https:\/\/[^"]+)"/g;
    while ((match = hiresPattern.exec(html)) !== null) {
      const imageUrl = match[1];
      if (!imageUrls.includes(imageUrl)) {
        imageUrls.push(imageUrl);
        Logger.log('  ✓ 画像' + imageUrls.length + ': ' + imageUrl);
      }
      if (imageUrls.length >= 20) break;
    }

    if (imageUrls.length > 0) {
      Logger.log('✅ data-old-hiresから ' + imageUrls.length + '枚の画像を検出');
      // 重複除去して最大解像度のみ残す
      const deduplicated = deduplicateAmazonImagesBySize(imageUrls);
      Logger.log('重複除去後: ' + deduplicated.length + '枚');
      return deduplicated;
    }

    // 方法4: imgタグのsrc属性から高解像度画像を抽出
    Logger.log('🔍 imgタグから画像を抽出中...');
    const imgPattern = /https:\/\/[^"'\s<>]*(?:m\.media-amazon\.com|images-na\.ssl-images-amazon\.com)\/images\/I\/[^"'\s<>]+\.jpg/g;
    const allImageMatches = html.match(imgPattern) || [];

    // 重複除去とサイズフィルタリング
    const seen = {};
    for (let i = 0; i < allImageMatches.length; i++) {
      let imageUrl = allImageMatches[i];

      // サムネイルを除外し、高解像度版に変換
      if (imageUrl.includes('._AC_') || imageUrl.includes('._SL') || imageUrl.includes('._UL')) {
        // 既に高解像度の場合はそのまま
        if (!imageUrl.includes('._SL1500_') && !imageUrl.includes('._AC_SL1500_')) {
          // 高解像度版に変換
          imageUrl = imageUrl.replace(/\._[A-Z]+[0-9]+_/g, '._AC_SL1500_');
        }
      }

      if (!seen[imageUrl]) {
        seen[imageUrl] = true;
        imageUrls.push(imageUrl);
        Logger.log('  ✓ 画像' + imageUrls.length + ': ' + imageUrl);
      }
      if (imageUrls.length >= 20) break;
    }

    if (imageUrls.length > 0) {
      Logger.log('✅ imgタグから ' + imageUrls.length + '枚の画像を検出');
      // 重複除去して最大解像度のみ残す
      const deduplicated = deduplicateAmazonImagesBySize(imageUrls);
      Logger.log('重複除去後: ' + deduplicated.length + '枚');
      return deduplicated;
    }

    Logger.log('⚠️ Amazon商品ページから画像を検出できませんでした');
    return [];

  } catch (error) {
    Logger.log('extractAmazonImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * ASIN抽出によるフォールバック（Bot判定時）
 *
 * @deprecated GASからのAmazon直接アクセスは構造的に不可能です。ブックマークレット方式を使用してください。
 * @param {string} url Amazon商品URL
 * @returns {Array<string>} 画像URLの配列（常に空配列）
 */
function extractImagesFromAsinFallback(url) {
  try {
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (!asinMatch) {
      Logger.log('⚠️ ASINを抽出できませんでした');
      return [];
    }

    const asin = asinMatch[1];
    Logger.log('📋 ASIN: ' + asin);
    Logger.log('❌ Bot判定回避に失敗しました');
    Logger.log('');
    Logger.log('【根本原因】AmazonはTLSフィンガープリントとJS実行可否でBot判定を行います');
    Logger.log('- ブラウザ: 2,495 KB の正常なHTML取得 ✅');
    Logger.log('- GAS: 6 KB の「a-no-js」ブロックページのみ取得 ❌');
    Logger.log('- ヘッダー偽装では回避不可能（TLS/JS実行の構造的制約）');
    Logger.log('');
    Logger.log('【解決策】ブックマークレット方式を使用してください');
    Logger.log('1. AMAZON_BOOKMARKLET_GUIDE.md を開く');
    Logger.log('2. AmazonWebApp.gs を WebApp としてデプロイ');
    Logger.log('3. ブックマークレットをブラウザに登録');
    Logger.log('4. Amazon商品ページでブックマークレットをクリック → 画像が自動保存');
    Logger.log('');

    return [];
  } catch (error) {
    Logger.log('extractImagesFromAsinFallbackエラー: ' + error.toString());
    return [];
  }
}

/**
 * Amazon画像URLの重複除去（同じ画像IDで最大解像度のみ残す）
 *
 * @param {Array<string>} urls 画像URLの配列
 * @returns {Array<string>} 重複除去後の画像URLの配列
 */
function deduplicateAmazonImagesBySize(urls) {
  const byId = {};

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    // URLからファイルID部分を抽出 (例: 61X1xcYYFCL)
    const idMatch = url.match(/images\/I\/([A-Za-z0-9_-]+)\./);
    if (idMatch) {
      const id = idMatch[1];

      if (!byId[id]) {
        byId[id] = url;
      } else {
        // SL数値が大きい方（高解像度）を優先
        const currentSizeMatch = byId[id].match(/SL(\d+)/);
        const newSizeMatch = url.match(/SL(\d+)/);

        const currentSize = currentSizeMatch ? parseInt(currentSizeMatch[1]) : 0;
        const newSize = newSizeMatch ? parseInt(newSizeMatch[1]) : 0;

        if (newSize > currentSize) {
          byId[id] = url;
        }
      }
    }
  }

  const result = [];
  for (const id in byId) {
    if (byId.hasOwnProperty(id)) {
      result.push(byId[id]);
    }
  }

  return result;
}

/**
 * オフモール（ハードオフ・オフハウス等）商品ページから画像URLを抽出
 *
 * @param {string} productPageUrl オフモール商品URL
 * @returns {Array<string>} 画像URLの配列
 */
function extractOffmallImageUrls(productPageUrl) {
  try {
    Logger.log('🏪 オフモール商品ページから画像を抽出中...');

    // HTMLを取得
    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // imageflux.jp ドメインの画像URLを抽出（オフモール専用CDN）
    // 例: https://p1-d9ebd2ee.imageflux.jp/c!/w=1280,h=1280,a=0,u=1,q=75/131002/2026_04_01_16_14_19.jpg
    const imgPattern = /https:\/\/[^"']+imageflux\.jp\/[^"']+\.(?:jpg|jpeg|png|gif|webp)/g;
    const matches = html.match(imgPattern) || [];

    // 重複除去（順番は維持）
    const seen = new Set();
    const imageUrls = [];

    for (let i = 0; i < matches.length; i++) {
      const url = matches[i];
      if (!seen.has(url)) {
        seen.add(url);
        imageUrls.push(url);
        Logger.log('  ✓ 画像' + imageUrls.length + ': ' + url);
      }
      if (imageUrls.length >= 20) break; // 最大20枚
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出');
    return imageUrls.slice(0, 20); // 最大20枚

  } catch (error) {
    Logger.log('extractOffmallImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * 駿河屋商品ページから画像URLを抽出（CDN直接アクセス方式）
 *
 * HTMLスクレイピング不要 - 管理番号からCDN URLを構築してHEADリクエストで存在確認
 * 理由: 駿河屋本体サイトはCloudflareで保護されており403エラーが返る
 *
 * @param {string} productPageUrl 駿河屋商品URL or 管理番号
 * @returns {Array<string>} 画像URLの配列（サイト表示順）
 */
function extractSurugayaImageUrls(productPageUrl) {
  try {
    Logger.log('🎮 駿河屋商品画像をCDNから取得中...');

    // 管理番号を抽出
    const productId = extractSurugayaProductId(productPageUrl);
    if (!productId) {
      Logger.log('❌ 管理番号を取得できませんでした: ' + productPageUrl);
      return [];
    }
    Logger.log('管理番号: ' + productId);

    // CDNから画像URLを収集（HEADリクエストで存在確認）
    const imageUrls = collectSurugayaImageUrls(productId);

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出');
    return imageUrls;

  } catch (error) {
    Logger.log('extractSurugayaImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * 管理番号から駿河屋CDNの画像URL一覧を収集
 * HEADリクエストで存在確認しながらサイト表示順に返す
 *
 * 画像URLパターン:
 *   メイン: https://cdn.suruga-ya.jp/database/pics_webp/game/{id}.jpg.webp
 *   追加:   https://cdn.suruga-ya.jp/pics_webp/boxart_a/{id}_{n}.jpg.webp  (n=1,2,3...)
 *
 * @param {string} productId 管理番号
 * @returns {Array<string>} 画像URLの配列（サイト表示順）
 */
function collectSurugayaImageUrls(productId) {
  const imageUrls = [];

  // ① メイン画像（必ず存在するはずだが一応確認）
  const mainUrl = 'https://cdn.suruga-ya.jp/database/pics_webp/game/' + productId + '.jpg.webp';
  if (checkUrlExists(mainUrl)) {
    imageUrls.push(mainUrl);
    Logger.log('  ✓ メイン画像: ' + mainUrl);
  } else {
    Logger.log('  ⚠️ メイン画像なし: ' + mainUrl);
  }

  // ② 追加画像（_1, _2, _3... と連番でチェック、404になったら終了）
  const MAX_IMAGES = 20; // 安全上限（通常は10枚以下）
  for (let n = 1; n <= MAX_IMAGES; n++) {
    const subUrl = 'https://cdn.suruga-ya.jp/pics_webp/boxart_a/' + productId + '_' + n + '.jpg.webp';
    if (checkUrlExists(subUrl)) {
      imageUrls.push(subUrl);
      Logger.log('  ✓ 追加画像[' + n + ']: ' + subUrl);
    } else {
      Logger.log('  終了（' + n + '枚目が存在しないため）');
      break; // 連番が途切れたら終了
    }
  }

  return imageUrls;
}

/**
 * URLの存在確認（GETリクエスト）
 *
 * 注: GASのUrlFetchAppはHEADメソッドをサポートしていないため、GETを使用
 *
 * @param {string} url 確認するURL
 * @returns {boolean} 存在すればtrue（HTTP 200）
 */
function checkUrlExists(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true
    });
    const code = response.getResponseCode();
    return code === 200;
  } catch (e) {
    Logger.log('  checkUrlExistsエラー: ' + url + ' → ' + e.toString());
    return false;
  }
}

/**
 * URLまたは管理番号から管理番号を抽出
 *
 * @param {string} input URLまたは管理番号の文字列
 * @returns {string|null} 管理番号（数字）
 */
function extractSurugayaProductId(input) {
  if (!input) return null;
  const str = input.toString().trim();

  // パターン1: URLから抽出 https://www.suruga-ya.jp/product/detail/603216356
  const urlMatch = str.match(/\/product\/detail\/(\d+)/);
  if (urlMatch) return urlMatch[1];

  // パターン2: 数字のみ（管理番号直接入力）
  if (/^\d+$/.test(str)) return str;

  return null;
}

/**
 * デジマート商品ページから画像URLを抽出
 *
 * a.cbx タグのhref属性から画像URLを抽出
 * 画像URLパターン: //img.digimart.net/prdimg/m/{2chars}/{hash}.jpg
 *
 * @param {string} productPageUrl デジマート商品URL
 * @returns {Array<string>} 画像URLの配列
 */
function extractDigimartImageUrls(productPageUrl) {
  try {
    Logger.log('🎸 デジマート商品ページから画像を抽出中...');

    // HTMLを取得
    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // a.cbx タグの href 属性から画像URLを抽出
    // パターン: href="//img.digimart.net/prdimg/m/{2chars}/{hash}.jpg"
    // 'm' はメインサイズ、's' はサムネイル（メインサイズを優先）
    const cbxPattern = /href="(\/\/img\.digimart\.net\/prdimg\/m\/[^"]+\.(?:jpg|jpeg|png|gif|webp))"/gi;
    const imageUrls = [];
    const seen = new Set();
    let match;

    while ((match = cbxPattern.exec(html)) !== null) {
      const relativeUrl = match[1];
      const url = 'https:' + relativeUrl;

      if (!seen.has(url)) {
        seen.add(url);
        imageUrls.push(url);
        Logger.log('  ✓ 画像' + imageUrls.length + ': ' + url);
      }

      if (imageUrls.length >= 20) break; // 最大20枚
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出');
    return imageUrls.slice(0, 20); // 最大20枚

  } catch (error) {
    Logger.log('extractDigimartImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * NETSEA（ネッシー）商品ページから画像URLを抽出
 *
 * @param {string} productPageUrl NETSEA商品URL
 * @returns {Array<string>} 画像URLの配列（サイト表示順）
 */
function extractNetseaImageUrls(productPageUrl) {
  try {
    Logger.log('🏪 NETSEA商品ページから画像を抽出中...');

    // HTMLを取得
    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // #imagePrevArea ul.thumImg 内の img[data-url] を順番に取得
    // data-url="https://img04.netsea.jp/ex15/.../商品ID_連番.jpg"
    const regex = /id="imagePrevArea"[\s\S]*?<ul[^>]*class="thumImg"[^>]*>([\s\S]*?)<\/ul>/;
    const ulMatch = html.match(regex);

    if (!ulMatch) {
      Logger.log('⚠️ サムネイルリスト（#imagePrevArea ul.thumImg）が見つかりませんでした');
      return [];
    }

    const ulHtml = ulMatch[1];
    Logger.log('✓ サムネイルリストブロックを検出');

    // data-url属性を順番に抽出
    const dataUrlRegex = /data-url="([^"]+)"/g;
    const imageUrls = [];
    let match;

    while ((match = dataUrlRegex.exec(ulHtml)) !== null) {
      imageUrls.push(match[1]);
      Logger.log('  ✓ 画像' + imageUrls.length + ': ' + match[1]);
    }

    if (imageUrls.length === 0) {
      Logger.log('❌ 画像URLが見つかりませんでした');
      return [];
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出（表示順保証）');
    return imageUrls.slice(0, 20); // 最大20枚

  } catch (error) {
    Logger.log('extractNetseaImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * ラクマ（Fril）商品ページから画像URLを抽出
 *
 * @param {string} productPageUrl ラクマ商品URL
 * @returns {Array<string>} 画像URLの配列（サイト表示順）
 */
function extractRakumaImageUrls(productPageUrl) {
  try {
    Logger.log('🛍️ ラクマ商品ページから画像を抽出中...');

    // HTMLを取得
    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // sp-image クラスの img タグから src を抽出（表示順通り）
    // 実際のHTML: <img src="..." class="sp-image" alt="..." />
    // → 属性順不問でマッチする2段階方式
    const imgTagPattern = /<img[^>]*sp-image[^>]*>/gi;
    const srcPattern = /src="([^"]+)"/i;
    const imageUrls = [];
    let tagMatch;

    while ((tagMatch = imgTagPattern.exec(html)) !== null) {
      const tag = tagMatch[0];
      const srcMatch = srcPattern.exec(tag);
      if (srcMatch && srcMatch[1].includes('img.fril.jp')) {
        imageUrls.push(srcMatch[1]);
        Logger.log('  ✓ 画像' + imageUrls.length + ': ' + srcMatch[1]);
      }
    }

    if (imageUrls.length === 0) {
      Logger.log('❌ 画像URLが見つかりませんでした');
      return [];
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出（表示順保証）');
    return imageUrls.slice(0, 20); // 最大20枚

  } catch (error) {
    Logger.log('extractRakumaImageUrlsエラー: ' + error.toString());
    return [];
  }
}

/**
 * スーパーデリバリー商品ページから画像URLを抽出（改善版）
 *
 * @param {string} productPageUrl スーパーデリバリー商品URL
 * @returns {Array<string>} 画像URLの配列（重複除去・最大サイズ優先）
 */
function extractSuperdeliveryImageUrls(productPageUrl) {
  try {
    Logger.log('📦 スーパーデリバリー商品ページから画像を抽出中...');

    const response = UrlFetchApp.fetch(productPageUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('HTTP ' + responseCode + ': ページ取得失敗');
      return [];
    }

    const html = response.getContentText('UTF-8');
    Logger.log('HTML取得完了: ' + html.length + ' バイト');

    // ---- ユーティリティ: スーパーデリバリーCDN URLのファイル名を取得 ----
    // 例: https://c.superdelivery.com/ip/n/sa/1200/630/.../12080935_s_1000.jpg
    //      → キー: "12080935_s_1000.jpg"
    //      → サイズ: 1200 * 630 = 756000
    function parseCdnUrl(url) {
      const cdnPattern = /\/ip\/n\/sa\/(\d+)\/(\d+)\/(.+\.(jpg|jpeg|png|webp))/i;
      const m = cdnPattern.exec(url);
      if (m) {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        const filename = m[3].split('/').pop(); // パス末尾のファイル名のみ
        return { filename: filename, area: w * h, isCdn: true };
      }
      // CDN形式でない場合はURLそのものをキーにする
      const filename = url.split('/').pop().split('?')[0];
      return { filename: filename, area: 0, isCdn: false };
    }

    // ---- 重複除去マップ: filename → { url, area } ----
    // 同じファイル名で複数サイズがあれば最大面積のURLを残す
    const bestByFilename = {}; // { filename: { url, area } }

    function addCandidate(url) {
      if (!url || url.includes('data:image')) return;
      url = url.split('"')[0].split("'")[0].trim(); // 余分な文字を除去
      const parsed = parseCdnUrl(url);
      const filename = parsed.filename;
      const area = parsed.area;
      if (!filename) return;
      if (!bestByFilename[filename] || area > bestByFilename[filename].area) {
        bestByFilename[filename] = { url: url, area: area };
      }
    }

    // ========== パターン1: og:image メタタグ（最も信頼性が高い） ==========
    const ogImagePattern = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi;
    let match;
    while ((match = ogImagePattern.exec(html)) !== null) {
      Logger.log('  ✓ og:image: ' + match[1]);
      addCandidate(match[1]);
    }
    // content先行パターン
    const ogImagePattern2 = /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/gi;
    while ((match = ogImagePattern2.exec(html)) !== null) {
      Logger.log('  ✓ og:image(rev): ' + match[1]);
      addCandidate(match[1]);
    }

    // ========== パターン2: JSON-LD（構造化データ） ==========
    const jsonLdPattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const images = [].concat(data.image || []);
        images.forEach(function(img) {
          const imgUrl = typeof img === 'string' ? img : img.url || img.contentUrl || '';
          if (imgUrl) {
            Logger.log('  ✓ JSON-LD image: ' + imgUrl);
            addCandidate(imgUrl);
          }
        });
      } catch (e) { /* JSON parse失敗は無視 */ }
    }

    // ========== パターン3: data-zoom-image 属性 ==========
    const zoomPattern = /data-zoom-image="([^"]+)"/gi;
    while ((match = zoomPattern.exec(html)) !== null) {
      Logger.log('  ✓ data-zoom-image: ' + match[1]);
      addCandidate(match[1]);
    }

    // ========== パターン4: data-src / data-original（遅延読込） ==========
    const dataSrcPattern = /data-(?:src|original)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    while ((match = dataSrcPattern.exec(html)) !== null) {
      if (match[1].includes('superdelivery') || match[1].includes('c.superdelivery')) {
        Logger.log('  ✓ data-src: ' + match[1]);
        addCandidate(match[1]);
      }
    }

    // ========== パターン5: 商品画像imgタグのsrc ==========
    const productImagePattern = /<img[^>]*class="[^"]*product[^"]*"[^>]*src="([^"]+)"/gi;
    while ((match = productImagePattern.exec(html)) !== null) {
      Logger.log('  ✓ product-img: ' + match[1]);
      addCandidate(match[1]);
    }

    // ========== パターン6: フォールバック - CDN URLを全件スキャン ==========
    if (Object.keys(bestByFilename).length === 0) {
      Logger.log('⚠️ 標準パターンで画像が見つかりません。フォールバックを試行中...');

      const genericPattern = /https?:\/\/c\.superdelivery\.com\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi;
      while ((match = genericPattern.exec(html)) !== null) {
        const url = match[0];
        if (!url.includes('logo') && !url.includes('icon')) {
          addCandidate(url);
        }
      }

      // c.superdelivery.com以外のスーパーデリバリー関連CDNも試す
      if (Object.keys(bestByFilename).length === 0) {
        const fallback2 = /https?:\/\/[^"'\s<>]*superdelivery[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi;
        while ((match = fallback2.exec(html)) !== null) {
          const url = match[0];
          if (!url.includes('logo') && !url.includes('icon')) {
            addCandidate(url);
          }
        }
      }
    }

    // ========== 結果をまとめる ==========
    const imageUrls = Object.values(bestByFilename)
      .sort(function(a, b) { return b.area - a.area; }) // 大きいサイズ順に並べる
      .map(function(entry) { return entry.url; });

    if (imageUrls.length === 0) {
      Logger.log('❌ 画像URLが見つかりませんでした');
      Logger.log('HTML preview: ' + html.substring(0, 500));
      return [];
    }

    Logger.log('✅ ' + imageUrls.length + '枚の画像を検出（重複除去済）');
    imageUrls.forEach(function(url, i) { Logger.log('  ' + (i + 1) + '. ' + url); });

    return imageUrls.slice(0, 20); // 最大20枚

  } catch (error) {
    Logger.log('extractSuperdeliveryImageUrlsエラー: ' + error.toString());
    return [];
  }
}
