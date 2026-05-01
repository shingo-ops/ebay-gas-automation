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
 * チェック1: 全マーケットシートの condition_group が condition_ja_map に登録されているか
 *
 * 新スキーマ対応: condition_ja_map は 1グループ1行。
 * category_master の condition_group 列の値が condition_ja_map に存在するか検証。
 */
function checkConditionIdExists(ss, result) {
  var conSheet = ss.getSheetByName('condition_ja_map');
  if (!conSheet) return result;

  var conData = conSheet.getDataRange().getValues();
  var conHeaders = conData[0];
  var conGroupIdx = conHeaders.indexOf('condition_group');
  if (conGroupIdx === -1) return result;

  // 登録済みグループセット
  var registeredGroups = {};
  for (var i = 1; i < conData.length; i++) {
    registeredGroups[String(conData[i][conGroupIdx])] = true;
  }

  var missing = {};
  CATEGORY_MARKETPLACES.forEach(function(mp) {
    var catSheet = ss.getSheetByName('category_master_' + mp);
    if (!catSheet) return;

    var catData = catSheet.getDataRange().getValues();
    var catHeaders = catData[0];
    var groupIdx = catHeaders.indexOf('condition_group');
    if (groupIdx === -1) return;

    for (var j = 1; j < catData.length; j++) {
      var group = String(catData[j][groupIdx]);
      if (!group) continue;
      if (!registeredGroups[group] && !missing[group]) {
        missing[group] = true;
        result.missingConditionIds.push(group);
        appendSyncLog('condition_ja_map', 'check_fail', 'condition_group=' + group + ' が未登録', 'error');
      }
    }
  });

  return result;
}

/**
 * チェック2: condition_ja_map の ja_map_json 空欄チェック
 *
 * 新スキーマ対応: ja_display → ja_map_json
 */
function checkJaDisplayNotEmpty(ss, result) {
  var sheet = ss.getSheetByName('condition_ja_map');
  if (!sheet) return result;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var groupIdx  = headers.indexOf('condition_group');
  var jaMapIdx  = headers.indexOf('ja_map_json');
  if (jaMapIdx === -1) return result;

  for (var i = 1; i < data.length; i++) {
    var jaMapJson = data[i][jaMapIdx];
    var isEmpty = !jaMapJson || jaMapJson === '{}' || jaMapJson === '';
    if (!isEmpty) {
      // ja_map_json の値にひとつでも空文字があればNG
      try {
        var parsed = JSON.parse(jaMapJson);
        var vals = Object.values(parsed);
        for (var k = 0; k < vals.length; k++) {
          if (!vals[k]) { isEmpty = true; break; }
        }
      } catch (e) {
        isEmpty = true;
      }
    }
    if (isEmpty) {
      result.emptyJaDisplay.push({
        condition_id:   data[i][groupIdx],
        condition_name: 'グループ ' + data[i][groupIdx]
      });
      appendSyncLog('condition_ja_map', 'check_fail',
        'ja_map_json空欄: condition_group=' + data[i][groupIdx], 'error');
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

// ─────────────────────────────────────────
// 診断ユーティリティ
// ─────────────────────────────────────────

/**
 * 原本・サービス提供用ブックの全シートヘッダーを比較してターミナルに返す
 * 使用方法: clasp run auditAllSheetHeaders | jq -r '.'
 * @returns {string} 比較レポート
 */
function auditAllSheetHeaders() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var config = getConfig();
  var svcId  = config['SERVICE_BOOK_ID'];
  var lines  = [];

  // ── 原本ブック ──────────────────────────────
  lines.push('=== 原本ブック: ' + ss.getId() + ' ===');
  var srcMap = {};
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    var lc = sheet.getLastColumn(), lr = sheet.getLastRow();
    if (lc === 0 || lr === 0) {
      lines.push('  [空] ' + name);
      srcMap[name] = null;
    } else {
      var h = sheet.getRange(1, 1, 1, lc).getValues()[0];
      lines.push('  ' + name + ' (' + (lr - 1) + '行): ' + h.join(' | '));
      srcMap[name] = h;
    }
  });

  // ── サービス提供用ブック ────────────────────
  lines.push('');
  if (!svcId) {
    lines.push('=== サービス提供用ブック: SERVICE_BOOK_ID 未設定 ===');
    return lines.join('\n');
  }
  lines.push('=== サービス提供用ブック: ' + svcId + ' ===');
  var dstMap = {};
  try {
    var svc = SpreadsheetApp.openById(svcId);
    svc.getSheets().forEach(function(sheet) {
      var name = sheet.getName();
      var lc = sheet.getLastColumn(), lr = sheet.getLastRow();
      if (lc === 0 || lr === 0) {
        lines.push('  [空] ' + name);
        dstMap[name] = null;
      } else {
        var h = sheet.getRange(1, 1, 1, lc).getValues()[0];
        lines.push('  ' + name + ' (' + (lr - 1) + '行): ' + h.join(' | '));
        dstMap[name] = h;
      }
    });
  } catch (e) {
    lines.push('  ERROR: ' + e.toString());
    return lines.join('\n');
  }

  // ── 転記対象の整合性チェック ────────────────
  lines.push('');
  lines.push('=== 転記対象の整合性チェック ===');
  var targets = CATEGORY_MARKETPLACES.map(function(mp) {
    return 'category_master_' + mp;
  }).concat(['condition_ja_map']);

  var allOk = true;
  targets.forEach(function(name) {
    var src = srcMap[name], dst = dstMap[name];
    if (!src) {
      lines.push('  ⚠ ' + name + ': 原本にシートなし');
      allOk = false;
    } else if (!dst) {
      lines.push('  ⚠ ' + name + ': サービス提供用にシートなし（importAndSync で作成される）');
      allOk = false;
    } else if (JSON.stringify(src) !== JSON.stringify(dst)) {
      lines.push('  ❌ ' + name + ': ヘッダー不一致');
      lines.push('     原本:    ' + src.join(' | '));
      lines.push('     サービス: ' + dst.join(' | '));
      allOk = false;
    } else {
      lines.push('  ✓ ' + name + ': ヘッダー一致 (' + src.length + '列)');
    }
  });

  if (allOk) lines.push('  → 全転記対象シートのヘッダーが一致しています');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 旧シートを原本・サービス提供用ブックから削除する
 * clasp run deleteOldSheets で実行
 * @returns {string} 削除結果レポート
 */
function deleteOldSheets() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var config = getConfig();
  var svcId  = config['SERVICE_BOOK_ID'];
  var lines  = [];
  var now    = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');

  lines.push('=== 旧シート削除 ' + now + ' ===');

  // 原本ブックから削除対象
  var srcTargets = ['category_master'];
  srcTargets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      lines.push('[原本] ' + name + ': シートなし（スキップ）');
      return;
    }
    ss.deleteSheet(sheet);
    lines.push('[原本] ' + name + ': 削除完了');
  });

  // サービス提供用ブックから削除対象
  if (!svcId) {
    lines.push('[サービス] SERVICE_BOOK_ID 未設定のためスキップ');
  } else {
    var dstTargets = ['カテゴリマスタ', 'category_master', 'condition_group_map', 'category_group_id_tmp'];
    try {
      var svc = SpreadsheetApp.openById(svcId);
      dstTargets.forEach(function(name) {
        var sheet = svc.getSheetByName(name);
        if (!sheet) {
          lines.push('[サービス] ' + name + ': シートなし（スキップ）');
          return;
        }
        svc.deleteSheet(sheet);
        lines.push('[サービス] ' + name + ': 削除完了');
      });
    } catch (e) {
      lines.push('[サービス] オープン失敗: ' + e.toString());
    }
  }

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 実シートのヘッダー行を読み取り Discord に通知する診断関数
 *
 * 使用方法:
 *   sync-ebay-db.yml を import_only: true / run_function: checkSheetHeaders で
 *   手動 dispatch すると clasp push → この関数が実行される
 *
 * 確認対象:
 *   - condition_ja_map          （現行スキーマ）
 *   - condition_master          （旧シート・残存していないか確認）
 *   - condition_group_map       （旧シート・残存していないか確認）
 *   - category_master_EBAY_*   （全マーケット）
 */
function checkSheetHeaders() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');

  var lines = [];
  lines.push('🔍 **シートヘッダー診断** — ' + now);
  lines.push('SpreadsheetID: `' + ss.getId() + '`');
  lines.push('');

  // 確認対象シートリスト
  var targets = [
    'condition_ja_map',
    'condition_master',   // 旧シート（残存確認）
    'condition_group_map' // 旧シート（残存確認）
  ].concat(CATEGORY_MARKETPLACES.map(function(mp) {
    return 'category_master_' + mp;
  }));

  targets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);

    if (!sheet) {
      lines.push('❌ **' + name + '**: シートなし');
      return;
    }

    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();

    if (lastCol === 0 || lastRow === 0) {
      lines.push('⚠️ **' + name + '**: シートあり・完全に空（ヘッダーなし）');
      return;
    }

    var headers  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowCount = Math.max(0, lastRow - 1);

    lines.push('✅ **' + name + '** (' + rowCount + '行)');
    lines.push('　`' + headers.join(' | ') + '`');
  });

  var message = lines.join('\n');

  // Discord の 2000 文字制限に対応
  if (message.length > 1900) {
    message = message.substring(0, 1900) + '\n…(省略)';
  }

  notifyDiscord(message);
  Logger.log(message);
}

/**
 * 手動実行用: セットアップ（初回のみ）
 */
function setupAll() {
  setupProperties();
  setupSyncLogSheet();
  Logger.log('セットアップ完了。GASエディタ > プロジェクトの設定 > スクリプトプロパティ で各値を入力してください。');
}

/**
 * 手動実行用: 全シートにヘッダー行だけを作成する
 * シートが存在しない場合は新規作成する
 * データ行には触れない（ヘッダー行のみ上書き）
 */
function setupHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return 'ERROR: getActiveSpreadsheet() returned null';

  var CATEGORY_HEADERS = [
    'marketplace_id', 'category_tree_id', 'category_id', 'category_name',
    'required_specs_json', 'recommended_specs_json', 'optional_specs_json',
    'aspect_values_json', 'aspect_modes_json', 'multi_value_aspects_json',
    'conditions_json', 'condition_group', 'fvf_rate', 'fvf_note', 'last_synced',
    'descriptor_type'  // 列16: ConditionDescriptors タイプ (PR #46)
  ];

  // 新スキーマ: 1グループ1行
  var CONDITION_HEADERS = [
    'condition_group', 'condition_ids_json', 'ja_map_json',
    'category_count', 'example_categories', 'last_synced'
  ];

  var results = [];

  // category_master_EBAY_XX（4シート）
  CATEGORY_MARKETPLACES.forEach(function(mp) {
    var name = 'category_master_' + mp;
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).setValues([CATEGORY_HEADERS]);
    var headerRange = sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length);
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    results.push(name + ':OK');
  });

  // condition_ja_map
  var conSheet = ss.getSheetByName('condition_ja_map') || ss.insertSheet('condition_ja_map');
  conSheet.getRange(1, 1, 1, CONDITION_HEADERS.length).setValues([CONDITION_HEADERS]);
  var conHeaderRange = conSheet.getRange(1, 1, 1, CONDITION_HEADERS.length);
  conHeaderRange.setBackground('#4285f4');
  conHeaderRange.setFontColor('#ffffff');
  conHeaderRange.setFontWeight('bold');
  conSheet.setFrozenRows(1);
  results.push('condition_ja_map:OK');

  return 'spreadsheetId=' + ss.getId() + ' | ' + results.join(', ');
}

/**
 * category_master_EBAY_US のみヘッダー行を14列で上書き（動作確認用）
 */
function setupHeadersUS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return 'ERROR: getActiveSpreadsheet() returned null';

  var CATEGORY_HEADERS = [
    'marketplace_id', 'category_tree_id', 'category_id', 'category_name',
    'required_specs_json', 'recommended_specs_json', 'optional_specs_json',
    'aspect_values_json', 'aspect_modes_json', 'multi_value_aspects_json',
    'conditions_json', 'condition_group', 'fvf_rate', 'fvf_note', 'last_synced',
    'descriptor_type'  // 列16: ConditionDescriptors タイプ (PR #46)
  ];

  var name  = 'category_master_EBAY_US';
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).setValues([CATEGORY_HEADERS]);
  var headerRange = sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  var actual = sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).getValues()[0];
  return name + ' ヘッダー設定完了: ' + actual.join(' | ');
}

/**
 * サービス提供用ブックの category_master_EBAY_US にも14列ヘッダーを設定
 */
function setupHeadersUSServiceBook() {
  var config = getConfig();
  var serviceBookId = config['SERVICE_BOOK_ID'];
  if (!serviceBookId) return 'ERROR: SERVICE_BOOK_ID が未設定';

  var CATEGORY_HEADERS = [
    'marketplace_id', 'category_tree_id', 'category_id', 'category_name',
    'required_specs_json', 'recommended_specs_json', 'optional_specs_json',
    'aspect_values_json', 'aspect_modes_json', 'multi_value_aspects_json',
    'conditions_json', 'fvf_rate', 'fvf_note', 'last_synced'
  ];

  var serviceBook = SpreadsheetApp.openById(serviceBookId);
  var name  = 'category_master_EBAY_US';
  var sheet = serviceBook.getSheetByName(name) || serviceBook.insertSheet(name);
  sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).setValues([CATEGORY_HEADERS]);
  var headerRange = sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  var actual = sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).getValues()[0];
  return '[サービスブック] ' + name + ' ヘッダー設定完了: ' + actual.join(' | ');
}
