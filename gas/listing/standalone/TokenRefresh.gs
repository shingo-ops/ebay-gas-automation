/**
 * eBay OAuth Token 自動更新機能
 *
 * Refresh Tokenを使ってAccess Tokenを自動更新します
 */

/**
 * Access Tokenを更新
 *
 * @param {string} spreadsheetId スプレッドシートID
 * @returns {Object} { success: boolean, accessToken?: string, expiresIn?: number, error?: string }
 */
function refreshEbayAccessToken(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const config = getEbayConfig();

    // 必須項目チェック
    if (!config.appId || !config.certId || !config.refreshToken) {
      return {
        success: false,
        error: 'App ID, Cert ID, Refresh Tokenが設定されていません'
      };
    }

    Logger.log('=== Access Token更新開始 ===');

    // Basic認証ヘッダー作成（App ID:Cert ID を Base64エンコード）
    const credentials = Utilities.base64Encode(config.appId + ':' + config.certId);

    // リクエストボディ
    const payload = {
      'grant_type': 'refresh_token',
      'refresh_token': config.refreshToken,
      'scope': 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.account'
    };

    // HTTPリクエスト設定
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

    // トークン更新リクエスト
    const response = UrlFetchApp.fetch('https://api.ebay.com/identity/v1/oauth2/token', options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('Response Code: ' + responseCode);
    Logger.log('Response: ' + responseText);

    if (responseCode !== 200) {
      return {
        success: false,
        error: 'トークン更新失敗（' + responseCode + '）: ' + responseText
      };
    }

    const result = JSON.parse(responseText);

    // 新しいAccess Tokenを取得
    const newAccessToken = result.access_token;
    const expiresIn = result.expires_in; // 秒数（通常7200 = 2時間）

    // 有効期限を計算（現在時刻 + expires_in）
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);

    Logger.log('✅ Access Token更新成功');
    Logger.log('有効期限: ' + expiryDate.toLocaleString('ja-JP'));

    // ツール設定シートを更新
    updateTokenInSheet(newAccessToken, expiryDate);

    return {
      success: true,
      accessToken: newAccessToken,
      expiresIn: expiresIn,
      expiryDate: expiryDate
    };

  } catch (error) {
    Logger.log('❌ トークン更新エラー: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * ツール設定シートのトークンを更新
 *
 * @param {string} accessToken 新しいAccess Token
 * @param {Date} expiryDate 有効期限
 */
function updateTokenInSheet(accessToken, expiryDate) {
  try {
    const settingsSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
    if (!settingsSheet) {
      throw new Error('ツール設定シートが見つかりません');
    }

    const data = settingsSheet.getDataRange().getValues();

    // User Token行を探して更新
    for (let i = 0; i < data.length; i++) {
      const key = data[i][0];

      if (key === 'User Token') {
        settingsSheet.getRange(i + 1, 2).setValue(accessToken);
        Logger.log('User Token更新: 行' + (i + 1));
      }

      if (key === 'Token Expiry') {
        settingsSheet.getRange(i + 1, 2).setValue(expiryDate.toLocaleString('ja-JP'));
        Logger.log('Token Expiry更新: 行' + (i + 1));
      }
    }

    Logger.log('✅ シート更新完了');

  } catch (error) {
    Logger.log('⚠️ シート更新エラー: ' + error.toString());
  }
}

/**
 * トークンの有効期限をチェック
 *
 * @returns {boolean} 期限切れならtrue
 */
function isTokenExpired() {
  try {
    const config = getConfig();
    const expiryStr = config['Token Expiry'];

    if (!expiryStr) {
      Logger.log('⚠️ Token Expiryが設定されていません');
      return true; // 期限不明なら期限切れとして扱う
    }

    const expiryDate = new Date(expiryStr);
    const now = new Date();

    // 5分前に期限切れとして扱う（余裕を持たせる）
    const bufferTime = 5 * 60 * 1000; // 5分
    const isExpired = (expiryDate.getTime() - now.getTime()) < bufferTime;

    if (isExpired) {
      Logger.log('⚠️ トークンが期限切れです: ' + expiryDate.toLocaleString('ja-JP'));
    } else {
      Logger.log('✅ トークンは有効です: ' + expiryDate.toLocaleString('ja-JP'));
    }

    return isExpired;

  } catch (error) {
    Logger.log('⚠️ 期限チェックエラー: ' + error.toString());
    return true; // エラー時は期限切れとして扱う
  }
}

/**
 * トークンを自動更新（必要に応じて）
 *
 * @param {string} spreadsheetId スプレッドシートID
 * @returns {boolean} 更新が必要だった場合true
 */
function autoRefreshTokenIfNeeded(spreadsheetId) {
  if (isTokenExpired()) {
    Logger.log('トークンの自動更新を開始します...');
    const result = refreshEbayAccessToken(spreadsheetId);

    if (result.success) {
      Logger.log('✅ トークン自動更新成功');
      return true;
    } else {
      Logger.log('❌ トークン自動更新失敗: ' + result.error);
      throw new Error('トークン自動更新に失敗しました: ' + result.error);
    }
  }

  return false; // 更新不要だった
}
