/**
 * eBay利益計算ツール - 設定ファイル
 *
 * スプレッドシート「ツール設定」シートから設定を読み込む
 */

// スプレッドシート定義
// このスクリプトが紐付けられているスプレッドシートを自動取得
const ss = SpreadsheetApp.getActiveSpreadsheet();

// シート定義
const SHEET_NAMES = {
  SETTINGS: 'ツール設定',
  CALCULATION: '利益計算',
  RESEARCH: 'リサーチ',
  LISTING: '出品', // 転記先シート名（出品シートスプレッドシート内の「出品」シート）
  CATEGORY_MASTER:  'category_master_EBAY_US', // 15列統合スキーマ
  CONDITION_JA_MAP: 'condition_ja_map',        // コンディション日本語マスタ
  ITEM_CACHE:       '_cache'                   // API呼び出しキャッシュ（非表示シート）
};

// Item Specifics色定義
const SPEC_COLORS = {
  REQUIRED: '#FF0000',    // 必須: 赤色
  RECOMMENDED: '#0000FF', // 推奨: 青色
  OPTIONAL: '#808080'     // その他: グレー
};

// ========================================
// リサーチシート構造定義（clasp run で取得したエビデンスベース）
// ========================================

// A1:J2 - トップ情報セクション（clasp run inspectResearchA1J2Range で取得）
const RESEARCH_TOP_INFO = {
  HEADER_ROW: 1,
  DATA_ROW: 2,
  COLUMNS: {
    STAFF: { col: 2, letter: 'B', header: '担当者' },
    RESEARCH_METHOD: { col: 3, letter: 'C', header: 'リサーチ方法' },
    KEYWORD: { col: 4, letter: 'D', header: 'キーワード' },
    TARGET_PROFIT_RATE: { col: 5, letter: 'E', header: '目標利益率' },
    MIN_PRICE_USD: { col: 6, letter: 'F', header: '下限価格$' },
    MAX_PRICE_USD: { col: 7, letter: 'G', header: '上限価格$' },
    CATEGORY_LARGE: { col: 8, letter: 'H', header: 'カテゴリ(大)' }
  }
};

// B4:J5 - メイン情報セクション
const RESEARCH_MAIN_INFO = {
  HEADER_ROW: 4,
  DATA_ROW: 5,
  COLUMNS: {
    PURCHASE_PRICE_JPY: { col: 2, letter: 'B', header: '仕入値(¥)' },
    SELLING_PRICE_USD: { col: 3, letter: 'C', header: '売値($)' },
    SHIPPING_COST_USD: { col: 4, letter: 'D', header: '送料($)' },
    BEST_OFFER: { col: 5, letter: 'E', header: 'Best offer' },
    ACTUAL_WEIGHT_G: { col: 6, letter: 'F', header: '実重量(g)' },
    DEPTH_CM: { col: 7, letter: 'G', header: '奥行き(cm)' },
    WIDTH_CM: { col: 8, letter: 'H', header: '幅(cm)' },
    HEIGHT_CM: { col: 9, letter: 'I', header: '高さ(cm)' },
    VOLUMETRIC_WEIGHT_G: { col: 10, letter: 'J', header: '容積重量(g)' }
  }
};

// B10:J11 - 価格・仕入情報セクション
const RESEARCH_PRICE_INFO = {
  HEADER_ROW: 10,
  DATA_ROW: 11,
  COLUMNS: {
    PURCHASE_KEYWORD: { col: 2, letter: 'B', header: '仕入れキーワード' },
    // C列は空
    PURCHASE_URL_1: { col: 4, letter: 'D', header: '仕入元URL①' },
    PURCHASE_URL_2: { col: 5, letter: 'E', header: '仕入元URL②' },
    PURCHASE_URL_3: { col: 6, letter: 'F', header: '仕入元URL③' },
    IMAGE_URL: { col: 7, letter: 'G', header: '画像URL' },
    MEMO: { col: 8, letter: 'H', header: 'メモ' }
    // I, J列は空
  }
};

// B7:P8 - 商品リストセクション
const RESEARCH_ITEM_LIST = {
  HEADER_ROW: 7,
  DATA_ROW: 8,
  COLUMNS: {
    ITEM_URL: { col: 2, letter: 'B', header: 'Item URL' },
    LOWEST_PRICE_URL: { col: 3, letter: 'C', header: '検索URL' },
    SPEC_URL: { col: 4, letter: 'D', header: 'スペックURL' },
    CONDITION: { col: 5, letter: 'E', header: '状態' },
    // F列は空
    CATEGORY_ID: { col: 7, letter: 'G', header: 'カテゴリID' },
    CATEGORY_NAME: { col: 8, letter: 'H', header: 'カテゴリ' },
    // I列は空
    FEE_RATE: { col: 10, letter: 'J', header: '手数料' }
    // K-P列は空
  }
};

// B13:H16 - ポリシーセクション（発送方法別の利益計算）
// clasp run getResearchSheetHeaders で取得したエビデンス:
// Headers: ['ポリシー', '発送業者', '発送方法', '還付抜き利益', '還付抜き利益額', '還付込み利益額', '還付込み利益率']
const RESEARCH_POLICY = {
  HEADER_ROW: 13,
  POLICY_1_ROW: 14,  // Expedited
  POLICY_2_ROW: 15,  // Economy
  POLICY_3_ROW: 16,  // 書状
  COLUMNS: {
    POLICY_NAME: { col: 2, letter: 'B', header: 'ポリシー' },
    SHIPPING_CARRIER: { col: 3, letter: 'C', header: '発送業者' },
    SHIPPING_METHOD: { col: 4, letter: 'D', header: '発送方法' },
    PROFIT_AMOUNT_BEFORE_REFUND: { col: 5, letter: 'E', header: '還付抜き利益額' },
    PROFIT_RATE_BEFORE_REFUND: { col: 6, letter: 'F', header: '還付抜き利益率' },
    PROFIT_AMOUNT_AFTER_REFUND: { col: 7, letter: 'G', header: '還付込み利益額' },
    PROFIT_RATE_AFTER_REFUND: { col: 8, letter: 'H', header: '還付込み利益率' }
  }
};

// 後方互換性のための旧定義（既存コードで使用）
const RESEARCH_COLUMNS = {
  URL: 2,          // B列: eBay URL (RESEARCH_ITEM_LIST.COLUMNS.ITEM_URL.col)
  CATEGORY_ID: 7,  // G列: カテゴリID (RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_ID.col)
  CATEGORY_NAME: 8 // H列: カテゴリ名 (RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_NAME.col)
};

// リサーチシートの行定義（後方互換性）
const RESEARCH_ROWS = {
  HEADER: 7,  // ヘッダー行
  DATA: 8     // データ開始行
};

// ========================================
// 出品シート（メイン）構造定義（clasp run で取得したエビデンスベース）
// 更新日: 2026-03-27 - UPC/EAN独立、Item Specifics 20組に拡張
// 最終更新: 2026-03-27 - 画像URL + 画像1～20追加（103列）
// ========================================

const LISTING_ROWS = {
  HEADER: 1,       // ヘッダー行（1行目）
  DATA_START: 5    // データ開始行
};

// メインシートの列定義（126列 - SKU列追加+担当者列5つ追加により+6）
// ヘッダー行: 1行目
// 注意: ヘッダー名ベースの動的マッピングを使用しているため、列位置が変わっても自動対応
const LISTING_COLUMNS = {
  LISTING_URL: { header: '出品URL' },
  STATUS: { header: '出品ステータス' },
  SKU: { header: 'SKU' },
  KEYWORD: { header: '仕入れキーワード' },
  MEMO: { header: 'メモ' },

  // 仕入元情報（clasp run getListingSheetHeaders で確認済み）
  PURCHASE_SOURCE_1: { header: '仕入元①' },
  PURCHASE_URL_1: { header: '仕入元URL①' },
  PURCHASE_SOURCE_2: { header: '仕入元②' },
  PURCHASE_URL_2: { header: '仕入元URL②' },
  PURCHASE_SOURCE_3: { header: '仕入元③' },
  PURCHASE_URL_3: { header: '仕入元URL③' },

  // 担当者情報
  RESEARCH_STAFF: { header: 'リサーチ担当' }, // 必須列
  LISTING_STAFF: { header: '出品担当' }, // オプショナル列（列がなくてもエラーにしない）
  PICKUP_STAFF: { header: 'ピックアップ担当' }, // オプショナル列（列がなくてもエラーにしない）
  PURCHASE_SEARCH_STAFF: { header: '仕入れ検索担当' }, // オプショナル列（列がなくてもエラーにしない）
  PROFIT_CALC_STAFF: { header: '利益計算担当' }, // オプショナル列（列がなくてもエラーにしない）
  TASK6_STAFF: { header: '業務6担当' }, // オプショナル列（列がなくてもエラーにしない）

  // 商品情報
  WORD_CHECK: { header: 'ワード判定' },
  TITLE: { header: 'タイトル' },
  CHAR_COUNT_1: { header: '文字数' },
  CONDITION: { header: '状態' },
  CONDITION_DESC_TEMPLATE: { header: '状態テンプレ' },
  CONDITION_DESC_2: { header: '状態説明' },
  DESCRIPTION: { header: 'Description' },
  ITEM_URL: { header: 'ItemURL' },
  SPEC_URL: { header: 'スペックURL' },
  CATEGORY_ID: { header: 'カテゴリID' },
  CATEGORY_NAME: { header: 'カテゴリ' },
  BRAND: { header: 'Brand' },
  UPC: { header: 'UPC' },
  EAN: { header: 'EAN' },
  MPN: { header: 'MPN(型番可)' },

  // Item Specifics（項目名1～30、内容1～30）= 60列
  SPEC_NAME_1: { header: '項目名（1）' },
  SPEC_VALUE_1: { header: '内容（1）' },
  SPEC_NAME_2: { header: '項目名（2）' },
  SPEC_VALUE_2: { header: '内容（2）' },
  SPEC_NAME_3: { header: '項目名（3）' },
  SPEC_VALUE_3: { header: '内容（3）' },
  SPEC_NAME_4: { header: '項目名（4）' },
  SPEC_VALUE_4: { header: '内容（4）' },
  SPEC_NAME_5: { header: '項目名（5）' },
  SPEC_VALUE_5: { header: '内容（5）' },
  SPEC_NAME_6: { header: '項目名（6）' },
  SPEC_VALUE_6: { header: '内容（6）' },
  SPEC_NAME_7: { header: '項目名（7）' },
  SPEC_VALUE_7: { header: '内容（7）' },
  SPEC_NAME_8: { header: '項目名（8）' },
  SPEC_VALUE_8: { header: '内容（8）' },
  SPEC_NAME_9: { header: '項目名（9）' },
  SPEC_VALUE_9: { header: '内容（9）' },
  SPEC_NAME_10: { header: '項目名（10）' },
  SPEC_VALUE_10: { header: '内容（10）' },
  SPEC_NAME_11: { header: '項目名（11）' },
  SPEC_VALUE_11: { header: '内容（11）' },
  SPEC_NAME_12: { header: '項目名（12）' },
  SPEC_VALUE_12: { header: '内容（12）' },
  SPEC_NAME_13: { header: '項目名（13）' },
  SPEC_VALUE_13: { header: '内容（13）' },
  SPEC_NAME_14: { header: '項目名（14）' },
  SPEC_VALUE_14: { header: '内容（14）' },
  SPEC_NAME_15: { header: '項目名（15）' },
  SPEC_VALUE_15: { header: '内容（15）' },
  SPEC_NAME_16: { header: '項目名（16）' },
  SPEC_VALUE_16: { header: '内容（16）' },
  SPEC_NAME_17: { header: '項目名（17）' },
  SPEC_VALUE_17: { header: '内容（17）' },
  SPEC_NAME_18: { header: '項目名（18）' },
  SPEC_VALUE_18: { header: '内容（18）' },
  SPEC_NAME_19: { header: '項目名（19）' },
  SPEC_VALUE_19: { header: '内容（19）' },
  SPEC_NAME_20: { header: '項目名（20）' },
  SPEC_VALUE_20: { header: '内容（20）' },
  SPEC_NAME_21: { header: '項目名（21）' },
  SPEC_VALUE_21: { header: '内容（21）' },
  SPEC_NAME_22: { header: '項目名（22）' },
  SPEC_VALUE_22: { header: '内容（22）' },
  SPEC_NAME_23: { header: '項目名（23）' },
  SPEC_VALUE_23: { header: '内容（23）' },
  SPEC_NAME_24: { header: '項目名（24）' },
  SPEC_VALUE_24: { header: '内容（24）' },
  SPEC_NAME_25: { header: '項目名（25）' },
  SPEC_VALUE_25: { header: '内容（25）' },
  SPEC_NAME_26: { header: '項目名（26）' },
  SPEC_VALUE_26: { header: '内容（26）' },
  SPEC_NAME_27: { header: '項目名（27）' },
  SPEC_VALUE_27: { header: '内容（27）' },
  SPEC_NAME_28: { header: '項目名（28）' },
  SPEC_VALUE_28: { header: '内容（28）' },
  SPEC_NAME_29: { header: '項目名（29）' },
  SPEC_VALUE_29: { header: '内容（29）' },
  SPEC_NAME_30: { header: '項目名（30）' },
  SPEC_VALUE_30: { header: '内容（30）' },

  // 発送・重量関連（clasp run getListingSheetLatestHeaders で確認 2026-04-03）
  SHIPPING_CARRIER: { header: '発送業者' },
  SHIPPING_METHOD: { header: '発送方法' },
  ACTUAL_WEIGHT: { header: '実重量(g)' },
  DEPTH: { header: '奥行き(cm)' },
  WIDTH: { header: '幅(cm)' },
  HEIGHT: { header: '高さ(cm)' },
  VOLUMETRIC_WEIGHT: { header: '容積重量(g)' },
  APPLIED_WEIGHT: { header: '適用重量(g)' },

  // ポリシー関連（2026-04-03追加）
  SHIPPING_POLICY: { header: 'Shipping Policy' },
  RETURN_POLICY: { header: 'Return Policy' },
  PAYMENT_POLICY: { header: 'Payment Policy' },
  PROMOTED_LISTING: { header: 'Promoted Listing' },

  // 価格関連
  QUANTITY: { header: '個数' },
  PURCHASE_PRICE: { header: '仕入値(¥)' },
  SELLING_PRICE: { header: '売値($)' },
  BEST_OFFER:        { header: 'Best offer' },
  AUTO_ACCEPT_PRICE: { header: '承認価格' },
  AUTO_DECLINE_PRICE: { header: '拒否価格' },
  LOWEST_PRICE_URL: { header: '検索URL' },

  // 利益関連
  PROFIT_BEFORE_REFUND: { header: '還付抜き利益率' },  // 実質的に利益率を指す（後方互換性のため残す）
  PROFIT_RATE_BEFORE_REFUND: { header: '還付抜き利益率' },  // 明示的な利益率定義
  PROFIT_AMOUNT_BEFORE_REFUND: { header: '還付抜き利益額' },
  PROFIT_AMOUNT_AFTER_REFUND: { header: '還付込み利益額' },
  PROFIT_RATE_AFTER_REFUND: { header: '還付込み利益率' },

  // 画像関連列（DI-EG）= 25列（画像URL + 画像1-23 + ストア画像）
  IMAGE_URL: { header: '画像URL' },
  IMAGE_1: { header: '画像1' },
  IMAGE_2: { header: '画像2' },
  IMAGE_3: { header: '画像3' },
  IMAGE_4: { header: '画像4' },
  IMAGE_5: { header: '画像5' },
  IMAGE_6: { header: '画像6' },
  IMAGE_7: { header: '画像7' },
  IMAGE_8: { header: '画像8' },
  IMAGE_9: { header: '画像9' },
  IMAGE_10: { header: '画像10' },
  IMAGE_11: { header: '画像11' },
  IMAGE_12: { header: '画像12' },
  IMAGE_13: { header: '画像13' },
  IMAGE_14: { header: '画像14' },
  IMAGE_15: { header: '画像15' },
  IMAGE_16: { header: '画像16' },
  IMAGE_17: { header: '画像17' },
  IMAGE_18: { header: '画像18' },
  IMAGE_19: { header: '画像19' },
  IMAGE_20: { header: '画像20' },
  IMAGE_21: { header: '画像21' },
  IMAGE_22: { header: '画像22' },
  IMAGE_23: { header: '画像23' },
  STORE_IMAGE: { header: 'ストア画像' },

  LISTING_TIMESTAMP: { header: '出品タイムスタンプ' },
  MGMT_YEAR_MONTH: { header: '管理年月' }
};

/**
 * ツール設定シートから設定値を取得
 *
 * @returns {Object} 設定オブジェクト
 */
function getConfig() {
  const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);

  if (!settingsSheet) {
    throw new Error(`「${SHEET_NAMES.SETTINGS}」シートが見つかりません`);
  }

  // 設定値の範囲を取得
  const data = settingsSheet.getDataRange().getValues();

  if (data.length === 0) {
    throw new Error('ツール設定シートにデータがありません');
  }

  // 1行目をヘッダー行として取得
  const headerRow = data[0];

  // ヘッダー名から列インデックスをマッピング
  const columnMap = {};
  for (let i = 0; i < headerRow.length; i++) {
    const headerName = String(headerRow[i]).trim();
    if (headerName) {
      columnMap[headerName] = i;
    }
  }

  // 「項目」列と「値」列のインデックスを取得
  const itemColIndex = columnMap['項目'];
  const valueColIndex = columnMap['値'];

  if (itemColIndex === undefined || valueColIndex === undefined) {
    throw new Error('ツール設定シートに「項目」または「値」列が見つかりません');
  }

  // 設定をオブジェクトにマッピング（2行目以降がデータ行）
  const config = {};

  for (let i = 1; i < data.length; i++) {
    const key = data[i][itemColIndex];   // 「項目」列: 項目名
    const value = data[i][valueColIndex]; // 「値」列: 値

    if (key) {
      // USER_TOKENは値が空でも設定に含める
      if (key === 'USER_TOKEN') {
        config[key] = value || '';
      } else if (value) {
        config[key] = value;
      }
    }
  }

  return config;
}

/**
 * スプレッドシートURLからIDを抽出
 *
 * @param {string} urlOrId URL または ID
 * @returns {string} スプレッドシートID
 */
function extractSpreadsheetId(urlOrId) {
  if (!urlOrId) {
    return '';
  }

  // すでにIDの場合（URLでない場合）はそのまま返す
  if (urlOrId.indexOf('/') === -1 && urlOrId.indexOf('https') === -1) {
    return urlOrId;
  }

  // URLからIDを抽出
  // https://docs.google.com/spreadsheets/d/{ID}/edit...
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return urlOrId;
}

/**
 * eBay API設定を取得
 *
 * @returns {Object} eBay API設定
 */
function getEbayConfig() {
  const config = getConfig();

  return {
    appId: config['App ID'] || '',
    certId: config['Cert ID'] || '',
    devId: config['Dev ID'] || '',
    isSandbox: false, // 常に本番環境を使用
    imageFolderUrl: config['画像フォルダ'] || '',
    listingSpreadsheetId: extractSpreadsheetId(config['出品シート']) || '',
    categoryMasterSpreadsheetId: extractSpreadsheetId(config['カテゴリマスタ']) || '',
    storeImageUrl: config['ストア画像'] || '',
    userToken: config['USER_TOKEN'] || '',

    // eBay APIエンドポイント
    getApiEndpoint: function() {
      return this.isSandbox
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
    },

    // OAuth 2.0 Token URL
    getTokenUrl: function() {
      return this.isSandbox
        ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
        : 'https://api.ebay.com/identity/v1/oauth2/token';
    },

    // Browse API エンドポイント
    getBrowseApiUrl: function() {
      const baseUrl = this.getApiEndpoint();
      return `${baseUrl}/buy/browse/v1`;
    }
  };
}

/**
 * OAuth 2.0トークンを取得
 *
 * @returns {string} アクセストークン
 */
function getOAuthToken() {
  const config = getEbayConfig();

  // ツール設定シートにUSER_TOKENが設定されていればそれを使用（最優先）
  if (config.userToken && config.userToken.trim() !== '') {
    Logger.log('ツール設定シートのUSER_TOKENを使用します');
    return config.userToken;
  }

  const scriptProperties = PropertiesService.getScriptProperties();

  // キャッシュされたトークンを確認
  let token = scriptProperties.getProperty('EBAY_ACCESS_TOKEN');
  const tokenExpiry = scriptProperties.getProperty('EBAY_TOKEN_EXPIRY');

  // トークンが有効期限内であれば返す
  if (token && tokenExpiry && new Date().getTime() < parseInt(tokenExpiry)) {
    Logger.log('キャッシュされたトークンを使用します');
    return token;
  }

  // ✅ 修正：App ID / Cert IDの事前確認
  if (!config.appId || config.appId.trim() === '') {
    throw new Error(
      'eBay API設定が不完全です。\n\n' +
      'ツール設定シートで「App ID」を設定してください。\n\n' +
      '設定後、初期設定ボタンから completeInitialSetup() を再実行してください。'
    );
  }

  if (!config.certId || config.certId.trim() === '') {
    throw new Error(
      'eBay API設定が不完全です。\n\n' +
      'ツール設定シートで「Cert ID」を設定してください。\n\n' +
      '設定後、初期設定ボタンから completeInitialSetup() を再実行してください。'
    );
  }

  // 新しいトークンを取得（client_credentials）
  Logger.log('client_credentialsで新しいトークンを取得します');
  const credentials = Utilities.base64Encode(config.appId + ':' + config.certId);
  const tokenUrl = config.getTokenUrl();

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: {
      'grant_type': 'client_credentials',
      'scope': 'https://api.ebay.com/oauth/api_scope'
    },
    muteHttpExceptions: true // ✅ 追加：エラーレスポンスを取得可能に
  };

  try {
    const response = UrlFetchApp.fetch(tokenUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    // ✅ 修正：HTTPステータスコード確認
    if (statusCode !== 200) {
      Logger.log('トークン取得API エラー: ' + statusCode + ' - ' + responseText);
      throw new Error(
        'eBay APIトークンの取得に失敗しました（HTTP ' + statusCode + '）\n\n' +
        '以下を確認してください:\n' +
        '1. App ID / Cert ID が正しいか\n' +
        '2. eBay Developer Accountが有効か\n' +
        '3. Sandbox設定が正しいか（本番: false, テスト: true）\n\n' +
        'エラー詳細:\n' + responseText.substring(0, 200)
      );
    }

    const result = JSON.parse(responseText);
    token = result.access_token;
    const expiresIn = result.expires_in; // 秒単位
    const expiryTime = new Date().getTime() + (expiresIn * 1000);

    // トークンをキャッシュ
    scriptProperties.setProperty('EBAY_ACCESS_TOKEN', token);
    scriptProperties.setProperty('EBAY_TOKEN_EXPIRY', expiryTime.toString());

    Logger.log('新しいOAuthトークンを取得しました（有効期限: ' + expiresIn + '秒）');
    return token;

  } catch (error) {
    Logger.log('OAuthトークン取得エラー: ' + error.toString());

    // ✅ 修正：詳細なエラーメッセージ
    if (error.message && error.message.indexOf('eBay API') !== -1) {
      // 既にカスタムエラーメッセージの場合はそのまま再スロー
      throw error;
    } else {
      // その他のエラー（ネットワークエラー等）
      throw new Error(
        'eBay APIトークンの取得中にエラーが発生しました。\n\n' +
        'エラー内容:\n' + error.toString() + '\n\n' +
        '対処方法:\n' +
        '1. ツール設定シートのApp ID / Cert IDを確認\n' +
        '2. インターネット接続を確認\n' +
        '3. 初期設定ボタンから completeInitialSetup() を再実行'
      );
    }
  }
}

/**
 * トークンをクリア（デバッグ用）
 */
function clearOAuthToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteProperty('EBAY_ACCESS_TOKEN');
  scriptProperties.deleteProperty('EBAY_TOKEN_EXPIRY');
  Logger.log('OAuthトークンをクリアしました');
}

/**
 * 設定値をログ出力（デバッグ用）
 */
function logConfig() {
  const config = getEbayConfig();

  Logger.log('=== eBay API設定 ===');
  Logger.log('App ID: ' + config.appId);
  Logger.log('Cert ID: ' + (config.certId ? '設定済み' : '未設定'));
  Logger.log('Dev ID: ' + config.devId);
  Logger.log('Sandbox: ' + config.isSandbox);
  Logger.log('画像フォルダ: ' + config.imageFolderUrl);
  Logger.log('API Endpoint: ' + config.getApiEndpoint());
  Logger.log('Token URL: ' + config.getTokenUrl());
}

/**
 * 設定値の検証
 *
 * @returns {Object} 検証結果 { isValid: boolean, errors: string[] }
 */
function validateConfig() {
  const config = getEbayConfig();
  const errors = [];

  if (!config.appId) {
    errors.push('App ID が設定されていません');
  }

  if (!config.certId) {
    errors.push('Cert ID が設定されていません');
  }

  if (!config.devId) {
    errors.push('Dev ID が設定されていません');
  }

  if (!config.imageFolderUrl) {
    errors.push('画像フォルダが設定されていません');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}
