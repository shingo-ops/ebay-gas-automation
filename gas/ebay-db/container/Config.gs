/**
 * Config.gs - configシートからの設定値読み込み
 * ebay-db 原本ブック専用
 */

/**
 * configシートから全設定値を取得
 * @returns {Object} キー: 列A、値: 列B の設定オブジェクト
 */
function getConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('config');
  if (!sheet) {
    throw new Error('config シートが見つかりません。セットアップを実行してください。');
  }

  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 0; i < data.length; i++) {
    var key = data[i][0];
    var val = data[i][1];
    if (key) {
      config[String(key)] = val;
    }
  }
  return config;
}

/**
 * configシートの初期セットアップ（初回のみ実行）
 */
function setupConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('config');

  if (!sheet) {
    sheet = ss.insertSheet('config');
    Logger.log('config シートを作成しました');
  }

  var rows = [
    ['SERVICE_BOOK_ID',     '',      'サービス提供用ブックのスプレッドシートID'],
    ['CSV_FOLDER_ID',       '',      'Python出力CSVの格納先Google DriveフォルダID'],
    ['DISCORD_WEBHOOK',     '',      'Discord通知用Webhook URL'],
    ['AUTO_SYNC_ENABLED',   'TRUE',  '自動転記の有効化（TRUE/FALSE）'],
    ['LAST_FULL_SYNC',      '',      '最終フル同期日時（自動更新）']
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);

  // ヘッダースタイル
  sheet.getRange(1, 1, rows.length, 1).setFontWeight('bold');
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 400);
  sheet.setColumnWidth(3, 350);
  sheet.setFrozenRows(0);

  Logger.log('config シートのセットアップ完了');
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
 * @param {string} type - 'category_master' | 'condition_ja_map'
 * @param {string} action - 'added' | 'removed' | 'changed' | 'check_fail' | 'transferred'
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
