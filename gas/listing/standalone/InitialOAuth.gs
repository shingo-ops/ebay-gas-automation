/**
 * eBay OAuth 初回認証フロー
 *
 * Authorization Code フローでRefresh Tokenを取得します
 */

/**
 * ステップ1: 認証URLを生成
 *
 * このURLをユーザーに開いてもらい、eBayにサインインしてもらう
 */
function generateAuthUrl() {
  const config = getEbayConfig();

  if (!config.appId) {
    throw new Error('App IDが設定されていません');
  }

  if (!config.ruName) {
    throw new Error('RuNameが設定されていません。ツール設定シートのRuName行に値を設定してください。');
  }

  const authUrl = 'https://auth.ebay.com/oauth2/authorize?' +
    'client_id=' + encodeURIComponent(config.appId) +
    '&response_type=code' +
    '&redirect_uri=' + encodeURIComponent(config.ruName) +
    '&scope=https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.account';

  Logger.log('=== 認証URL ===');
  Logger.log(authUrl);
  Logger.log('');
  Logger.log('このURLをブラウザで開いて、eBayにサインインしてください。');
  Logger.log('リダイレクト後、URLのcode=XXXの部分をコピーしてください。');

  return authUrl;
}

/**
 * ステップ2: Authorization CodeからAccess Token + Refresh Tokenを取得
 *
 * @param {string} authorizationCode ステップ1で取得したコード
 * @returns {Object} { accessToken, refreshToken, expiresIn }
 */
function exchangeCodeForTokens(authorizationCode) {
  const config = getEbayConfig();

  if (!config.appId || !config.certId) {
    throw new Error('App ID, Cert IDが設定されていません');
  }

  if (!config.ruName) {
    throw new Error('RuNameが設定されていません。ツール設定シートのRuName行に値を設定してください。');
  }

  // Basic認証ヘッダー
  const credentials = Utilities.base64Encode(config.appId + ':' + config.certId);

  const payload = {
    'grant_type': 'authorization_code',
    'code': authorizationCode,
    'redirect_uri': config.ruName
  };

  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials
    },
    'payload': Object.keys(payload).map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]);
    }).join('&'),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch('https://api.ebay.com/identity/v1/oauth2/token', options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  Logger.log('Response Code: ' + responseCode);

  if (responseCode !== 200) {
    throw new Error('トークン取得失敗（' + responseCode + '）: ' + responseText);
  }

  const result = JSON.parse(responseText);

  Logger.log('=== トークン取得成功 ===');
  Logger.log('Access Token: ' + result.access_token.substring(0, 20) + '...');
  Logger.log('Refresh Token: ' + result.refresh_token.substring(0, 20) + '...');
  Logger.log('Expires In: ' + result.expires_in + '秒');

  // ツール設定シートに保存
  saveTokensToSheet(result.access_token, result.refresh_token, result.expires_in);

  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresIn: result.expires_in
  };
}

/**
 * トークンをシートに保存
 */
function saveTokensToSheet(accessToken, refreshToken, expiresIn) {
  const settingsSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
  const data = settingsSheet.getDataRange().getValues();

  const expiryDate = new Date();
  expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);

  for (let i = 0; i < data.length; i++) {
    const key = data[i][0];

    if (key === 'User Token') {
      settingsSheet.getRange(i + 1, 2).setValue(accessToken);
    }
    if (key === 'Refresh Token') {
      settingsSheet.getRange(i + 1, 2).setValue(refreshToken);
    }
    if (key === 'Token Expiry') {
      settingsSheet.getRange(i + 1, 2).setValue(expiryDate.toLocaleString('ja-JP'));
    }
  }

  Logger.log('✅ トークンをシートに保存しました');
}
