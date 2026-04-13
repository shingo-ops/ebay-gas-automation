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

  // 必要な全scopeを含める
  const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.finances'
  ].join(' ');

  const authUrl = 'https://auth.ebay.com/oauth2/authorize?' +
    'client_id=' + encodeURIComponent(config.appId) +
    '&response_type=code' +
    '&redirect_uri=' + encodeURIComponent(config.ruName) +
    '&scope=' + encodeURIComponent(scopes);

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

  // Authorization Codeは既にURL-encodedなので、デコードしてから再エンコード
  // または、特殊な値のみエンコードしない
  const payload = {
    'grant_type': 'authorization_code',
    'code': authorizationCode,  // 既にURL-encoded
    'redirect_uri': config.ruName  // RuName値はそのまま
  };

  // payloadを手動で構築（authorizationCodeとRuNameはエンコードしない）
  const payloadString =
    'grant_type=' + encodeURIComponent(payload.grant_type) +
    '&code=' + authorizationCode +  // 既にエンコード済みなので再エンコードしない
    '&redirect_uri=' + config.ruName;  // RuNameはそのまま使用

  Logger.log('Payload: ' + payloadString);

  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials
    },
    'payload': payloadString,
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
  Logger.log('Access Token有効期限: ' + result.expires_in + '秒（2時間）');
  Logger.log('Refresh Token有効期限: ' + result.refresh_token_expires_in + '秒（約18ヶ月）');

  // ツール設定シートに保存
  saveTokensToSheet(
    result.access_token,
    result.refresh_token,
    result.expires_in,
    result.refresh_token_expires_in
  );

  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresIn: result.expires_in,
    refreshTokenExpiresIn: result.refresh_token_expires_in
  };
}

/**
 * トークンをシートに保存
 */
function saveTokensToSheet(accessToken, refreshToken, expiresIn, refreshTokenExpiresIn) {
  const settingsSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
  const data = settingsSheet.getDataRange().getValues();

  // ヘッダー行から「値」列を動的に特定
  const headerRow = data[0];
  const valueColIdx = headerRow.findIndex(function(h) { return String(h || '').trim() === '値'; });
  if (valueColIdx === -1) {
    throw new Error('ツール設定シートに「値」列が見つかりません。');
  }

  // Access Token有効期限
  const accessExpiryDate = new Date();
  accessExpiryDate.setSeconds(accessExpiryDate.getSeconds() + expiresIn);

  // Refresh Token有効期限（約18ヶ月後）
  const refreshExpiryDate = new Date();
  if (refreshTokenExpiresIn) {
    refreshExpiryDate.setSeconds(refreshExpiryDate.getSeconds() + refreshTokenExpiresIn);
  }

  for (let i = 0; i < data.length; i++) {
    const key = data[i][0];

    if (key === 'User Token') {
      settingsSheet.getRange(i + 1, valueColIdx + 1).setValue(accessToken);
    }
    if (key === 'Refresh Token') {
      settingsSheet.getRange(i + 1, valueColIdx + 1).setValue(refreshToken);
    }
    if (key === 'Token Expiry') {
      settingsSheet.getRange(i + 1, valueColIdx + 1).setValue(accessExpiryDate.toISOString());
    }
    if (key === 'Refresh Token Expiry' && refreshTokenExpiresIn) {
      settingsSheet.getRange(i + 1, valueColIdx + 1).setValue(refreshExpiryDate.toISOString());
      Logger.log('Refresh Token Expiry: ' + refreshExpiryDate.toISOString() + '（' +
                 refreshExpiryDate.toLocaleString('ja-JP') + '）');
    }
  }

  Logger.log('✅ トークンをシートに保存しました');
  Logger.log('Access Token有効期限: ' + accessExpiryDate.toLocaleString('ja-JP'));
  if (refreshTokenExpiresIn) {
    Logger.log('Refresh Token有効期限: ' + refreshExpiryDate.toLocaleString('ja-JP') + '（約18ヶ月後）');
  }
}
