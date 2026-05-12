/**
 * TransferLog.gs
 *
 * 転記データのログ管理機能
 * - 転記ログシート（転記ログ）の作成・取得
 * - ログ行の書き込み・ステータス更新
 * - 7日以上経過したログの自動削除
 */

var LOG_SHEET_NAME = '転記ログ';
var LOG_RETENTION_DAYS = 7;

// ログシートの固定列
var LOG_COL_TIMESTAMP = 1;  // A: タイムスタンプ
var LOG_COL_SKU       = 2;  // B: SKU
var LOG_COL_STATUS    = 3;  // C: ステータス（転記中 / 成功 / エラー）
var LOG_COL_ERROR     = 4;  // D: エラー内容
var LOG_FIXED_COLS    = 4;  // 上記4列の後に転記データ列が続く

/**
 * 転記ログシートを取得または作成する
 * ヘッダー行はまだ transferData のヘッダーが不明なため、固定4列のみ初期化
 * @returns {Sheet}
 */
function getOrCreateLogSheet(spreadsheetId) {
  var spreadsheet = getTargetSpreadsheetResearch(spreadsheetId);
  var logSheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);

  if (!logSheet) {
    logSheet = spreadsheet.insertSheet(LOG_SHEET_NAME);
    // 固定ヘッダーを書き込む（転記データ列は後で追記）
    logSheet.getRange(1, LOG_COL_TIMESTAMP).setValue('タイムスタンプ');
    logSheet.getRange(1, LOG_COL_SKU).setValue('SKU');
    logSheet.getRange(1, LOG_COL_STATUS).setValue('ステータス');
    logSheet.getRange(1, LOG_COL_ERROR).setValue('エラー内容');
    // ヘッダー行を太字・背景色で装飾
    logSheet.getRange(1, 1, 1, LOG_FIXED_COLS).setFontWeight('bold').setBackground('#e8eaf6');
    logSheet.setFrozenRows(1);
    Logger.log('転記ログシートを新規作成しました');
  }

  return logSheet;
}

/**
 * 転記ログを書き込む（setValues直前に呼ぶ）
 * @param {Array} transferData  転記データ配列
 * @param {string} sku          SKU文字列
 * @param {Array} listingHeaders 出品シートのヘッダー行配列（転記データと同じ長さ）
 * @returns {number} 書き込んだログ行番号
 */
function writeTransferLog(spreadsheetId, transferData, sku, listingHeaders) {
  try {
    var logSheet = getOrCreateLogSheet(spreadsheetId);
    var now = new Date();

    // ヘッダー行を確認・拡張（初回 or 列数が変わった場合）
    var currentHeaderRow = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
    var expectedTotalCols = LOG_FIXED_COLS + (listingHeaders ? listingHeaders.length : 0);
    if (currentHeaderRow.length < expectedTotalCols && listingHeaders && listingHeaders.length > 0) {
      logSheet.getRange(1, LOG_FIXED_COLS + 1, 1, listingHeaders.length).setValues([listingHeaders]);
      logSheet.getRange(1, LOG_FIXED_COLS + 1, 1, listingHeaders.length)
        .setFontWeight('bold').setBackground('#e8eaf6');
    }

    // ログ行データを組み立て
    var totalCols = LOG_FIXED_COLS + (transferData ? transferData.length : 0);
    var logRowData = new Array(totalCols).fill('');
    logRowData[LOG_COL_TIMESTAMP - 1] = now;
    logRowData[LOG_COL_SKU - 1]       = sku || '';
    logRowData[LOG_COL_STATUS - 1]    = '転記中';
    logRowData[LOG_COL_ERROR - 1]     = '';
    if (transferData && transferData.length > 0) {
      for (var i = 0; i < transferData.length; i++) {
        logRowData[LOG_FIXED_COLS + i] = transferData[i] !== undefined ? transferData[i] : '';
      }
    }

    // 末尾行に追記
    var newLogRow = logSheet.getLastRow() + 1;
    logSheet.getRange(newLogRow, 1, 1, totalCols).setValues([logRowData]);
    Logger.log('転記ログ書き込み完了: 行=' + newLogRow + ', SKU=' + sku);
    return newLogRow;

  } catch (e) {
    Logger.log('writeTransferLog エラー（無視）: ' + e.toString());
    return null;
  }
}

/**
 * 転記ログのステータスとエラー内容を更新する（setValues後またはcatch内で呼ぶ）
 * @param {number} logRow      ログ行番号
 * @param {string} status      ステータス文字列（'成功' or 'エラー'）
 * @param {string} errorMessage エラー内容（成功時は空文字）
 */
function updateTransferLogStatus(spreadsheetId, logRow, status, errorMessage) {
  if (!logRow) return;
  try {
    var logSheet = getTargetSpreadsheetResearch(spreadsheetId).getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) return;
    logSheet.getRange(logRow, LOG_COL_STATUS).setValue(status);
    logSheet.getRange(logRow, LOG_COL_ERROR).setValue(errorMessage || '');
    Logger.log('転記ログ更新: 行=' + logRow + ', ステータス=' + status);
  } catch (e) {
    Logger.log('updateTransferLogStatus エラー（無視）: ' + e.toString());
  }
}

/**
 * 7日以上前のログ行を削除する（日次トリガーから実行）
 */
function cleanupOldLogs(spreadsheetId) {
  try {
    var logSheet = getTargetSpreadsheetResearch(spreadsheetId).getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
      Logger.log('cleanupOldLogs: 転記ログシートが存在しないためスキップ');
      return;
    }

    var lastRow = logSheet.getLastRow();
    if (lastRow <= 1) return; // ヘッダー行のみ

    var now = new Date();
    var cutoff = new Date(now.getTime() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    var timestamps = logSheet.getRange(2, LOG_COL_TIMESTAMP, lastRow - 1, 1).getValues();
    var deleteRows = [];

    for (var i = timestamps.length - 1; i >= 0; i--) {
      var ts = timestamps[i][0];
      if (ts instanceof Date && ts < cutoff) {
        deleteRows.push(i + 2); // 1-indexed、ヘッダー行分+1
      }
    }

    // 下から削除することで行番号ずれを防ぐ（既に逆順）
    deleteRows.forEach(function(row) {
      logSheet.deleteRow(row);
    });

    Logger.log('cleanupOldLogs: ' + deleteRows.length + '行削除完了');
  } catch (e) {
    Logger.log('cleanupOldLogs エラー: ' + e.toString());
  }
}

/**
 * 毎日AM3時に cleanupOldLogs を実行するトリガーをセットアップ（alert付き・手動実行用）
 * 重複登録を防ぐため、既存の同名トリガーは削除してから登録
 */
function setupLogCleanupTrigger() {
  setupLogCleanupTriggerSilent();
  SpreadsheetApp.getUi().alert(
    'トリガー設定完了',
    '転記ログの自動クリーンアップ（毎日AM3時）を設定しました。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 毎日AM3時に cleanupOldLogs を実行するトリガーをセットアップ（alertなし・completeInitialSetup統合用）
 * 重複登録を防ぐため、既存の同名トリガーは削除してから登録
 */
function setupLogCleanupTriggerSilent() {
  // 既存のcleanupOldLogsトリガーを削除
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'cleanupOldLogs') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('既存のcleanupOldLogsトリガーを削除');
    }
  });

  // 毎日AM3時に実行
  ScriptApp.newTrigger('cleanupOldLogs')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();

  Logger.log('cleanupOldLogsトリガーを設定しました（毎日AM3時）');
}
