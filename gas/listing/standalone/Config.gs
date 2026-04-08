/**
 * 設定管理
 *
 * eBay API の認証情報と設定を管理します
 */

/**
 * 設定オブジェクト
 * 注意: 本番環境では、これらの値をスクリプトプロパティに保存してください
 */
const CONFIG = {
  // eBay API 認証情報（必須）
  EBAY_CLIENT_ID: 'YOUR_CLIENT_ID_HERE',
  EBAY_CLIENT_SECRET: 'YOUR_CLIENT_SECRET_HERE',

  // 環境設定
  EBAY_ENVIRONMENT: 'SANDBOX', // 'SANDBOX' または 'PRODUCTION'

  // マーケットプレイス設定
  EBAY_MARKETPLACE_ID: 'EBAY_US', // EBAY_US, EBAY_GB, EBAY_DE など

  // API エンドポイント
  SANDBOX_BASE_URL: 'https://api.sandbox.ebay.com',
  PRODUCTION_BASE_URL: 'https://api.ebay.com',

  // OAuth エンドポイント
  SANDBOX_OAUTH_URL: 'https://auth.sandbox.ebay.com/oauth2/authorize',
  PRODUCTION_OAUTH_URL: 'https://auth.ebay.com/oauth2/authorize',
  SANDBOX_TOKEN_URL: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
  PRODUCTION_TOKEN_URL: 'https://api.ebay.com/identity/v1/oauth2/token',

  // OAuth スコープ
  OAUTH_SCOPES: [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly'
  ],

  // タイムアウトとリトライ設定
  REQUEST_TIMEOUT: 30000, // ミリ秒
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ミリ秒

  // レート制限
  RATE_LIMIT_DELAY: 100, // API呼び出し間の遅延（ミリ秒）

  // キャッシュ設定
  CACHE_EXPIRATION: 3600, // 秒（1時間）

  // シート名
  SHEET_NAMES: {
    PRODUCTS: '商品マスタ',
    ORDERS: '注文管理',
    INVENTORY: '在庫',
    SETTINGS: '設定',
    LOGS: 'ログ'
  }
};

/**
 * 設定を取得
 * @returns {Object} 設定オブジェクト
 */
function getConfig() {
  // スクリプトプロパティから設定を取得（本番環境用）
  const properties = PropertiesService.getScriptProperties();
  const clientId = properties.getProperty('EBAY_CLIENT_ID');
  const clientSecret = properties.getProperty('EBAY_CLIENT_SECRET');

  // スクリプトプロパティに値がある場合はそちらを優先
  if (clientId && clientSecret) {
    CONFIG.EBAY_CLIENT_ID = clientId;
    CONFIG.EBAY_CLIENT_SECRET = clientSecret;
  }

  return CONFIG;
}

/**
 * 設定を保存（スクリプトプロパティに保存）
 * @param {string} clientId - eBay Client ID
 * @param {string} clientSecret - eBay Client Secret
 * @param {string} environment - 'SANDBOX' または 'PRODUCTION'
 * @param {string} marketplaceId - マーケットプレイスID
 */
function saveConfig(clientId, clientSecret, environment, marketplaceId) {
  const properties = PropertiesService.getScriptProperties();

  if (clientId) {
    properties.setProperty('EBAY_CLIENT_ID', clientId);
  }

  if (clientSecret) {
    properties.setProperty('EBAY_CLIENT_SECRET', clientSecret);
  }

  if (environment) {
    properties.setProperty('EBAY_ENVIRONMENT', environment);
    CONFIG.EBAY_ENVIRONMENT = environment;
  }

  if (marketplaceId) {
    properties.setProperty('EBAY_MARKETPLACE_ID', marketplaceId);
    CONFIG.EBAY_MARKETPLACE_ID = marketplaceId;
  }

  Logger.log('設定を保存しました');
}

/**
 * 設定をクリア
 */
function clearConfig() {
  const properties = PropertiesService.getScriptProperties();
  properties.deleteProperty('EBAY_CLIENT_ID');
  properties.deleteProperty('EBAY_CLIENT_SECRET');
  properties.deleteProperty('EBAY_ENVIRONMENT');
  properties.deleteProperty('EBAY_MARKETPLACE_ID');

  Logger.log('設定をクリアしました');
}

/**
 * 現在の環境に応じたベースURLを取得
 * @returns {string} ベースURL
 */
function getBaseUrl() {
  const config = getConfig();
  return config.EBAY_ENVIRONMENT === 'PRODUCTION'
    ? config.PRODUCTION_BASE_URL
    : config.SANDBOX_BASE_URL;
}

/**
 * OAuth トークン URL を取得
 * @returns {string} トークン URL
 */
function getTokenUrl() {
  const config = getConfig();
  return config.EBAY_ENVIRONMENT === 'PRODUCTION'
    ? config.PRODUCTION_TOKEN_URL
    : config.SANDBOX_TOKEN_URL;
}

/**
 * OAuth 認証 URL を取得
 * @returns {string} 認証 URL
 */
function getAuthUrl() {
  const config = getConfig();
  return config.EBAY_ENVIRONMENT === 'PRODUCTION'
    ? config.PRODUCTION_OAUTH_URL
    : config.SANDBOX_OAUTH_URL;
}

/**
 * 設定の検証
 * @returns {Object} 検証結果 { valid: boolean, errors: string[] }
 */
function validateConfig() {
  const config = getConfig();
  const errors = [];

  if (!config.EBAY_CLIENT_ID || config.EBAY_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    errors.push('eBay Client ID が設定されていません');
  }

  if (!config.EBAY_CLIENT_SECRET || config.EBAY_CLIENT_SECRET === 'YOUR_CLIENT_SECRET_HERE') {
    errors.push('eBay Client Secret が設定されていません');
  }

  if (!['SANDBOX', 'PRODUCTION'].includes(config.EBAY_ENVIRONMENT)) {
    errors.push('無効な環境設定です（SANDBOX または PRODUCTION を指定してください）');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * 設定情報を表示（デバッグ用）
 */
function showConfigInfo() {
  const config = getConfig();
  const validation = validateConfig();

  Logger.log('=== eBay API 設定情報 ===');
  Logger.log('Client ID: ' + (config.EBAY_CLIENT_ID.substring(0, 10) + '...'));
  Logger.log('環境: ' + config.EBAY_ENVIRONMENT);
  Logger.log('マーケットプレイス: ' + config.EBAY_MARKETPLACE_ID);
  Logger.log('ベースURL: ' + getBaseUrl());
  Logger.log('検証結果: ' + (validation.valid ? '✓ OK' : '✗ エラー'));

  if (!validation.valid) {
    Logger.log('エラー内容:');
    validation.errors.forEach(error => Logger.log('  - ' + error));
  }
}
