/**
 * OAuth 認証処理
 *
 * eBay API の OAuth 2.0 認証を管理します
 */

/**
 * アクセストークンを取得
 * @returns {string|null} アクセストークン
 */
function getAccessToken() {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty('EBAY_ACCESS_TOKEN');
  const expiry = properties.getProperty('EBAY_TOKEN_EXPIRY');

  // トークンが存在し、有効期限内の場合は返す
  if (token && expiry) {
    const expiryTime = new Date(expiry).getTime();
    const now = new Date().getTime();

    if (now < expiryTime) {
      return token;
    }

    Logger.log('トークンの有効期限が切れています');
  }

  // トークンがない、または期限切れの場合は null を返す
  return null;
}

/**
 * アクセストークンを保存
 * @param {string} token - アクセストークン
 * @param {number} expiresIn - 有効期限（秒）
 */
function saveAccessToken(token, expiresIn) {
  const properties = PropertiesService.getScriptProperties();
  const expiryTime = new Date(new Date().getTime() + (expiresIn * 1000));

  properties.setProperty('EBAY_ACCESS_TOKEN', token);
  properties.setProperty('EBAY_TOKEN_EXPIRY', expiryTime.toISOString());

  Logger.log('アクセストークンを保存しました（有効期限: ' + expiryTime + '）');
}

/**
 * トークンをクリア
 */
function clearAccessToken() {
  const properties = PropertiesService.getScriptProperties();
  properties.deleteProperty('EBAY_ACCESS_TOKEN');
  properties.deleteProperty('EBAY_TOKEN_EXPIRY');
  Logger.log('アクセストークンをクリアしました');
}

/**
 * Client Credentials Grant でトークンを取得
 * アプリケーション所有のリソースにアクセスする場合に使用
 *
 * @returns {Object} トークン情報 { access_token, expires_in, token_type }
 */
function getClientCredentialsToken() {
  const config = getConfig();
  const validation = validateConfig();

  if (!validation.valid) {
    throw new Error('設定エラー: ' + validation.errors.join(', '));
  }

  const tokenUrl = getTokenUrl();
  const credentials = Utilities.base64Encode(
    config.EBAY_CLIENT_ID + ':' + config.EBAY_CLIENT_SECRET
  );

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials
    },
    payload: {
      'grant_type': 'client_credentials',
      'scope': config.OAUTH_SCOPES.join(' ')
    },
    muteHttpExceptions: true
  };

  try {
    Logger.log('Client Credentials Grant でトークンを取得します');
    const response = UrlFetchApp.fetch(tokenUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      saveAccessToken(data.access_token, data.expires_in);
      Logger.log('トークン取得成功');
      return data;
    } else {
      Logger.log('トークン取得失敗: ' + responseCode);
      Logger.log('レスポンス: ' + responseText);
      throw new Error('トークン取得に失敗しました: ' + responseText);
    }
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
    throw error;
  }
}

/**
 * 認証コードから User Access Token を取得
 * ユーザー所有のリソースにアクセスする場合に使用
 *
 * @param {string} code - 認証コード
 * @returns {Object} トークン情報
 */
function getAuthorizationCodeToken(code) {
  const config = getConfig();
  const tokenUrl = getTokenUrl();
  const credentials = Utilities.base64Encode(
    config.EBAY_CLIENT_ID + ':' + config.EBAY_CLIENT_SECRET
  );

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials
    },
    payload: {
      'grant_type': 'authorization_code',
      'code': code,
      'redirect_uri': getRedirectUri()
    },
    muteHttpExceptions: true
  };

  try {
    Logger.log('Authorization Code Grant でトークンを取得します');
    const response = UrlFetchApp.fetch(tokenUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      saveAccessToken(data.access_token, data.expires_in);

      // リフレッシュトークンも保存
      if (data.refresh_token) {
        const properties = PropertiesService.getScriptProperties();
        properties.setProperty('EBAY_REFRESH_TOKEN', data.refresh_token);
      }

      Logger.log('トークン取得成功');
      return data;
    } else {
      Logger.log('トークン取得失敗: ' + responseCode);
      Logger.log('レスポンス: ' + responseText);
      throw new Error('トークン取得に失敗しました: ' + responseText);
    }
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
    throw error;
  }
}

/**
 * リフレッシュトークンを使用してアクセストークンを更新
 * @returns {Object} 新しいトークン情報
 */
function refreshAccessToken() {
  const properties = PropertiesService.getScriptProperties();
  const refreshToken = properties.getProperty('EBAY_REFRESH_TOKEN');

  if (!refreshToken) {
    throw new Error('リフレッシュトークンが見つかりません');
  }

  const config = getConfig();
  const tokenUrl = getTokenUrl();
  const credentials = Utilities.base64Encode(
    config.EBAY_CLIENT_ID + ':' + config.EBAY_CLIENT_SECRET
  );

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials
    },
    payload: {
      'grant_type': 'refresh_token',
      'refresh_token': refreshToken,
      'scope': config.OAUTH_SCOPES.join(' ')
    },
    muteHttpExceptions: true
  };

  try {
    Logger.log('リフレッシュトークンでアクセストークンを更新します');
    const response = UrlFetchApp.fetch(tokenUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      saveAccessToken(data.access_token, data.expires_in);
      Logger.log('トークン更新成功');
      return data;
    } else {
      Logger.log('トークン更新失敗: ' + responseCode);
      Logger.log('レスポンス: ' + responseText);
      throw new Error('トークン更新に失敗しました: ' + responseText);
    }
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
    throw error;
  }
}

/**
 * 認証 URL を生成
 * @returns {string} 認証 URL
 */
function generateAuthUrl() {
  const config = getConfig();
  const authUrl = getAuthUrl();
  const redirectUri = getRedirectUri();

  const params = {
    'client_id': config.EBAY_CLIENT_ID,
    'redirect_uri': redirectUri,
    'response_type': 'code',
    'scope': config.OAUTH_SCOPES.join(' ')
  };

  const queryString = Object.keys(params)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
    .join('&');

  return authUrl + '?' + queryString;
}

/**
 * リダイレクト URI を取得
 * @returns {string} リダイレクト URI
 */
function getRedirectUri() {
  // Google Apps Script の場合は、Web アプリとして公開した URL を使用
  // または、eBay が許可する任意の URL（例: https://localhost）
  return 'https://localhost';
}

/**
 * 認証状態をテスト
 */
function testAuthentication() {
  Logger.log('=== 認証状態テスト ===');

  const token = getAccessToken();
  if (token) {
    Logger.log('✓ アクセストークンが存在します');
    Logger.log('トークン（先頭20文字）: ' + token.substring(0, 20) + '...');

    const properties = PropertiesService.getScriptProperties();
    const expiry = properties.getProperty('EBAY_TOKEN_EXPIRY');
    Logger.log('有効期限: ' + expiry);

    const now = new Date();
    const expiryDate = new Date(expiry);
    const remainingMinutes = Math.floor((expiryDate - now) / 1000 / 60);
    Logger.log('残り時間: ' + remainingMinutes + ' 分');
  } else {
    Logger.log('✗ アクセストークンがありません');
    Logger.log('Client Credentials Grant でトークンを取得してみます...');

    try {
      const tokenData = getClientCredentialsToken();
      Logger.log('✓ トークン取得成功');
      Logger.log('有効期限（秒）: ' + tokenData.expires_in);
    } catch (error) {
      Logger.log('✗ トークン取得失敗: ' + error.message);
    }
  }
}
