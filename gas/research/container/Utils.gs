/**
 * eBay利益計算ツール - ユーティリティ関数
 *
 * 汎用的なヘルパー関数を定義
 */

/**
 * 日付を yyyy-MM-dd HH:mm:ss 形式でフォーマット
 *
 * @param {Date} date 日付オブジェクト
 * @returns {string} フォーマットされた日付文字列
 */
function formatDateTime(date) {
  if (!date || !(date instanceof Date)) {
    date = new Date();
  }

  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);

  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
}

/**
 * 配列を指定された列数で分割
 *
 * @param {Array} array 元の配列
 * @param {number} columns 列数
 * @returns {Array} 2次元配列
 */
function chunkArray(array, columns) {
  const result = [];
  for (let i = 0; i < array.length; i += columns) {
    result.push(array.slice(i, i + columns));
  }
  return result;
}

/**
 * オブジェクトを指定されたキーの順序で配列に変換
 *
 * @param {Object} obj オブジェクト
 * @param {Array} keys キーの配列
 * @returns {Array} 値の配列
 */
function objectToArray(obj, keys) {
  return keys.map(function(key) {
    return obj[key] !== undefined ? obj[key] : '';
  });
}

/**
 * セル範囲をクリア
 *
 * @param {Sheet} sheet シートオブジェクト
 * @param {number} row 行番号
 * @param {number} col 列番号
 * @param {number} numRows 行数
 * @param {number} numCols 列数
 */
function clearRange(sheet, row, col, numRows, numCols) {
  numRows = numRows || 1;
  numCols = numCols || 1;
  sheet.getRange(row, col, numRows, numCols).clearContent();
}

/**
 * ログをスプレッドシートに記録
 *
 * @param {string} message ログメッセージ
 * @param {string} level ログレベル（INFO, WARN, ERROR）
 */
function logToSheet(message, level) {
  try {
    level = level || 'INFO';

    const logSheet = ss.getSheetByName('ログ');

    // ログシートがなければ作成
    if (!logSheet) {
      const newLogSheet = ss.insertSheet('ログ');
      newLogSheet.getRange(1, 1, 1, 4).setValues([['日時', 'レベル', 'メッセージ', 'ユーザー']]);
      newLogSheet.setFrozenRows(1);
    }

    const targetSheet = ss.getSheetByName('ログ');
    const lastRow = targetSheet.getLastRow();
    const newRow = lastRow + 1;

    const logData = [
      formatDateTime(new Date()),
      level,
      message,
      Session.getActiveUser().getEmail()
    ];

    targetSheet.getRange(newRow, 1, 1, 4).setValues([logData]);

    // ログが1000行を超えたら古いログを削除
    if (newRow > 1000) {
      targetSheet.deleteRows(2, 100);
    }

  } catch (error) {
    Logger.log('logToSheetエラー: ' + error.toString());
  }
}

/**
 * エラーメッセージを整形
 *
 * @param {Error} error エラーオブジェクト
 * @returns {string} 整形されたエラーメッセージ
 */
function formatErrorMessage(error) {
  if (!error) {
    return '不明なエラー';
  }

  let message = error.toString();

  // スタックトレースがある場合は含める
  if (error.stack) {
    message += '\n\n' + error.stack;
  }

  return message;
}

/**
 * URLが有効かチェック
 *
 * @param {string} url URL文字列
 * @returns {boolean} 有効な場合true
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // 基本的なURL形式チェック
  const urlPattern = /^https?:\/\/.+/i;
  return urlPattern.test(url);
}

/**
 * eBay URLかチェック
 *
 * @param {string} url URL文字列
 * @returns {boolean} eBay URLの場合true
 */
function isEbayUrl(url) {
  if (!isValidUrl(url)) {
    return false;
  }

  return url.toLowerCase().includes('ebay.com');
}

/**
 * 数値を通貨形式でフォーマット
 *
 * @param {number} value 数値
 * @param {string} currency 通貨記号（デフォルト: $）
 * @returns {string} フォーマットされた文字列
 */
function formatCurrency(value, currency) {
  currency = currency || '$';

  if (isNaN(value)) {
    return currency + '0.00';
  }

  return currency + value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

/**
 * パーセンテージをフォーマット
 *
 * @param {number} value 数値（0-1の範囲）
 * @param {number} decimals 小数点以下の桁数
 * @returns {string} フォーマットされた文字列
 */
function formatPercentage(value, decimals) {
  decimals = decimals !== undefined ? decimals : 2;

  if (isNaN(value)) {
    return '0%';
  }

  return (value * 100).toFixed(decimals) + '%';
}

/**
 * オブジェクトの深いコピーを作成
 *
 * @param {Object} obj コピー元オブジェクト
 * @returns {Object} コピーされたオブジェクト
 */
function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 配列から重複を除去
 *
 * @param {Array} array 配列
 * @returns {Array} 重複を除去した配列
 */
function unique(array) {
  return array.filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });
}

/**
 * スリープ（指定ミリ秒待機）
 *
 * @param {number} milliseconds 待機時間（ミリ秒）
 */
function sleep(milliseconds) {
  Utilities.sleep(milliseconds);
}

/**
 * ランダムな遅延を追加（API制限対策）
 *
 * @param {number} minMs 最小待機時間（ミリ秒）
 * @param {number} maxMs 最大待機時間（ミリ秒）
 */
function randomDelay(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  Utilities.sleep(delay);
}

/**
 * 画像URLから取得元サイト名を判定
 *
 * @param {string} imageUrl 画像URL
 * @returns {string} サイト名（eBay, メルカリ, ヤフオク, 不明）
 */
function getSiteNameFromImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return '不明';
  }

  const url = imageUrl.toLowerCase();

  // eBay
  if (url.includes('ebayimg.com') || url.includes('ebay.com')) {
    return 'eBay';
  }

  // メルカリ
  if (url.includes('mercdn.net') || url.includes('mercari.com')) {
    return 'メルカリ';
  }

  // ヤフオク
  if (url.includes('yimg.jp') || url.includes('yahoo.co.jp')) {
    return 'ヤフオク';
  }

  // Amazon
  if (url.includes('amazon.co.jp') || url.includes('amazon.com') ||
      url.includes('m.media-amazon.com') || url.includes('images-na.ssl-images-amazon.com')) {
    return 'Amazon';
  }

  // オフモール（ハードオフ・オフハウス等）
  if (url.includes('imageflux.jp') || url.includes('netmall.hardoff.co.jp')) {
    return 'オフモール';
  }

  // 駿河屋
  if (url.includes('cdn.suruga-ya.jp') || url.includes('suruga-ya.jp')) {
    return '駿河屋';
  }

  // デジマート
  if (url.includes('img.digimart.net') || url.includes('digimart.net')) {
    return 'デジマート';
  }

  // その他
  return '不明';
}

/**
 * リサーチシートからポリシー別のデータを取得
 *
 * @param {number} policyRow ポリシー行番号（14, 15, 16のいずれか）
 * @returns {Object} ポリシーデータ
 */
function getPolicyData(policyRow) {
  try {
    const researchSheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);

    if (!researchSheet) {
      throw new Error('リサーチシートが見つかりません');
    }

    const policyName = researchSheet.getRange(policyRow, RESEARCH_POLICY.COLUMNS.POLICY_NAME.col).getValue();
    const shippingCarrier = researchSheet.getRange(policyRow, RESEARCH_POLICY.COLUMNS.SHIPPING_CARRIER.col).getValue();
    const shippingMethod = researchSheet.getRange(policyRow, RESEARCH_POLICY.COLUMNS.SHIPPING_METHOD.col).getValue();
    const profitAmountBeforeRefund = researchSheet.getRange(policyRow, RESEARCH_POLICY.COLUMNS.PROFIT_AMOUNT_BEFORE_REFUND.col).getValue();
    const profitRateBeforeRefund = researchSheet.getRange(policyRow, RESEARCH_POLICY.COLUMNS.PROFIT_RATE_BEFORE_REFUND.col).getValue();
    const profitAmountAfterRefund = researchSheet.getRange(policyRow, RESEARCH_POLICY.COLUMNS.PROFIT_AMOUNT_AFTER_REFUND.col).getValue();
    const profitRateAfterRefund = researchSheet.getRange(policyRow, RESEARCH_POLICY.COLUMNS.PROFIT_RATE_AFTER_REFUND.col).getValue();

    return {
      policyName: policyName || '',
      shippingCarrier: shippingCarrier || '',
      shippingMethod: shippingMethod || '',
      profitAmountBeforeRefund: profitAmountBeforeRefund || 0,
      profitRateBeforeRefund: profitRateBeforeRefund || 0,
      profitAmountAfterRefund: profitAmountAfterRefund || 0,
      profitRateAfterRefund: profitRateAfterRefund || 0
    };

  } catch (error) {
    Logger.log('getPolicyDataエラー: ' + error.toString());
    return {
      policyName: '',
      shippingCarrier: '',
      shippingMethod: '',
      profitAmountBeforeRefund: 0,
      profitRateBeforeRefund: 0,
      profitAmountAfterRefund: 0,
      profitRateAfterRefund: 0
    };
  }
}

/**
 * 全ポリシーのデータを取得
 *
 * @returns {Array<Object>} ポリシーデータの配列
 */
function getAllPolicyData() {
  return [
    getPolicyData(RESEARCH_POLICY.POLICY_1_ROW),
    getPolicyData(RESEARCH_POLICY.POLICY_2_ROW),
    getPolicyData(RESEARCH_POLICY.POLICY_3_ROW)
  ];
}

/**
 * SKUを生成
 *
 * @param {string} researchMethod リサーチ方法
 * @param {string} staffName 担当者名
 * @param {number} profitAmount 利益額
 * @param {number} profitRate 利益率（小数: 0.25 = 25%）
 * @returns {string} SKU（例: eBay/田中/1500/25/20260328143052）
 */
function generateSKU(researchMethod, staffName, profitAmount, profitRate) {
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');

  // 利益額を整数に丸める
  const profitAmountInt = Math.round(profitAmount);

  // 利益率を整数％に丸める（0.25 → 25）
  const profitRateInt = Math.round(profitRate * 100);

  const sku = researchMethod + '/' + staffName + '/' + profitAmountInt + '/' + profitRateInt + '/' + timestamp;

  return sku;
}

/**
 * 列番号をアルファベット列名に変換
 * @param {number} columnNumber 列番号（1-based）
 * @returns {string} 列名（A, B, ... Z, AA, AB, ...）
 */
function getColumnLetter(columnNumber) {
  let columnName = '';
  while (columnNumber > 0) {
    const modulo = (columnNumber - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    columnNumber = Math.floor((columnNumber - modulo) / 26);
  }
  return columnName;
}

/**
 * ツール設定シートから仕入元マッピングを取得
 * @returns {Array<Object>} [{name: '仕入元名', url: 'URL'}, ...]
 */
function getPurchaseSourceMappings() {
  try {
    const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);

    if (!settingsSheet) {
      Logger.log('ツール設定シートが見つかりません');
      return [];
    }

    const data = settingsSheet.getDataRange().getValues();

    if (data.length === 0) {
      Logger.log('ツール設定シートにデータがありません');
      return [];
    }

    // 1行目をヘッダー行として取得
    const headerRow = data[0];

    // ヘッダー名から列インデックスをマッピング
    const columnMap = {};
    for (let i = 0; i < headerRow.length; i++) {
      const headerName = String(headerRow[i]).trim();
      if (headerName) {
        columnMap[headerName] = i;
      }
    }

    // 「仕入元」列と「仕入元URL」列のインデックスを取得
    // 複数のヘッダー名候補に対応
    let purchaseSourceColIndex = columnMap['仕入元'];
    if (purchaseSourceColIndex === undefined) {
      purchaseSourceColIndex = columnMap['仕入元名'];
    }

    let purchaseSourceUrlColIndex = columnMap['仕入元URL'];
    if (purchaseSourceUrlColIndex === undefined) {
      purchaseSourceUrlColIndex = columnMap['URL'];
    }
    if (purchaseSourceUrlColIndex === undefined) {
      purchaseSourceUrlColIndex = columnMap['仕入元トップページURL'];
    }

    if (purchaseSourceColIndex === undefined || purchaseSourceUrlColIndex === undefined) {
      Logger.log('仕入元マッピング列が見つかりません（「仕入元」「仕入元URL」列が必要です）');
      return [];
    }

    // データ行（2行目以降）を抽出
    const mappings = [];
    for (let i = 1; i < data.length; i++) {
      const sourceName = data[i][purchaseSourceColIndex];
      const sourceUrl = data[i][purchaseSourceUrlColIndex];

      if (sourceName && sourceUrl) {
        mappings.push({
          name: String(sourceName).trim(),
          url: String(sourceUrl).trim()
        });
      }
    }

    Logger.log('仕入元マッピング取得: ' + mappings.length + '件');
    return mappings;

  } catch (error) {
    Logger.log('getPurchaseSourceMappingsエラー: ' + error.toString());
    return [];
  }
}

/**
 * URLから仕入元名を取得（ツール設定シートのマッピングを使用）
 * @param {string} url 仕入元URL
 * @returns {string} 仕入元名（見つからない場合は空文字）
 */
function getPurchaseSourceNameFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const mappings = getPurchaseSourceMappings();

  // URLの冒頭が一致するマッピングを探す
  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i];
    if (url.indexOf(mapping.url) === 0) {
      Logger.log('仕入元一致: ' + mapping.name + ' (' + mapping.url + ')');
      return mapping.name;
    }
  }

  // 見つからない場合は従来の判定ロジックにフォールバック
  Logger.log('マッピングに一致しないため、従来ロジックで判定: ' + url);
  return getSiteNameFromImageUrl(url);
}

/**
 * リサーチシートのB13:H16のヘッダーを取得
 * @returns {Object} ヘッダー情報
 */
function getResearchSheetHeaders() {
  try {
    const researchSheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);

    if (!researchSheet) {
      return { error: 'リサーチシートが見つかりません' };
    }

    // B13:H16の範囲を取得
    const range = researchSheet.getRange('B13:H16');
    const values = range.getValues();

    // 13行目（ヘッダー行）を取得
    const headerRow = values[0];

    // 14-16行目のポリシー名を取得
    const policy1 = values[1];
    const policy2 = values[2];
    const policy3 = values[3];

    const result = {
      headerRange: 'B13:H13',
      headers: headerRow,
      headerMapping: {},
      policy1Row: policy1,
      policy2Row: policy2,
      policy3Row: policy3
    };

    // ヘッダーをマッピング（列番号とヘッダー名）
    const columns = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (let i = 0; i < headerRow.length; i++) {
      result.headerMapping[columns[i]] = headerRow[i];
    }

    Logger.log('リサーチシートヘッダー: ' + JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    Logger.log('getResearchSheetHeadersエラー: ' + error.toString());
    return { error: error.toString() };
  }
}

/**
 * 出品シートの最初の10行を取得（ヘッダー行確認用）
 * @returns {Object} 最初の10行
 */
function inspectListingSheetRows() {
  try {
    const config = getEbayConfig();
    const listingSpreadsheetId = config.listingSpreadsheetId;

    if (!listingSpreadsheetId) {
      return { error: '出品シートが設定されていません' };
    }

    const listingSpreadsheet = SpreadsheetApp.openById(listingSpreadsheetId);
    const listingSheet = listingSpreadsheet.getSheetByName(SHEET_NAMES.LISTING);

    if (!listingSheet) {
      return { error: '出品シートが見つかりません' };
    }

    const lastCol = listingSheet.getLastColumn();
    const numColsToShow = Math.min(lastCol, 30);
    const rows = listingSheet.getRange(1, 1, 10, numColsToShow).getValues();

    const result = {
      totalColumns: lastCol,
      row1: rows[0],
      row2: rows[1],
      row3: rows[2],
      row4: rows[3],
      row5: rows[4],
      row6: rows[5]
    };

    Logger.log('行1: ' + JSON.stringify(rows[0].slice(0, 15)));
    Logger.log('行2: ' + JSON.stringify(rows[1].slice(0, 15)));
    Logger.log('行3: ' + JSON.stringify(rows[2].slice(0, 15)));
    Logger.log('行4: ' + JSON.stringify(rows[3].slice(0, 15)));

    return result;

  } catch (error) {
    Logger.log('inspectListingSheetRowsエラー: ' + error.toString());
    return { error: error.toString() };
  }
}

/**
 * 出品シートの列マッピングを順番に表示
 * @returns {Array} 列情報の配列
 */
function showListingColumnMapping() {
  try {
    const config = getEbayConfig();
    const listingSpreadsheetId = config.listingSpreadsheetId;

    if (!listingSpreadsheetId) {
      return { error: '出品シートが設定されていません' };
    }

    const listingSpreadsheet = SpreadsheetApp.openById(listingSpreadsheetId);
    const listingSheet = listingSpreadsheet.getSheetByName(SHEET_NAMES.LISTING);

    if (!listingSheet) {
      return { error: '出品シートが見つかりません' };
    }

    const headerRow = LISTING_ROWS.HEADER;
    const lastCol = listingSheet.getLastColumn();
    const headers = listingSheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];

    const result = [];
    for (let i = 0; i < Math.min(headers.length, 60); i++) {
      const header = headers[i];
      const colLetter = getColumnLetter(i + 1);
      result.push({
        col: i + 1,
        letter: colLetter,
        header: header
      });
      Logger.log((i + 1) + '. ' + colLetter + ': ' + header);
    }

    return result;

  } catch (error) {
    Logger.log('showListingColumnMappingエラー: ' + error.toString());
    return { error: error.toString() };
  }
}

/**
 * 出品シート（メイン）のヘッダー行を取得
 * @returns {Object} ヘッダー情報
 */
function getListingSheetHeaders() {
  try {
    const config = getEbayConfig();
    const listingSpreadsheetId = config.listingSpreadsheetId;

    if (!listingSpreadsheetId) {
      return { error: '出品シートが設定されていません' };
    }

    const listingSpreadsheet = SpreadsheetApp.openById(listingSpreadsheetId);
    const listingSheet = listingSpreadsheet.getSheetByName(SHEET_NAMES.LISTING);

    if (!listingSheet) {
      return { error: '出品シートが見つかりません' };
    }

    // ヘッダー行を取得（4行目）
    const headerRow = LISTING_ROWS.HEADER;
    const lastCol = listingSheet.getLastColumn();
    const headers = listingSheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];

    const result = {
      headerRow: headerRow,
      totalColumns: lastCol,
      headers: headers,
      headerMapping: {}
    };

    // ヘッダー名から列番号へのマッピング
    for (let i = 0; i < headers.length; i++) {
      const headerName = headers[i];
      if (headerName) {
        result.headerMapping[headerName] = {
          col: i + 1,
          letter: getColumnLetter(i + 1)
        };
      }
    }

    Logger.log('出品シートヘッダー総数: ' + lastCol);
    Logger.log('新規追加列の確認:');
    Logger.log('  - 発送業者: ' + JSON.stringify(result.headerMapping['発送業者']));
    Logger.log('  - 還付抜き利益: ' + JSON.stringify(result.headerMapping['還付抜き利益']));
    Logger.log('  - 還付抜き利益額: ' + JSON.stringify(result.headerMapping['還付抜き利益額']));
    Logger.log('  - 還付込み利益額: ' + JSON.stringify(result.headerMapping['還付込み利益額']));
    Logger.log('  - 還付込み利益率: ' + JSON.stringify(result.headerMapping['還付込み利益率']));

    return result;

  } catch (error) {
    Logger.log('getListingSheetHeadersエラー: ' + error.toString());
    return { error: error.toString() };
  }
}
