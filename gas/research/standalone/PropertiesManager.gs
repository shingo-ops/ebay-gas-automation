/**
 * PropertiesManager.gs — PropertiesService 委譲レイヤー
 *
 * 設計原則:
 *   ライブラリは PropertiesService を直接呼ばない。
 *   バインドスクリプトが propsData (plain object) を引数として渡し、
 *   ライブラリは変更内容を newProps として返す。
 *   null 値 = deleteProperty の指示。
 *
 * バインドスクリプト側の書き戻しヘルパー（bind/Menu.gs に実装予定）:
 *   function applyNewProps_(scriptProps, newProps) {
 *     if (!newProps) return;
 *     Object.keys(newProps).forEach(function(key) {
 *       if (newProps[key] === null) {
 *         scriptProps.deleteProperty(key);
 *       } else {
 *         scriptProps.setProperty(key, newProps[key]);
 *       }
 *     });
 *   }
 */

// ─────────────────────────────────────────────
// OAuth トークン管理
// ─────────────────────────────────────────────

/**
 * OAuthアクセストークンを取得する。
 * キャッシュが有効であればキャッシュから返す。
 * 期限切れの場合は client_credentials フローで新規取得し newProps に返す。
 *
 * @param {Object} propsData - バインドスクリプト側 ScriptProperties の plain object
 * @param {Object} ebayConfig - { appId, certId, isSandbox, userToken? } を含むeBay設定
 * @returns {{ success: boolean, token?: string, newProps?: Object, error?: string }}
 */
function getOAuthTokenSA(propsData, ebayConfig) {
  try {
    // USER_TOKEN が設定されていれば最優先で使用（新規取得不要）
    if (ebayConfig.userToken && ebayConfig.userToken.trim() !== '') {
      Logger.log('USER_TOKENを使用します');
      return { success: true, token: ebayConfig.userToken };
    }

    // キャッシュ確認
    var token = propsData['EBAY_ACCESS_TOKEN'] || null;
    var expiry = propsData['EBAY_TOKEN_EXPIRY'] || null;

    if (token && expiry && new Date().getTime() < parseInt(expiry, 10)) {
      Logger.log('キャッシュされたOAuthトークンを使用します');
      return { success: true, token: token };
    }

    // App ID / Cert ID の事前確認
    if (!ebayConfig.appId || ebayConfig.appId.trim() === '') {
      return {
        success: false,
        error: 'eBay API設定が不完全です。ツール設定シートで「App ID」を設定してください。'
      };
    }
    if (!ebayConfig.certId || ebayConfig.certId.trim() === '') {
      return {
        success: false,
        error: 'eBay API設定が不完全です。ツール設定シートで「Cert ID」を設定してください。'
      };
    }

    // 新しいトークンを取得（client_credentials）
    Logger.log('client_credentials で新しいOAuthトークンを取得します');
    var credentials = Utilities.base64Encode(ebayConfig.appId + ':' + ebayConfig.certId);
    var tokenUrl = ebayConfig.isSandbox
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

    var options = {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + credentials,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(tokenUrl, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log('トークン取得APIエラー: ' + statusCode + ' - ' + responseText);
      return {
        success: false,
        error: 'eBay APIトークンの取得に失敗しました（HTTP ' + statusCode + '）\n' +
               'App ID / Cert ID を確認してください。\n詳細: ' + responseText.substring(0, 200)
      };
    }

    var result = JSON.parse(responseText);
    token = result.access_token;
    var expiresIn = result.expires_in;
    var expiryTime = new Date().getTime() + (expiresIn * 1000);

    Logger.log('新しいOAuthトークンを取得しました（有効期限: ' + expiresIn + '秒）');

    return {
      success: true,
      token: token,
      newProps: {
        'EBAY_ACCESS_TOKEN': token,
        'EBAY_TOKEN_EXPIRY': expiryTime.toString()
      }
    };

  } catch (error) {
    Logger.log('OAuthトークン取得エラー: ' + error.toString());
    return {
      success: false,
      error: 'OAuthトークン取得中にエラーが発生しました: ' + error.toString()
    };
  }
}

/**
 * キャッシュされたOAuthトークンを削除する。
 *
 * @returns {{ success: boolean, newProps: Object }}
 */
function clearOAuthTokenSA() {
  Logger.log('OAuthトークンをクリアします');
  return {
    success: true,
    newProps: {
      'EBAY_ACCESS_TOKEN': null,
      'EBAY_TOKEN_EXPIRY': null
    }
  };
}

// ─────────────────────────────────────────────
// 初回セットアップ フラグ管理
// ─────────────────────────────────────────────

/**
 * 初回セットアップが完了済みかどうかを確認する。
 *
 * @param {Object} propsData - バインドスクリプト側 ScriptProperties の plain object
 * @returns {{ isDone: boolean }}
 */
function checkInitialSetupSA(propsData) {
  var flag = propsData['INITIAL_SETUP_COMPLETED'] || null;
  return { isDone: flag === 'true' };
}

/**
 * 初回セットアップ完了フラグを立てる。
 *
 * @returns {{ newProps: Object }}
 */
function markInitialSetupCompleteSA() {
  return {
    newProps: { 'INITIAL_SETUP_COMPLETED': 'true' }
  };
}

/**
 * 初回セットアップ完了フラグをリセットする。
 *
 * @returns {{ newProps: Object }}
 */
function resetInitialSetupFlagSA() {
  return {
    newProps: { 'INITIAL_SETUP_COMPLETED': null }
  };
}

// ─────────────────────────────────────────────
// onEdit デバウンス タイムスタンプ管理
// ─────────────────────────────────────────────

/**
 * onEdit デバウンス用の最終実行タイムスタンプを取得する。
 *
 * @param {Object} propsData - バインドスクリプト側 ScriptProperties の plain object
 * @returns {number} タイムスタンプ（ms）。未設定の場合は 0。
 */
function getDebounceLastRunSA(propsData) {
  var val = propsData['HANDLE_EDIT_LAST_RUN'] || null;
  return val ? parseInt(val, 10) : 0;
}

/**
 * onEdit デバウンス用のタイムスタンプを保存する。
 *
 * @param {number} timestamp - 現在時刻のタイムスタンプ（ms）
 * @returns {{ newProps: Object }}
 */
function saveDebounceLastRunSA(timestamp) {
  return {
    newProps: { 'HANDLE_EDIT_LAST_RUN': String(timestamp) }
  };
}

// ─────────────────────────────────────────────
// 最安値バッチ 進捗管理
// ─────────────────────────────────────────────

/**
 * 最安値バッチの進捗を取得する。
 *
 * @param {Object} propsData - バインドスクリプト側 ScriptProperties の plain object
 * @returns {{ startIndex: number, totalCount: number }} 未設定の場合は { startIndex: 0, totalCount: 0 }
 */
function getBatchProgressSA(propsData) {
  var raw = propsData['LP_BATCH_PROGRESS'] || null;
  if (!raw) {
    return { startIndex: 0, totalCount: 0 };
  }
  try {
    var parsed = JSON.parse(raw);
    return {
      startIndex: parsed.startIndex || 0,
      totalCount: parsed.totalCount || 0
    };
  } catch (e) {
    Logger.log('LP_BATCH_PROGRESS のパースに失敗しました: ' + e.toString());
    return { startIndex: 0, totalCount: 0 };
  }
}

/**
 * 最安値バッチの進捗を保存する。
 *
 * @param {number} totalCount - 処理対象の総件数
 * @param {number} completedCount - 完了済み件数
 * @returns {{ newProps: Object }}
 */
function saveBatchProgressSA(totalCount, completedCount) {
  var progress = JSON.stringify({
    totalCount: totalCount,
    startIndex: completedCount
  });
  return {
    newProps: { 'LP_BATCH_PROGRESS': progress }
  };
}

/**
 * 最安値バッチの進捗をクリアする。
 *
 * @returns {{ newProps: Object }}
 */
function clearBatchProgressSA() {
  return {
    newProps: { 'LP_BATCH_PROGRESS': null }
  };
}

// ─────────────────────────────────────────────
// 最安値 日次レート制限 管理
// ─────────────────────────────────────────────

/**
 * 今日のキーを返す（LP_REQ_YYYYMMDD 形式）。
 *
 * @returns {string}
 */
function lpTodayKeySA_() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  return 'LP_REQ_' + y + m + d;
}

/**
 * 日次リクエスト数が上限未満かどうかを確認する。
 *
 * @param {Object} propsData - バインドスクリプト側 ScriptProperties の plain object
 * @param {number} maxDaily - 日次上限数
 * @returns {boolean} true = 制限内（リクエスト可）
 */
function lpCheckRateLimitSA(propsData, maxDaily) {
  var key = lpTodayKeySA_();
  var count = parseInt(propsData[key] || '0', 10);
  return count < maxDaily;
}

/**
 * 日次リクエスト数をインクリメントする。
 *
 * @param {Object} propsData - バインドスクリプト側 ScriptProperties の plain object
 * @returns {{ newProps: Object }}
 */
function lpIncrementRequestCountSA(propsData) {
  var key = lpTodayKeySA_();
  var count = parseInt(propsData[key] || '0', 10);
  var newProps = {};
  newProps[key] = String(count + 1);
  return { newProps: newProps };
}
