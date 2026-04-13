/**
 * eBay API クライアント
 *
 * eBay REST API への HTTP リクエストを管理します
 */

/**
 * eBay API リクエストを実行
 *
 * @param {string} endpoint - API エンドポイント（例: '/buy/browse/v1/item_summary/search'）
 * @param {string} method - HTTP メソッド（GET, POST, PUT, DELETE）
 * @param {Object} params - クエリパラメータ（オプション）
 * @param {Object} payload - リクエストボディ（オプション）
 * @param {Object} headers - 追加ヘッダー（オプション）
 * @returns {Object} API レスポンス
 */
function ebayApiRequest(endpoint, method, params, payload, headers) {
  method = method || 'GET';
  params = params || {};
  payload = payload || null;
  headers = headers || {};

  // アクセストークンを取得
  let token = getAccessToken();

  // トークンがない場合は新規取得
  if (!token) {
    Logger.log('トークンがないため、新規取得します');
    const tokenData = getClientCredentialsToken();
    token = tokenData.access_token;
  }

  // URL を構築
  const baseUrl = getBaseUrl();
  let url = baseUrl + endpoint;

  // クエリパラメータを追加
  if (Object.keys(params).length > 0) {
    const queryString = Object.keys(params)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&');
    url += '?' + queryString;
  }

  // リクエストオプションを構築
  const options = {
    method: method.toLowerCase(),
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers
    },
    muteHttpExceptions: true
  };

  // ペイロードがある場合は追加
  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  // タイムアウト設定
  const config = getConfig();
  if (config.REQUEST_TIMEOUT) {
    // UrlFetchApp はタイムアウトをミリ秒で指定できないため、秒に変換
    // options.timeout = Math.ceil(config.REQUEST_TIMEOUT / 1000);
  }

  try {
    Logger.log('API リクエスト: ' + method + ' ' + url);

    // リクエストを実行
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('レスポンスコード: ' + responseCode);

    // レート制限対策の遅延
    if (config.RATE_LIMIT_DELAY) {
      Utilities.sleep(config.RATE_LIMIT_DELAY);
    }

    // レスポンスを処理
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else {
      Logger.log('API エラー: ' + responseText);
      throw new Error('API エラー (' + responseCode + '): ' + responseText);
    }
  } catch (error) {
    Logger.log('リクエストエラー: ' + error.toString());
    throw error;
  }
}

/**
 * 商品を検索（Browse API）
 *
 * @param {string} query - 検索クエリ
 * @param {Object} options - 検索オプション
 * @returns {Object} 検索結果
 */
function searchItems(query, options) {
  options = options || {};

  const params = {
    q: query,
    limit: options.limit || 50,
    offset: options.offset || 0
  };

  // フィルターを追加
  if (options.filter) {
    params.filter = options.filter;
  }

  // ソート順を追加
  if (options.sort) {
    params.sort = options.sort;
  }

  try {
    const response = ebayApiRequest(
      '/buy/browse/v1/item_summary/search',
      'GET',
      params
    );

    Logger.log('検索結果: ' + response.total + ' 件');
    return response;
  } catch (error) {
    Logger.log('商品検索エラー: ' + error.toString());
    throw error;
  }
}

/**
 * 商品詳細を取得（Browse API）
 *
 * @param {string} itemId - 商品ID
 * @returns {Object} 商品詳細
 */
function getItem(itemId) {
  try {
    const response = ebayApiRequest(
      '/buy/browse/v1/item/' + itemId,
      'GET'
    );

    Logger.log('商品詳細を取得しました: ' + response.title);
    return response;
  } catch (error) {
    Logger.log('商品詳細取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * 在庫アイテムを取得（Inventory API）
 *
 * @param {string} sku - SKU
 * @returns {Object} 在庫アイテム
 */
function getInventoryItem(sku) {
  try {
    const response = ebayApiRequest(
      '/sell/inventory/v1/inventory_item/' + sku,
      'GET'
    );

    Logger.log('在庫アイテムを取得しました: ' + sku);
    return response;
  } catch (error) {
    Logger.log('在庫アイテム取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * 在庫アイテムを作成または更新（Inventory API）
 *
 * @param {string} sku - SKU
 * @param {Object} inventoryItem - 在庫アイテムデータ
 * @returns {Object} レスポンス
 */
function createOrUpdateInventoryItem(sku, inventoryItem) {
  try {
    const response = ebayApiRequest(
      '/sell/inventory/v1/inventory_item/' + sku,
      'PUT',
      null,
      inventoryItem
    );

    Logger.log('在庫アイテムを作成/更新しました: ' + sku);
    return response;
  } catch (error) {
    Logger.log('在庫アイテム作成/更新エラー: ' + error.toString());
    throw error;
  }
}

/**
 * 注文を取得（Fulfillment API）
 *
 * @param {Object} filters - フィルター条件
 * @returns {Object} 注文リスト
 */
function getOrders(filters) {
  filters = filters || {};

  const params = {};

  // フィルター条件を追加
  if (filters.orderIds) {
    params.orderIds = filters.orderIds;
  }

  if (filters.filter) {
    params.filter = filters.filter;
  }

  if (filters.limit) {
    params.limit = filters.limit;
  }

  if (filters.offset) {
    params.offset = filters.offset;
  }

  try {
    const response = ebayApiRequest(
      '/sell/fulfillment/v1/order',
      'GET',
      params
    );

    Logger.log('注文を取得しました: ' + (response.orders ? response.orders.length : 0) + ' 件');
    return response;
  } catch (error) {
    Logger.log('注文取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * カテゴリツリーを取得（Taxonomy API）
 *
 * @param {string} categoryTreeId - カテゴリツリーID
 * @param {string} categoryId - カテゴリID（オプション）
 * @returns {Object} カテゴリツリー
 */
function getCategoryTree(categoryTreeId, categoryId) {
  const params = {};

  if (categoryId) {
    params.category_id = categoryId;
  }

  try {
    const response = ebayApiRequest(
      '/commerce/taxonomy/v1/category_tree/' + categoryTreeId,
      'GET',
      params
    );

    Logger.log('カテゴリツリーを取得しました');
    return response;
  } catch (error) {
    Logger.log('カテゴリツリー取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * API 接続テスト
 */
function testApiConnection() {
  Logger.log('=== API 接続テスト ===');

  try {
    // 設定の確認
    const validation = validateConfig();
    if (!validation.valid) {
      Logger.log('✗ 設定エラー: ' + validation.errors.join(', '));
      return;
    }
    Logger.log('✓ 設定OK');

    // トークンの確認
    let token = getAccessToken();
    if (!token) {
      Logger.log('トークンを取得します...');
      const tokenData = getClientCredentialsToken();
      token = tokenData.access_token;
    }
    Logger.log('✓ トークンOK');

    // 簡単な API 呼び出しテスト（商品検索）
    Logger.log('商品検索テストを実行します...');
    const searchResult = searchItems('laptop', { limit: 5 });

    if (searchResult && searchResult.itemSummaries) {
      Logger.log('✓ API 接続成功');
      Logger.log('検索結果: ' + searchResult.total + ' 件');
      Logger.log('取得件数: ' + searchResult.itemSummaries.length + ' 件');

      // 最初の商品のタイトルを表示
      if (searchResult.itemSummaries.length > 0) {
        Logger.log('サンプル商品: ' + searchResult.itemSummaries[0].title);
      }
    } else {
      Logger.log('✗ 予期しないレスポンス');
    }
  } catch (error) {
    Logger.log('✗ API 接続テスト失敗');
    Logger.log('エラー: ' + error.toString());
  }
}

/**
 * Google Drive URLをeBayがダウンロード可能な形式に変換する
 * lh3.googleusercontent.com/d/{FILEID} 形式を使用
 *
 * @param {string} url Google Drive URL
 * @returns {string|null} 変換後URL、変換失敗時null
 */
function convertDriveUrlForEbay(url) {
  if (!url || typeof url !== 'string') return null;
  url = url.trim();

  // https://drive.google.com/file/d/FILEID/view... 形式
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
  if (driveFileMatch) {
    const fileId = driveFileMatch[1];
    // lh3.googleusercontent.com形式はeBayが直接アクセス可能
    return 'https://lh3.googleusercontent.com/d/' + fileId;
  }

  // https://drive.google.com/open?id=FILEID 形式
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (driveOpenMatch) {
    return 'https://lh3.googleusercontent.com/d/' + driveOpenMatch[1];
  }

  // すでにlh3形式
  if (url.includes('lh3.googleusercontent.com')) {
    return url;
  }

  // HTTPS URLはそのまま返す
  if (url.startsWith('https://')) {
    return url;
  }

  Logger.log('⚠️ 変換不可のURL形式: ' + url);
  return null;
}

/**
 * Google DriveのURLをeBay EPSにアップロードしてEPS URLを返す
 * eBay Media API createImageFromUrl を使用
 *
 * @param {string} driveUrl Google Drive共有URL
 * @param {string} accessToken eBay OAuthアクセストークン
 * @returns {{ success: boolean, epsUrl: string, error: string }}
 */
function uploadImageToEPS(driveUrl, accessToken) {
  try {
    // Google Drive URLをlh3.googleusercontent.com形式に変換
    const imageUrl = convertDriveUrlForEbay(driveUrl);
    if (!imageUrl) {
      return { success: false, error: 'Google Drive URLの変換に失敗しました: ' + driveUrl };
    }

    Logger.log('EPS アップロード開始: ' + imageUrl);

    const endpoint = 'https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_url';

    const payload = JSON.stringify({ imageUrl: imageUrl });

    const options = {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const statusCode = response.getResponseCode();

    Logger.log('EPS アップロード レスポンスコード: ' + statusCode);

    if (statusCode === 201) {
      // レスポンスボディからimageUrlを取得
      const body = JSON.parse(response.getContentText());
      const epsUrl = body.imageUrl;
      Logger.log('✅ EPS アップロード成功: ' + epsUrl);
      return { success: true, epsUrl: epsUrl };
    }

    // エラー処理
    const errorBody = response.getContentText();
    Logger.log('❌ EPS アップロード失敗: ' + statusCode + ' / ' + errorBody);

    let errorMessage = 'HTTP ' + statusCode;
    try {
      const errorJson = JSON.parse(errorBody);
      if (errorJson.errors && errorJson.errors.length > 0) {
        errorMessage = errorJson.errors[0].longMessage || errorJson.errors[0].message || errorMessage;
      }
    } catch (e) {
      errorMessage += ': ' + errorBody.substring(0, 200);
    }

    return { success: false, error: errorMessage };

  } catch (e) {
    Logger.log('❌ EPS アップロード例外: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * 出品データの全画像をEPSにアップロードしてEPS URLに置換する
 *
 * @param {Array} images 画像URLの配列
 * @param {string} accessToken eBay OAuthアクセストークン
 * @returns {Array} EPS URLの配列（失敗した画像はスキップ）
 */
function uploadAllImagesToEPS(images, accessToken) {
  const epsUrls = [];

  for (let i = 0; i < images.length; i++) {
    const originalUrl = images[i];
    if (!originalUrl) continue;

    // Drive URL以外（すでにEPS URLや他のHTTPS URL）はそのまま使用
    if (originalUrl.includes('i.ebayimg.com')) {
      Logger.log('既存EPS URL スキップ: ' + originalUrl);
      epsUrls.push(originalUrl);
      continue;
    }

    const result = uploadImageToEPS(originalUrl, accessToken);
    if (result.success) {
      epsUrls.push(result.epsUrl);
    } else {
      Logger.log('⚠️ 画像' + (i + 1) + 'のEPSアップロード失敗: ' + result.error);
      // 失敗した画像はスキップ（出品は継続）
    }

    // レート制限対策: 5秒間50リクエスト制限のため間隔を空ける
    if (i < images.length - 1) {
      Utilities.sleep(200); // 200ms間隔
    }
  }

  Logger.log('EPS アップロード完了: ' + epsUrls.length + '枚成功');
  return epsUrls;
}
