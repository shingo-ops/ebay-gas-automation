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

    // リクエストボディ（InitialOAuth.gsと同じscopeを使用）
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      'https://api.ebay.com/oauth/api_scope/sell.marketing',
      'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.finances'
    ].join(' ');

    const payload = {
      'grant_type': 'refresh_token',
      'refresh_token': config.refreshToken,
      'scope': scopes
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

    // キャッシュを無効化（新しいトークンが次の getConfig() で読み込まれるよう）
    invalidateConfigCache();

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

    // ヘッダー行から「値」列を動的に特定
    const headerRow = data[0];
    const valueColIdx = headerRow.findIndex(function(h) { return String(h || '').trim() === '値'; });
    if (valueColIdx === -1) {
      throw new Error('ツール設定シートに「値」列が見つかりません。');
    }

    // User Token行を探して更新
    for (let i = 0; i < data.length; i++) {
      const key = data[i][0];

      if (key === 'User Token') {
        settingsSheet.getRange(i + 1, valueColIdx + 1).setValue(accessToken);
        Logger.log('User Token更新: 行' + (i + 1));
      }

      if (key === 'Token Expiry') {
        settingsSheet.getRange(i + 1, valueColIdx + 1).setValue(expiryDate.toISOString());
        Logger.log('Token Expiry更新（ISO 8601形式）: 行' + (i + 1) + ' = ' + expiryDate.toISOString());
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
 * @param {string} spreadsheetId スプレッドシートID
 * @returns {boolean} 期限切れならtrue
 */
function isTokenExpired(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const config = getConfig();
    const expiryStr = config['Token Expiry'];

    if (!expiryStr) {
      Logger.log('⚠️ Token Expiryが設定されていません');
      return true; // 期限不明なら期限切れとして扱う
    }

    const expiryDate = new Date(expiryStr);

    // パース失敗チェック
    if (isNaN(expiryDate.getTime())) {
      Logger.log('⚠️ Token Expiryのパースに失敗: ' + expiryStr);
      Logger.log('→ 期限切れとして扱います（再認証が必要）');
      return true; // 期限切れとして扱う
    }

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
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * トークンを自動更新（必要に応じて）
 *
 * @param {string} spreadsheetId スプレッドシートID
 * @returns {boolean} 更新が必要だった場合true
 */
function autoRefreshTokenIfNeeded(spreadsheetId) {
  if (isTokenExpired(spreadsheetId)) {
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

/**
 * デバッグ用: トークン状態を確認
 *
 * @param {string} spreadsheetId スプレッドシートID
 */
function debugTokenStatus(spreadsheetId) {
  try {
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const config = getConfig();
    const expiryStr = config['Token Expiry'];
    const userToken = config['User Token'];
    const refreshToken = config['Refresh Token'];

    Logger.log('=== トークン状態確認 ===');
    Logger.log('');

    // User Token
    if (userToken) {
      Logger.log('✅ User Token: ' + userToken.substring(0, 30) + '...');
    } else {
      Logger.log('❌ User Token: 未設定');
    }

    // Refresh Token
    if (refreshToken) {
      Logger.log('✅ Refresh Token: ' + refreshToken.substring(0, 30) + '...');
    } else {
      Logger.log('❌ Refresh Token: 未設定');
    }

    // Token Expiry
    Logger.log('');
    Logger.log('Token Expiry（保存値）: ' + (expiryStr || '未設定'));

    if (expiryStr) {
      const expiryDate = new Date(expiryStr);

      if (isNaN(expiryDate.getTime())) {
        Logger.log('❌ Token Expiryのパースに失敗');
        Logger.log('   → ISO 8601形式で再保存が必要です');
      } else {
        const now = new Date();
        const diff = expiryDate.getTime() - now.getTime();
        const diffMinutes = Math.floor(diff / 1000 / 60);

        Logger.log('有効期限: ' + expiryDate.toLocaleString('ja-JP'));
        Logger.log('現在時刻: ' + now.toLocaleString('ja-JP'));
        Logger.log('');

        if (diffMinutes > 5) {
          Logger.log('✅ トークンは有効です（残り ' + diffMinutes + '分）');
        } else if (diffMinutes > 0) {
          Logger.log('⚠️ トークンはまもなく期限切れです（残り ' + diffMinutes + '分）');
        } else {
          Logger.log('❌ トークンは期限切れです（' + Math.abs(diffMinutes) + '分前に失効）');
        }
      }
    }

    Logger.log('');
    Logger.log('======================');

    return {
      hasUserToken: !!userToken,
      hasRefreshToken: !!refreshToken,
      hasExpiry: !!expiryStr,
      expiryStr: expiryStr,
      isExpired: isTokenExpired(spreadsheetId)
    };

  } catch (error) {
    Logger.log('❌ トークン状態確認エラー: ' + error.toString());
    return null;
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}
