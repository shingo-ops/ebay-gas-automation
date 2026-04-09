/**
 * Config.gs - PropertiesService による設定値管理
 * ebay-db 原本ブック専用
 *
 * configシートは廃止。設定は GAS スクリプトプロパティで管理。
 * GASエディタ > プロジェクトの設定 > スクリプトプロパティ で値を入力してください。
 */

/**
 * スクリプトプロパティから全設定値を取得
 * @returns {Object} キー・値のオブジェクト
 */
function getConfig() {
  return PropertiesService.getScriptProperties().getProperties();
}

/**
 * スクリプトプロパティの一括初期設定（初回のみ実行）
 * 未設定のキーにデフォルト値をセット。既存値は上書きしない。
 * 実行後、GASエディタ > プロジェクトの設定 > スクリプトプロパティ で各値を入力してください。
 */
function setupProperties() {
  var props = PropertiesService.getScriptProperties();
  var defaults = {
    'SERVICE_BOOK_ID':     '',
    'DRIVE_CSV_FOLDER_ID': '',
    'DISCORD_WEBHOOK_EBAYDB': '',
    'GEMINI_API_KEY':      '',
    'AUTO_SYNC_ENABLED':   'TRUE',
    'LAST_FULL_SYNC':      ''
  };

  Object.keys(defaults).forEach(function(key) {
    if (props.getProperty(key) === null) {
      props.setProperty(key, defaults[key]);
    }
  });

  Logger.log('setupProperties 完了');
  Logger.log('必須入力: SERVICE_BOOK_ID, DRIVE_CSV_FOLDER_ID, DISCORD_WEBHOOK_EBAYDB, GEMINI_API_KEY');
}

/**
 * sync_log シートの初期セットアップ
 */
function setupSyncLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('sync_log');

  if (!sheet) {
    sheet = ss.insertSheet('sync_log');
    Logger.log('sync_log シートを作成しました');
  }

  var headers = ['sync_date', 'type', 'action', 'detail', 'status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 160);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 400);
  sheet.setColumnWidth(5, 100);

  Logger.log('sync_log シートのセットアップ完了');
}

/**
 * sync_log に1行追記
 * @param {string} type - 'category_master' | 'condition_ja_map' | 'system'
 * @param {string} action - 'added' | 'removed' | 'changed' | 'check_fail' | 'transferred' | 'error'
 * @param {string} detail - 詳細メッセージ
 * @param {string} status - 'pending' | 'synced' | 'error'
 */
function appendSyncLog(type, action, detail, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('sync_log');
  if (!sheet) return;

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  sheet.appendRow([now, type, action, detail, status]);
}
