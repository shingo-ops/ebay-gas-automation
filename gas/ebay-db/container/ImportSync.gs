/**
 * ImportSync.gs - CSVインポート・差分検出・整合性チェック・転記
 * ebay-db 原本ブック専用
 *
 * エントリポイント: importAndSync()
 * clasp run importAndSync で GitHub Actions から呼び出す
 *
 * CSVファイル構成（GitHub raw URL から取得）:
 *   category_master_EBAY_US.csv  → category_master_EBAY_US シート
 *   category_master_EBAY_GB.csv  → category_master_EBAY_GB シート
 *   category_master_EBAY_DE.csv  → category_master_EBAY_DE シート
 *   category_master_EBAY_AU.csv  → category_master_EBAY_AU シート
 *   condition_ja_map.csv         → condition_ja_map シート（全市場共通）
 */

var CATEGORY_MARKETPLACES = ['EBAY_US', 'EBAY_GB', 'EBAY_DE', 'EBAY_AU'];

/**
 * メイン処理（clasp run のエントリポイント）
 */
function importAndSync() {
  Logger.log('=== ebay-db 月次同期 開始 ===');

  var config = getConfig();

  if (config['AUTO_SYNC_ENABLED'] === 'FALSE') {
    Logger.log('AUTO_SYNC_ENABLED=FALSE のためスキップ');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 各マーケットシートと condition_ja_map が存在しない場合は自動作成
  CATEGORY_MARKETPLACES.forEach(function(mp) {
    var name = 'category_master_' + mp;
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
      Logger.log(name + ' シートを新規作成しました');
    }
  });
  if (!ss.getSheetByName('condition_ja_map')) {
    ss.insertSheet('condition_ja_map');
    Logger.log('condition_ja_map シートを新規作成しました');
  }

  var diffResult = {
    categoryAdded: 0, categoryRemoved: 0, categoryChanged: 0,
    conditionAdded: 0, conditionRemoved: 0
  };

  try {
    // Step4: CSVインポート・差分検出（マーケット別）
    Logger.log('[Step4] CSVインポート開始');
    diffResult = importCsvAndDetectDiff(ss);
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

      var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
      PropertiesService.getScriptProperties().setProperty('LAST_FULL_SYNC', now);
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

var GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/shingo-ops/bay-auto/main/ebay-db/output/';

/**
 * マーケット別 CSV をインポートして差分を返す
 * @param {Spreadsheet} ss
 * @returns {Object} diffResult
 */
function importCsvAndDetectDiff(ss) {
  var diffResult = {
    categoryAdded: 0, categoryRemoved: 0, categoryChanged: 0,
    conditionAdded: 0, conditionRemoved: 0
  };

  // マーケット別 category_master CSV をインポート
  CATEGORY_MARKETPLACES.forEach(function(mp) {
    var sheetName = 'category_master_' + mp;
    var filename  = 'category_master_' + mp + '.csv';
    try {
      var text = fetchCsvFromGitHub(filename);
      var diff = importCsvToSheet(ss, text, sheetName);
      diffResult.categoryAdded   += diff.added;
      diffResult.categoryRemoved += diff.removed;
      diffResult.categoryChanged += diff.changed;
    } catch (e) {
      Logger.log('⚠️ ' + filename + ' 取得失敗: ' + e.toString());
    }
  });

  // condition_ja_map CSV をインポート（全市場共通・1ファイル）
  try {
    var conText = fetchCsvFromGitHub('condition_ja_map.csv');
    var conDiff = importCsvToSheet(ss, conText, 'condition_ja_map');
    diffResult.conditionAdded   = conDiff.added;
    diffResult.conditionRemoved = conDiff.removed;
  } catch (e) {
    Logger.log('⚠️ condition_ja_map.csv 取得失敗: ' + e.toString());
  }

  return diffResult;
}

/**
 * GitHub raw URL から CSV テキストを取得
 * @param {string} filename
 * @returns {string} CSV テキスト
 */
function fetchCsvFromGitHub(filename) {
  var url = GITHUB_RAW_BASE + filename;
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error('HTTP ' + response.getResponseCode() + ': ' + url);
  }
  return response.getContentText();
}

/**
 * CSV テキストをシートにインポートし差分を返す
 * @param {Spreadsheet} ss
 * @param {string} csvText
 * @param {string} sheetName
 * @returns {Object} { added, removed, changed }
 */
function importCsvToSheet(ss, csvText, sheetName) {
  var newData = parseCsv(csvText);

  if (newData.length < 2) {
    Logger.log(sheetName + ': CSVが空のためスキップ');
    return { added: 0, removed: 0, changed: 0 };
  }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var oldData = sheet.getLastRow() > 0 ? sheet.getDataRange().getValues() : [newData[0]];
  var diff = detectDiff(oldData, newData, sheetName);

  sheet.clearContents();
  sheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);

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

  var oldMap = {};
  for (var i = 1; i < oldData.length; i++) {
    oldMap[String(oldData[i][0])] = oldData[i].join(',');
  }

  var newMap = {};
  for (var j = 1; j < newData.length; j++) {
    newMap[String(newData[j][0])] = newData[j].join(',');
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
 * CSVテキストを2次元配列にパース
 */
function parseCsv(text) {
  return Utilities.parseCsv(text);
}

// ─────────────────────────────────────────
// 整合性チェック（全マーケットシートを対象）
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
    invalidFvf: [],
    emptyDataMarkets: [],
    emptyConditionsMarkets: []
  };

  result = checkDataNotEmpty(ss, result);
  result = checkConditionsJsonNotEmpty(ss, result);
  result = checkConditionIdExists(ss, result);
  result = checkJaDisplayNotEmpty(ss, result);
  result = checkFvfRateRange(ss, result);

  result.passed = result.emptyDataMarkets.length === 0
               && result.emptyConditionsMarkets.length === 0
               && result.missingConditionIds.length === 0
               && result.emptyJaDisplay.length === 0
               && result.invalidFvf.length === 0;

  Logger.log('整合性チェック結果: ' + JSON.stringify(result));
  return result;
}

/**
 * チェック0a: 全マーケットシートのデータ行が0件でないか
 */
function checkDataNotEmpty(ss, result) {
  CATEGORY_MARKETPLACES.forEach(function(mp) {
    var sheet = ss.getSheetByName('category_master_' + mp);
    if (!sheet) return;
    var rowCount = sheet.getLastRow() - 1; // ヘッダー除く
    if (rowCount <= 0) {
      result.emptyDataMarkets.push(mp);
      appendSyncLog('category_master_' + mp, 'check_fail', 'データ行が0件', 'error');
    }
  });
  return result;
}

/**
 * チェック0b: 全マーケットシートの conditions_json が全て [] でないか
 * 全行の90%以上が [] の場合は取得失敗とみなす
 */
function checkConditionsJsonNotEmpty(ss, result) {
  CATEGORY_MARKETPLACES.forEach(function(mp) {
    var sheet = ss.getSheetByName('category_master_' + mp);
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    var headers = data[0];
    var condIdx = headers.indexOf('conditions_json');
    if (condIdx === -1) return;

    var total = data.length - 1;
    var emptyCount = 0;
    for (var i = 1; i < data.length; i++) {
      var val = data[i][condIdx];
      if (!val || val === '[]') emptyCount++;
    }

    if (emptyCount / total >= 0.9) {
      result.emptyConditionsMarkets.push(mp);
      appendSyncLog('category_master_' + mp, 'check_fail',
        'conditions_json が90%以上空: ' + emptyCount + '/' + total, 'error');
    }
  });
  return result;
}

/**
 * チェック1: 全マーケットシートの conditions_json に含まれる condition_id が
 *            condition_ja_map に全て登録されているか
 */
function checkConditionIdExists(ss, result) {
  var conSheet = ss.getSheetByName('condition_ja_map');
  if (!conSheet) return result;

  var conData = conSheet.getDataRange().getValues();
  var conHeaders = conData[0];
  var conIdIdx = conHeaders.indexOf('condition_id');
  if (conIdIdx === -1) return result;

  var registeredIds = {};
  for (var i = 1; i < conData.length; i++) {
    registeredIds[String(conData[i][conIdIdx])] = true;
  }

  var missing = {};
  CATEGORY_MARKETPLACES.forEach(function(mp) {
    var catSheet = ss.getSheetByName('category_master_' + mp);
    if (!catSheet) return;

    var catData = catSheet.getDataRange().getValues();
    var catHeaders = catData[0];
    var conditionsJsonIdx = catHeaders.indexOf('conditions_json');
    if (conditionsJsonIdx === -1) return;

    for (var j = 1; j < catData.length; j++) {
      var json = catData[j][conditionsJsonIdx];
      if (!json || json === '[]') continue;
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
        Logger.log('conditions_json パースエラー (' + mp + '): ' + e.toString());
      }
    }
  });

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
      appendSyncLog('condition_ja_map', 'check_fail',
        'ja_display空欄: condition_id=' + data[i][idIdx], 'error');
    }
  }

  return result;
}

/**
 * チェック3: 全マーケットシートの fvf_rate 範囲チェック（0〜20%）
 */
function checkFvfRateRange(ss, result) {
  CATEGORY_MARKETPLACES.forEach(function(mp) {
    var sheet = ss.getSheetByName('category_master_' + mp);
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var fvfIdx = headers.indexOf('fvf_rate');
    var catIdx = headers.indexOf('category_id');
    if (fvfIdx === -1) return;

    for (var i = 1; i < data.length; i++) {
      var rate = parseFloat(data[i][fvfIdx]);
      if (isNaN(rate)) continue;
      if (rate < 0 || rate > 20) {
        result.invalidFvf.push({ marketplace: mp, category_id: data[i][catIdx], fvf_rate: rate });
        appendSyncLog('category_master_' + mp, 'check_fail',
          'fvf_rate範囲外: category_id=' + data[i][catIdx] + ' rate=' + rate, 'error');
      }
    }
  });

  return result;
}

// ─────────────────────────────────────────
// サービス提供用ブックへの転記
// ─────────────────────────────────────────

/**
 * 全マーケットシートと condition_ja_map をサービス提供用ブックへ転記
 * @param {Spreadsheet} ss
 * @param {Object} config
 */
function transferToServiceBook(ss, config) {
  var serviceBookId = config['SERVICE_BOOK_ID'];
  if (!serviceBookId) throw new Error('SERVICE_BOOK_ID がスクリプトプロパティに設定されていません');

  var serviceBook = SpreadsheetApp.openById(serviceBookId);

  var targets = CATEGORY_MARKETPLACES.map(function(mp) {
    return 'category_master_' + mp;
  }).concat(['condition_ja_map']);

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
 * 手動実行用: セットアップ（初回のみ）
 */
function setupAll() {
  setupProperties();
  setupSyncLogSheet();
  Logger.log('セットアップ完了。GASエディタ > プロジェクトの設定 > スクリプトプロパティ で各値を入力してください。');
}
