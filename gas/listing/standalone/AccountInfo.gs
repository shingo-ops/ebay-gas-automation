/**
 * AccountInfo.gs
 *
 * eBayアカウント情報を取得してツール設定シートに書き込む
 *
 * 使用API:
 *   - Trading API  GetUser         → 出品所在地・郵便番号・eBayユーザーID
 *   - Account API  /subscription   → ストアプラン
 */

/**
 * アカウント情報取得（containerから呼び出す）
 *
 * @param {string} spreadsheetId
 * @returns {{ success: boolean, message: string }}
 */
function menuFetchAccountInfo(spreadsheetId) {
  try {
    autoRefreshTokenIfNeeded(spreadsheetId);

    const result = _fetchAndWriteAccountInfo(spreadsheetId);

    return {
      success: true,
      message: '✅ アカウント情報を取得しました\n\n' +
               'eBayユーザーID : ' + result.userId    + '\n' +
               '出品所在地     : ' + result.location  + '\n' +
               '郵便番号       : ' + result.postalCode + '\n' +
               'ストアプラン   : ' + result.storePlan
    };
  } catch (e) {
    Logger.log('menuFetchAccountInfo エラー: ' + e.toString());
    return {
      success: false,
      message: '❌ アカウント情報取得エラー:\n' + e.toString()
    };
  }
}

// ─────────────────────────────────────────────────────────────
// プライベート
// ─────────────────────────────────────────────────────────────

function _fetchAndWriteAccountInfo(spreadsheetId) {
  // 常にIDを再セット（token refresh が CURRENT_SPREADSHEET_ID を null にリセットするため）
  if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

  const userInfo  = _getUserInfoFromTradingApi();
  const storePlan = _getStorePlanFromAccountApi();

  const ss    = getTargetSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) throw new Error('ツール設定シートが見つかりません');

  _writeToSettingsSheet(sheet, {
    '出品所在地':      userInfo.location,
    '郵便番号':        userInfo.postalCode,
    'eBayユーザーID':  userInfo.userId,
    'ストアプラン':    storePlan
  });

  Logger.log('✅ アカウント情報をツール設定シートに書き込みました');

  return {
    userId:     userInfo.userId,
    location:   userInfo.location,
    postalCode: userInfo.postalCode,
    storePlan:  storePlan
  };
}

/**
 * Trading API GetUser でユーザー情報取得
 */
function _getUserInfoFromTradingApi() {
  const token  = getUserToken();
  const config = getEbayConfig();
  const apiUrl = getTradingApiUrl();

  const xmlBody =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
      '<RequesterCredentials>' +
        '<eBayAuthToken>' + escapeXml(token) + '</eBayAuthToken>' +
      '</RequesterCredentials>' +
      '<DetailLevel>ReturnAll</DetailLevel>' +
    '</GetUserRequest>';

  const options = {
    method: 'post',
    headers: {
      'X-EBAY-API-SITEID':              '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_API_VERSION,
      'X-EBAY-API-CALL-NAME':           'GetUser',
      'X-EBAY-API-APP-NAME':            config.appId,
      'X-EBAY-API-DEV-NAME':            config.devId,
      'X-EBAY-API-CERT-NAME':           config.certId,
      'Content-Type':                   'text/xml;charset=utf-8'
    },
    payload: xmlBody,
    muteHttpExceptions: true
  };

  const response     = UrlFetchApp.fetch(apiUrl, options);
  const statusCode   = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode !== 200) {
    throw new Error('GetUser HTTPエラー(' + statusCode + ')');
  }

  const root = XmlService.parse(responseText).getRootElement();
  const ns   = XmlService.getNamespace('urn:ebay:apis:eBLBaseComponents');

  const ack = _childText(root, 'Ack', ns);
  if (ack !== 'Success' && ack !== 'Warning') {
    const errEl = root.getChild('Errors', ns);
    const msg   = errEl ? _childText(errEl, 'ShortMessage', ns) : responseText;
    throw new Error('GetUser APIエラー: ' + msg);
  }

  const userEl = root.getChild('User', ns);
  if (!userEl) throw new Error('GetUser レスポンスに User 要素がありません');

  const userId  = _childText(userEl, 'UserID', ns);
  const addrEl  = userEl.getChild('RegistrationAddress', ns);
  const city    = addrEl ? _childText(addrEl, 'CityName',   ns) : '';
  const postal  = addrEl ? _childText(addrEl, 'PostalCode', ns) : '';
  const country = addrEl ? _childText(addrEl, 'Country',    ns) : '';

  // Location: CityName → Country → 'Japan' の優先順
  const location = city || country || 'Japan';

  Logger.log('GetUser: userId=' + userId + ' location=' + location + ' postalCode=' + postal);

  return { userId: userId, location: location, postalCode: postal };
}

/**
 * Account API /subscription でストアプランを取得
 */
function _getStorePlanFromAccountApi() {
  try {
    const token  = getUserToken();
    const apiUrl = 'https://api.ebay.com/sell/account/v1/subscription';

    const response   = UrlFetchApp.fetch(apiUrl, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json'
      },
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      Logger.log('⚠️ Subscription APIエラー(' + statusCode + ')。ストアプランを空にします。');
      return '';
    }

    const data = JSON.parse(response.getContentText());
    const subs = data.subscriptions || [];

    // EBAY_STORE タイプのサブスクリプションを探す
    for (let i = 0; i < subs.length; i++) {
      if (subs[i].subscriptionType === 'EBAY_STORE') {
        Logger.log('ストアプラン: ' + subs[i].subscriptionLevel);
        return subs[i].subscriptionLevel;
      }
    }

    Logger.log('ストアプランなし（ストア未加入）');
    return '（なし）';

  } catch (e) {
    Logger.log('⚠️ ストアプラン取得エラー: ' + e.toString());
    return '';
  }
}

/**
 * ツール設定シートのA列をスキャンし、キー一致行のB列に値を書き込む
 *
 * @param {Sheet}  sheet
 * @param {Object} keyValueMap  { 'A列の値': '書き込む値', ... }
 */
function _writeToSettingsSheet(sheet, keyValueMap) {
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    if (Object.prototype.hasOwnProperty.call(keyValueMap, key)) {
      sheet.getRange(i + 1, 2).setValue(keyValueMap[key]);
      Logger.log('ツール設定書き込み: ' + key + ' = ' + keyValueMap[key]);
    }
  }
}

/**
 * XML要素の子テキストを安全に取得
 */
function _childText(parent, name, ns) {
  const el = parent.getChild(name, ns);
  return el ? el.getText() : '';
}
