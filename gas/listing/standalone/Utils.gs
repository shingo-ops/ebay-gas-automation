/**
 * ユーティリティ関数
 *
 * 共通で使用する便利な関数を提供します
 */

/**
 * シートを取得（存在しない場合は作成）
 *
 * @param {string} sheetName - シート名
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} シート
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('シートを作成しました: ' + sheetName);
  }

  return sheet;
}

/**
 * ログシートにログを記録
 *
 * @param {string} level - ログレベル（INFO, WARNING, ERROR）
 * @param {string} message - メッセージ
 * @param {string} details - 詳細情報（オプション）
 */
function logToSheet(level, message, details) {
  try {
    const config = getConfig();
    const sheet = getOrCreateSheet(config.SHEET_NAMES.LOGS);

    // ヘッダーがない場合は追加
    if (sheet.getLastRow() === 0) {
      sheet.getRange('A1:D1').setValues([['タイムスタンプ', 'レベル', 'メッセージ', '詳細']]);
      sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#f0f0f0');
    }

    // ログを追加
    const timestamp = new Date();
    const row = [timestamp, level, message, details || ''];
    sheet.appendRow(row);

    // 色分け
    const lastRow = sheet.getLastRow();
    let color = '#ffffff';
    if (level === 'ERROR') {
      color = '#ffebee';
    } else if (level === 'WARNING') {
      color = '#fff9c4';
    } else if (level === 'INFO') {
      color = '#e8f5e9';
    }
    sheet.getRange(lastRow, 1, 1, 4).setBackground(color);

    // 古いログを削除（1000行以上の場合）
    if (sheet.getLastRow() > 1000) {
      sheet.deleteRows(2, 100); // 2行目から100行削除
    }

    Logger.log('[' + level + '] ' + message);
  } catch (error) {
    Logger.log('ログ記録エラー: ' + error.toString());
  }
}

/**
 * データをシートに書き込む
 *
 * @param {string} sheetName - シート名
 * @param {Array<Array>} data - 2次元配列のデータ
 * @param {Object} options - オプション
 */
function writeDataToSheet(sheetName, data, options) {
  options = options || {};

  const sheet = getOrCreateSheet(sheetName);

  // クリアオプション
  if (options.clear) {
    sheet.clear();
  }

  // データがない場合は終了
  if (!data || data.length === 0) {
    return;
  }

  // 開始行・列
  const startRow = options.startRow || 1;
  const startCol = options.startCol || 1;

  // データを書き込み
  const numRows = data.length;
  const numCols = data[0].length;
  sheet.getRange(startRow, startCol, numRows, numCols).setValues(data);

  // ヘッダー書式設定
  if (options.headerRow) {
    sheet.getRange(options.headerRow, 1, 1, numCols)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
  }

  // 列幅の自動調整
  if (options.autoResize) {
    for (let i = 1; i <= numCols; i++) {
      sheet.autoResizeColumn(i);
    }
  }

  Logger.log(sheetName + ' にデータを書き込みました: ' + numRows + '行');
}

/**
 * シートからデータを読み取る
 *
 * @param {string} sheetName - シート名
 * @param {Object} options - オプション
 * @returns {Array<Array>} データ
 */
function readDataFromSheet(sheetName, options) {
  options = options || {};

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (!sheet) {
    Logger.log('シートが見つかりません: ' + sheetName);
    return [];
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    return [];
  }

  const startRow = options.startRow || 1;
  const startCol = options.startCol || 1;
  const numRows = options.numRows || (lastRow - startRow + 1);
  const numCols = options.numCols || (lastCol - startCol + 1);

  const data = sheet.getRange(startRow, startCol, numRows, numCols).getValues();

  Logger.log(sheetName + ' からデータを読み取りました: ' + data.length + '行');
  return data;
}

/**
 * オブジェクトの配列をシートに書き込む
 *
 * @param {string} sheetName - シート名
 * @param {Array<Object>} objects - オブジェクトの配列
 * @param {Array<string>} headers - ヘッダー名の配列
 * @param {Array<string>} keys - オブジェクトのキーの配列
 */
function writeObjectsToSheet(sheetName, objects, headers, keys) {
  if (!objects || objects.length === 0) {
    Logger.log('書き込むデータがありません');
    return;
  }

  // ヘッダー行を作成
  const data = [headers];

  // データ行を作成
  objects.forEach(obj => {
    const row = keys.map(key => {
      const value = obj[key];
      return value !== undefined && value !== null ? value : '';
    });
    data.push(row);
  });

  // シートに書き込み
  writeDataToSheet(sheetName, data, {
    clear: true,
    headerRow: 1,
    autoResize: true
  });
}

/**
 * 日付をフォーマット
 *
 * @param {Date} date - 日付オブジェクト
 * @param {string} format - フォーマット（デフォルト: 'yyyy-MM-dd HH:mm:ss'）
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(date, format) {
  format = format || 'yyyy-MM-dd HH:mm:ss';

  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), format);
}

/**
 * 価格をフォーマット
 *
 * @param {number} price - 価格
 * @param {string} currency - 通貨コード（デフォルト: 'USD'）
 * @returns {string} フォーマットされた価格文字列
 */
function formatPrice(price, currency) {
  currency = currency || 'USD';

  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥'
  };

  const symbol = symbols[currency] || currency;
  const formattedPrice = parseFloat(price).toFixed(2);

  return symbol + formattedPrice;
}

/**
 * エラーメッセージを表示
 *
 * @param {string} title - タイトル
 * @param {Error} error - エラーオブジェクト
 */
function showError(title, error) {
  const ui = SpreadsheetApp.getUi();
  const message = error.message || error.toString();

  ui.alert(
    title,
    'エラーが発生しました:\n\n' + message,
    ui.ButtonSet.OK
  );

  logToSheet('ERROR', title, message);
}

/**
 * 成功メッセージを表示
 *
 * @param {string} title - タイトル
 * @param {string} message - メッセージ
 */
function showSuccess(title, message) {
  const ui = SpreadsheetApp.getUi();
  ui.alert(title, message, ui.ButtonSet.OK);
  logToSheet('INFO', title, message);
}

/**
 * リトライ付きで関数を実行
 *
 * @param {Function} func - 実行する関数
 * @param {number} maxRetries - 最大リトライ回数
 * @param {number} delay - リトライ間の遅延（ミリ秒）
 * @returns {*} 関数の戻り値
 */
function retryWithDelay(func, maxRetries, delay) {
  maxRetries = maxRetries || 3;
  delay = delay || 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return func();
    } catch (error) {
      Logger.log('リトライ ' + (i + 1) + '/' + maxRetries + ': ' + error.toString());

      if (i === maxRetries - 1) {
        throw error;
      }

      Utilities.sleep(delay);
    }
  }
}

/**
 * 配列をチャンク（分割）
 *
 * @param {Array} array - 分割する配列
 * @param {number} chunkSize - チャンクサイズ
 * @returns {Array<Array>} チャンクされた配列
 */
function chunkArray(array, chunkSize) {
  const chunks = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * プログレスバーを表示（モーダルダイアログ）
 *
 * @param {string} message - メッセージ
 */
function showProgress(message) {
  const html = '<div style="padding: 20px; text-align: center;">' +
    '<p>' + message + '</p>' +
    '<div style="width: 100%; background: #f0f0f0; border-radius: 10px;">' +
    '<div style="width: 0%; height: 20px; background: #4285f4; border-radius: 10px;" id="progress"></div>' +
    '</div>' +
    '</div>';

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(300)
    .setHeight(100);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '処理中...');
}

/**
 * スプレッドシートIDを取得
 *
 * @returns {string} スプレッドシートID
 */
function getSpreadsheetId() {
  return SpreadsheetApp.getActiveSpreadsheet().getId();
}

/**
 * スプレッドシートURLを取得
 *
 * @returns {string} スプレッドシートURL
 */
function getSpreadsheetUrl() {
  return SpreadsheetApp.getActiveSpreadsheet().getUrl();
}
