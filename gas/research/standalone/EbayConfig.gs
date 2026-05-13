/**
 * EbayConfig.gs — eBay設定取得（スタンドアロン版）
 *
 * container/Config.gs の getConfig / getEbayConfig / validateConfig を
 * スタンドアロン向けにスプレッドシートIDを引数で受け取る形式に変換。
 * PropertiesService は直接呼ばない。
 */

/**
 * ツール設定シートから設定値を取得
 * @param {string} spreadsheetId
 * @returns {Object} 設定オブジェクト
 */
function getConfigSA_(spreadsheetId) {
  var ss = getTargetSpreadsheetResearch(spreadsheetId);
  var settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!settingsSheet) {
    throw new Error('「' + SHEET_NAMES.SETTINGS + '」シートが見つかりません');
  }
  var data = settingsSheet.getDataRange().getValues();
  if (data.length === 0) {
    throw new Error('ツール設定シートにデータがありません');
  }

  var headerRow = data[0];
  var columnMap = {};
  for (var i = 0; i < headerRow.length; i++) {
    var h = String(headerRow[i]).trim();
    if (h) columnMap[h] = i;
  }

  var itemColIndex = columnMap['項目'];
  var valueColIndex = columnMap['値'];
  if (itemColIndex === undefined || valueColIndex === undefined) {
    throw new Error('ツール設定シートに「項目」または「値」列が見つかりません');
  }

  var config = {};
  for (var j = 1; j < data.length; j++) {
    var key = data[j][itemColIndex];
    var value = data[j][valueColIndex];
    if (key) {
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
 * @param {string} urlOrId
 * @returns {string}
 */
function extractSpreadsheetIdSA_(urlOrId) {
  if (!urlOrId) return '';
  if (urlOrId.indexOf('/') === -1 && urlOrId.indexOf('https') === -1) return urlOrId;
  var match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return urlOrId;
}

/**
 * eBay API設定をスプレッドシートから取得
 * @param {string} spreadsheetId
 * @returns {Object} { appId, certId, devId, isSandbox, imageFolderUrl, listingSpreadsheetId, userToken, ... }
 */
function getEbayConfigSA(spreadsheetId) {
  var config = getConfigSA_(spreadsheetId);
  return {
    appId: config['App ID'] || '',
    certId: config['Cert ID'] || '',
    devId: config['Dev ID'] || '',
    isSandbox: false,
    imageFolderUrl: config['画像フォルダ'] || '',
    listingSpreadsheetId: extractSpreadsheetIdSA_(config['出品シート'] || ''),
    categoryMasterSpreadsheetId: extractSpreadsheetIdSA_(config['カテゴリマスタ'] || ''),
    storeImageUrl: config['ストア画像'] || '',
    userToken: config['USER_TOKEN'] || ''
  };
}

/**
 * 設定値の検証
 * @param {string} spreadsheetId
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateConfigSA(spreadsheetId) {
  try {
    var config = getEbayConfigSA(spreadsheetId);
    var errors = [];
    if (!config.appId)         errors.push('App ID が設定されていません');
    if (!config.certId)        errors.push('Cert ID が設定されていません');
    if (!config.devId)         errors.push('Dev ID が設定されていません');
    if (!config.imageFolderUrl) errors.push('画像フォルダが設定されていません');
    return { isValid: errors.length === 0, errors: errors };
  } catch (e) {
    return { isValid: false, errors: [e.toString()] };
  }
}
