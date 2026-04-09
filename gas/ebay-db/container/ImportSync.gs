/**
 * ImportSync.gs - CSVインポート・差分検出・整合性チェック・転記
 * ebay-db 原本ブック専用
 *
 * エントリポイント: importAndSync()
 * clasp run importAndSync で GitHub Actions から呼び出す
 */

/**
 * メイン処理（clasp run のエントリポイント）
 * §4.1 月次更新処理 Step4〜8 を実行
 */
function importAndSync() {
  Logger.log('=== ebay-db 月次同期 開始 ===');

  var config;
  try {
    config = getConfig();
  } catch (e) {
    notifyError('config シート読み込み失敗: ' + e.toString());
    throw e;
  }

  if (config['AUTO_SYNC_ENABLED'] === 'FALSE') {
    Logger.log('AUTO_SYNC_ENABLED=FALSE のためスキップ');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var diffResult = { categoryAdded: 0, categoryRemoved: 0, categoryChanged: 0, conditionAdded: 0, conditionRemoved: 0 };

  try {
    // Step4: CSVインポート・差分検出
    Logger.log('[Step4] CSVインポート開始');
    diffResult = importCsvAndDetectDiff(ss, config);
    Logger.log('[Step4] 完了: ' + JSON.stringify(diffResult));

    // Step5: ja_display 空欄行を Gemini で自動補完
    Logger.log('[Step5] Gemini 日本語生成開始');
    var translateResult = fillMissingJaDisplay();
    Logger.log('[Step5] 完了: filled=' + translateResult.filled);

    // Step6: 整合性チェック
    Logger.log('[Step6] 整合性チェック開始');
    var checkResult = runIntegrityChecks(ss);
    Logger.log('[Step6] passed=' + checkResult.passed);

    // Step7: 整合性PASS時のみ転記
    var transferred = false;
    if (checkResult.passed) {
      Logger.log('[Step7] サービス提供用ブックへ転記開始');
      transferToServiceBook(ss, config);
      transferred = true;

      // LAST_FULL_SYNC を更新
      var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
      updateConfig(ss, 'LAST_FULL_SYNC', now);
      Logger.log('[Step7] 転記完了');
    } else {
      Logger.log('[Step7] 整合性チェック FAIL → 転記スキップ');
    }

    // Step8: Discord通知
    Logger.log('[Step8] Discord通知送信');
    notifySyncResult(diffResult, checkResult, transferred);

  } catch (e) {
    Logger.log('❌ 同期エラー: ' + e.toString());
    appendSyncLog('system', 'error', e.toString(), 'error');
    notifyError(e.toString());
    throw e;
  }

  Logger.log('=== ebay-db 月次同期 完了 ===');
}

// ─────────────────────────────────────────
// CSV インポート・差分検出
// ─────────────────────────────────────────

/**
 * Google Drive からCSVを読み込みシートに書き込む
 * 差分を検出して sync_log に記録
 * @param {Spreadsheet} ss
 * @param {Object} config
 * @returns {Object} diffResult
 */
function importCsvAndDetectDiff(ss, config) {
  var folderId = config['CSV_FOLDER_ID'];
  if (!folderId) throw new Error('CSV_FOLDER_ID が config に設定されていません');

  var folder = DriveApp.getFolderById(folderId);
  var diffResult = { categoryAdded: 0, categoryRemoved: 0, categoryChanged: 0, conditionAdded: 0, conditionRemoved: 0 };

  // category_master.csv のインポート
  var catFile = getLatestFileByName(folder, 'category_master.csv');
  if (catFile) {
    var catDiff = importCsvToSheet(ss, catFile, 'category_master');
    diffResult.categoryAdded   = catDiff.added;
    diffResult.categoryRemoved = catDiff.removed;
    diffResult.categoryChanged = catDiff.changed;
  } else {
    Logger.log('⚠️ category_master.csv が見つかりません');
  }

  // condition_ja_map.csv のインポート
  var conFile = getLatestFileByName(folder, 'condition_ja_map.csv');
  if (conFile) {
    var conDiff = importCsvToSheet(ss, conFile, 'condition_ja_map');
    diffResult.conditionAdded   = conDiff.added;
    diffResult.conditionRemoved = conDiff.removed;
  } else {
    Logger.log('⚠️ condition_ja_map.csv が見つかりません');
  }

  return diffResult;
}

/**
 * フォルダ内から指定名のファイルを取得（更新日時が最新のもの）
 * @param {Folder} folder
 * @param {string} name
 * @returns {File|null}
 */
function getLatestFileByName(folder, name) {
  var files = folder.getFilesByName(name);
  var latest = null;
  while (files.hasNext()) {
    var f = files.next();
    if (!latest || f.getLastUpdated() > latest.getLastUpdated()) {
      latest = f;
    }
  }
  return latest;
}

/**
 * CSVファイルをシートにインポートし差分を返す
 * @param {Spreadsheet} ss
 * @param {File} file
 * @param {string} sheetName
 * @returns {Object} { added, removed, changed }
 */
function importCsvToSheet(ss, file, sheetName) {
  var csvText = file.getBlob().getDataAsString('UTF-8');
  var newData = parseCsv(csvText);

  if (newData.length < 2) {
    Logger.log(sheetName + ': CSVが空のためスキップ');
    return { added: 0, removed: 0, changed: 0 };
  }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // 既存データ取得（差分検出用）
  var oldData = sheet.getLastRow() > 0 ? sheet.getDataRange().getValues() : [newData[0]];
  var diff = detectDiff(oldData, newData, sheetName);

  // シートを上書き
  sheet.clearContents();
  sheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);

  // ヘッダースタイル
  var headerRange = sheet.getRange(1, 1, 1, newData[0].length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  Logger.log(sheetName + ' インポート完了: ' + (newData.length - 1) + '行');
  appendSyncLog(sheetName, 'import', (newData.length - 1) + '行インポート', 'pending');

  return diff;
}

/**
 * 旧データと新データを比較して差分を計算
 */
function detectDiff(oldData, newData, sheetName) {
  var diff = { added: 0, removed: 0, changed: 0 };
  if (oldData.length < 2) {
    diff.added = newData.length - 1;
    return diff;
  }

  // 1列目をキーとして比較
  var oldMap = {};
  for (var i = 1; i < oldData.length; i++) {
    var key = String(oldData[i][0]);
    oldMap[key] = oldData[i].join(',');
  }

  var newMap = {};
  for (var j = 1; j < newData.length; j++) {
    var nkey = String(newData[j][0]);
    newMap[nkey] = newData[j].join(',');
  }

  Object.keys(newMap).forEach(function(key) {
    if (!oldMap[key]) {
      diff.added++;
      appendSyncLog(sheetName, 'added', 'key=' + key, 'pending');
    } else if (oldMap[key] !== newMap[key]) {
      diff.changed++;
      appendSyncLog(sheetName, 'changed', 'key=' + key, 'pending');
    }
  });

  Object.keys(oldMap).forEach(function(key) {
    if (!newMap[key]) {
      diff.removed++;
      appendSyncLog(sheetName, 'removed', 'key=' + key, 'pending');
    }
  });

  return diff;
}

/**
 * CSVテキストを2次元配列にパース（カンマ・ダブルクォート対応）
 */
function parseCsv(text) {
  return Utilities.parseCsv(text);
}

// ─────────────────────────────────────────
// 整合性チェック（§4.2）
// ─────────────────────────────────────────

/**
 * 3つの整合性チェックを実行
 * @param {Spreadsheet} ss
 * @returns {Object} checkResult
 */
function runIntegrityChecks(ss) {
  var result = {
    passed: true,
    missingConditionIds: [],
    emptyJaDisplay: [],
    invalidFvf: []
  };

  // チェック1: condition_id 存在確認
  result = checkConditionIdExists(ss, result);

  // チェック2: ja_display 空欄チェック
  result = checkJaDisplayNotEmpty(ss, result);

  // チェック3: FVFレート範囲チェック
  result = checkFvfRateRange(ss, result);

  result.passed = result.missingConditionIds.length === 0
               && result.emptyJaDisplay.length === 0
               && result.invalidFvf.length === 0;

  Logger.log('整合性チェック結果: ' + JSON.stringify(result));
  return result;
}

/**
 * チェック1: category_master の conditions_json に含まれる condition_id が
 *            condition_ja_map に全て登録されているか
 */
function checkConditionIdExists(ss, result) {
  var catSheet = ss.getSheetByName('category_master');
  var conSheet = ss.getSheetByName('condition_ja_map');
  if (!catSheet || !conSheet) return result;

  var catData = catSheet.getDataRange().getValues();
  var catHeaders = catData[0];
  var conditionsJsonIdx = catHeaders.indexOf('conditions_json');
  if (conditionsJsonIdx === -1) return result;

  var conData = conSheet.getDataRange().getValues();
  var conHeaders = conData[0];
  var conIdIdx = conHeaders.indexOf('condition_id');
  if (conIdIdx === -1) return result;

  var registeredIds = {};
  for (var i = 1; i < conData.length; i++) {
    registeredIds[String(conData[i][conIdIdx])] = true;
  }

  var missing = {};
  for (var j = 1; j < catData.length; j++) {
    var json = catData[j][conditionsJsonIdx];
    if (!json) continue;
    try {
      var conditions = JSON.parse(json);
      conditions.forEach(function(c) {
        var id = String(c.id || c.condition_id);
        if (!registeredIds[id] && !missing[id]) {
          missing[id] = true;
          result.missingConditionIds.push(id);
          appendSyncLog('condition_ja_map', 'check_fail', 'condition_id=' + id + ' が未登録', 'error');
        }
      });
    } catch (e) {
      Logger.log('conditions_json パースエラー: ' + e.toString());
    }
  }

  return result;
}

/**
 * チェック2: condition_ja_map の ja_display 空欄チェック
 */
function checkJaDisplayNotEmpty(ss, result) {
  var sheet = ss.getSheetByName('condition_ja_map');
  if (!sheet) return result;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIdx        = headers.indexOf('condition_id');
  var nameIdx      = headers.indexOf('condition_name');
  var jaDisplayIdx = headers.indexOf('ja_display');
  if (jaDisplayIdx === -1) return result;

  for (var i = 1; i < data.length; i++) {
    if (!data[i][jaDisplayIdx]) {
      result.emptyJaDisplay.push({
        condition_id:   data[i][idIdx],
        condition_name: data[i][nameIdx]
      });
      appendSyncLog('condition_ja_map', 'check_fail', 'ja_display空欄: condition_id=' + data[i][idIdx], 'error');
    }
  }

  return result;
}

/**
 * チェック3: category_master の fvf_rate 範囲チェック（0〜20%）
 */
function checkFvfRateRange(ss, result) {
  var sheet = ss.getSheetByName('category_master');
  if (!sheet) return result;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var fvfIdx = headers.indexOf('fvf_rate');
  var catIdx = headers.indexOf('category_id');
  if (fvfIdx === -1) return result;

  for (var i = 1; i < data.length; i++) {
    var rate = parseFloat(data[i][fvfIdx]);
    if (isNaN(rate)) continue;
    if (rate < 0 || rate > 20) {
      result.invalidFvf.push({ category_id: data[i][catIdx], fvf_rate: rate });
      appendSyncLog('category_master', 'check_fail', 'fvf_rate範囲外: category_id=' + data[i][catIdx] + ' rate=' + rate, 'error');
    }
  }

  return result;
}

// ─────────────────────────────────────────
// サービス提供用ブックへの転記
// ─────────────────────────────────────────

/**
 * 原本ブックの category_master と condition_ja_map を
 * サービス提供用ブックへ転記（sync_log・config は転記しない）
 * @param {Spreadsheet} ss
 * @param {Object} config
 */
function transferToServiceBook(ss, config) {
  var serviceBookId = config['SERVICE_BOOK_ID'];
  if (!serviceBookId) throw new Error('SERVICE_BOOK_ID が config に設定されていません');

  var serviceBook = SpreadsheetApp.openById(serviceBookId);

  var targets = ['category_master', 'condition_ja_map'];
  targets.forEach(function(name) {
    var srcSheet = ss.getSheetByName(name);
    if (!srcSheet) {
      Logger.log(name + ' シートが見つかりません。転記スキップ');
      return;
    }

    var data = srcSheet.getDataRange().getValues();

    var dstSheet = serviceBook.getSheetByName(name);
    if (!dstSheet) {
      dstSheet = serviceBook.insertSheet(name);
    }

    dstSheet.clearContents();
    dstSheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    // ヘッダースタイル
    var headerRange = dstSheet.getRange(1, 1, 1, data[0].length);
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    dstSheet.setFrozenRows(1);

    appendSyncLog(name, 'transferred', (data.length - 1) + '行転記', 'synced');
    Logger.log(name + ' → サービス提供用ブックへ転記: ' + (data.length - 1) + '行');
  });
}

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────

/**
 * configシートの特定キーの値を更新
 * @param {Spreadsheet} ss
 * @param {string} key
 * @param {string} value
 */
function updateConfig(ss, key, value) {
  var sheet = ss.getSheetByName('config');
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
}

/**
 * 手動実行用: セットアップ（初回のみ）
 */
function setupAll() {
  setupConfigSheet();
  setupSyncLogSheet();
  Logger.log('セットアップ完了。configシートにSERVICE_BOOK_IDとCSV_FOLDER_IDを入力してください。');
}
