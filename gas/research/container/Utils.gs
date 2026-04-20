/**
 * eBay利益計算ツール - ユーティリティ関数
 *
 * 汎用的なヘルパー関数を定義
 */

// サイトマスタキャッシュ（スクリプト実行内で再利用）
var _siteMasterCache = null;

/**
 * ツール設定シートからサイトマスタを読み込む（実行内キャッシュ付き）
 * 「サイト名」「ドメイン」「画像取得」のヘッダー行を動的に検索
 *
 * @returns {Array<{name: string, domain: string, imageSupported: boolean}>}
 *   ドメイン長降順（具体的なものを先に判定するため）
 *   imageSupported: 「画像取得」列に「対応」と記載された場合のみ true
 */
function getSiteMaster() {
  if (_siteMasterCache !== null) return _siteMasterCache;

  const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!settingsSheet) {
    Logger.log('⚠️ [getSiteMaster] ツール設定シートが見つかりません');
    _siteMasterCache = [];
    return _siteMasterCache;
  }

  const data = settingsSheet.getDataRange().getValues();
  _siteMasterCache = [];

  // 「サイト名」「ドメイン」が同じ行に揃っているヘッダー行を動的に探す
  // 「画像取得」列はオプション（存在しない場合は imageSupported が常に false）
  let startRow  = -1;
  let nameCol   = -1;
  let domainCol = -1;
  let imageCol  = -1;

  for (let i = 0; i < data.length; i++) {
    let nc = -1;
    let dc = -1;
    let ic = -1;
    for (let j = 0; j < data[i].length; j++) {
      const cell = String(data[i][j] || '').trim();
      if (cell === 'サイト名') nc = j;
      if (cell === 'ドメイン')  dc = j;
      if (cell === '画像取得') ic = j;
    }
    if (nc !== -1 && dc !== -1) {
      startRow  = i + 1;
      nameCol   = nc;
      domainCol = dc;
      imageCol  = ic; // -1 の場合は列なし（imageSupported は常に false）
      break;
    }
  }

  if (startRow === -1) {
    Logger.log('⚠️ [getSiteMaster] ツール設定シートにサイト名/ドメインマッピングが見つかりません');
    return _siteMasterCache;
  }

  Logger.log('[getSiteMaster] 画像取得列: ' + (imageCol >= 0 ? '列' + (imageCol + 1) : '未設定'));

  for (let i = startRow; i < data.length; i++) {
    const name   = String(data[i][nameCol]   || '').trim();
    const domain = String(data[i][domainCol] || '').trim().toLowerCase();
    if (!name || !domain) break; // 空行で終了
    const imageSupported = imageCol >= 0 && String(data[i][imageCol] || '').trim() === '対応';
    _siteMasterCache.push({ name: name, domain: domain, imageSupported: imageSupported });
  }

  // ドメインが長い順にソート（より具体的なドメインを先にヒットさせる）
  _siteMasterCache.sort(function(a, b) { return b.domain.length - a.domain.length; });

  Logger.log('[getSiteMaster] サイトマスタ読み込み: ' + _siteMasterCache.length + '件');
  return _siteMasterCache;
}

/**
 * URLに対してツール設定シートの「画像取得」列が「対応」かを返す
 *
 * @param {string} url 商品ページURL
 * @returns {boolean} true = 画像取得対応、false = 非対応または未登録
 */
function isImageSupportedForUrl(url) {
  if (!url) return false;
  const u = url.toString().toLowerCase();
  const master = getSiteMaster();
  for (let i = 0; i < master.length; i++) {
    if (u.indexOf(master[i].domain) !== -1) {
      return master[i].imageSupported;
    }
  }
  return false; // 未登録サイトは非対応
}

/**
 * URLからサイト名を判定（ツール設定シートのサイトマスタを使用・indexOf部分一致）
 *
 * @param {string} url 商品ページURL または 画像URL
 * @returns {string} サイト名（マスタ未登録の場合は '不明'）
 */
function getSiteName(url) {
  if (!url) return '不明';
  const u = url.toString().toLowerCase();
  const master = getSiteMaster();
  for (let i = 0; i < master.length; i++) {
    if (u.indexOf(master[i].domain) !== -1) return master[i].name;
  }
  return '不明';
}

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

    // 「サイト名」「ドメイン」列のインデックスを取得（旧ヘッダー名もフォールバックとして対応）
    let purchaseSourceColIndex = columnMap['サイト名'];
    if (purchaseSourceColIndex === undefined) purchaseSourceColIndex = columnMap['仕入元'];
    if (purchaseSourceColIndex === undefined) purchaseSourceColIndex = columnMap['仕入元名'];

    let purchaseSourceUrlColIndex = columnMap['ドメイン'];
    if (purchaseSourceUrlColIndex === undefined) purchaseSourceUrlColIndex = columnMap['仕入元URL'];
    if (purchaseSourceUrlColIndex === undefined) purchaseSourceUrlColIndex = columnMap['URL'];
    if (purchaseSourceUrlColIndex === undefined) purchaseSourceUrlColIndex = columnMap['仕入元トップページURL'];

    if (purchaseSourceColIndex === undefined || purchaseSourceUrlColIndex === undefined) {
      Logger.log('仕入元マッピング列が見つかりません（「サイト名」「ドメイン」列が必要です）');
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

  // 見つからない場合は getSiteName() にフォールバック
  Logger.log('マッピングに一致しないため getSiteName() で判定: ' + url);
  return getSiteName(url);
}

/**
 * リサーチシートの全セクションの実データとヘッダー整合性を診断
 * clasp run diagnoseResearchSheet で実行
 */
function diagnoseResearchSheet() {
  try {
    const sheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);
    if (!sheet) return 'ERROR: シート「' + SHEET_NAMES.RESEARCH + '」が見つかりません';

    const lines = ['=== リサーチシート構造診断 ===', ''];

    // ヘッダー行チェック関数
    const checkHeader = function(row, col, expectedHeader) {
      const actual = String(sheet.getRange(row, col).getValue()).trim();
      const ok = actual === expectedHeader;
      return (ok ? '✅' : '❌') + ' ' + row + '行' + col + '列: 期待「' + expectedHeader + '」 実際「' + actual + '」';
    };

    // データ値読み取り関数
    const readCell = function(row, col, label) {
      const val = sheet.getRange(row, col).getValue();
      const display = (val === '' || val === null || val === undefined) ? '(空)' : String(val);
      return '  ' + label + ' [' + row + '行' + col + '列]: ' + display;
    };

    // --- RESEARCH_TOP_INFO (ヘッダー:1行, データ:2行) ---
    lines.push('--- TOP_INFO (ヘッダー1行目 / データ2行目) ---');
    lines.push(checkHeader(1, 2, '担当者'));
    lines.push(readCell(2, 2, 'staff(リサーチ担当)'));
    lines.push(readCell(2, 4, 'keyword'));
    lines.push('');

    // --- RESEARCH_MAIN_INFO (ヘッダー:4行, データ:5行) ---
    lines.push('--- MAIN_INFO (ヘッダー4行目 / データ5行目) ---');
    lines.push(checkHeader(4, 2, '仕入値(¥)'));
    lines.push(readCell(5, 2, 'purchasePrice'));
    lines.push(readCell(5, 3, 'sellingPrice'));
    lines.push(readCell(5, 5, 'bestOffer'));
    lines.push('');

    // --- RESEARCH_ITEM_LIST (ヘッダー:7行, データ:8行) ---
    lines.push('--- ITEM_LIST (ヘッダー7行目 / データ8行目) ---');
    lines.push(checkHeader(7, 2, 'Item URL'));
    lines.push(checkHeader(7, 3, '検索URL'));
    lines.push(checkHeader(7, 4, 'スペックURL'));
    lines.push(checkHeader(7, 5, '状態'));
    lines.push(readCell(8, 2, 'itemUrl'));
    lines.push(readCell(8, 3, 'lowestPriceUrl'));
    lines.push(readCell(8, 4, 'specUrl'));
    lines.push(readCell(8, 5, 'condition(状態)'));
    lines.push(readCell(8, 7, 'categoryId'));
    lines.push(readCell(8, 8, 'categoryName'));
    lines.push('');

    // --- RESEARCH_PRICE_INFO (ヘッダー:10行, データ:11行) ---
    lines.push('--- PRICE_INFO (ヘッダー10行目 / データ11行目) ---');
    lines.push(checkHeader(10, 2, '仕入れキーワード'));
    lines.push(readCell(11, 2, 'purchaseKeyword'));
    lines.push(readCell(11, 4, 'purchaseUrl1'));
    lines.push(readCell(11, 5, 'purchaseUrl2'));
    lines.push(readCell(11, 6, 'purchaseUrl3'));
    lines.push(readCell(11, 7, 'imageUrl'));
    lines.push(readCell(11, 8, 'memo'));
    lines.push('');

    // --- RESEARCH_POLICY (ヘッダー:13行, データ:14-16行) ---
    lines.push('--- POLICY (ヘッダー13行目 / データ14-16行目) ---');
    lines.push(checkHeader(13, 2, 'ポリシー'));
    lines.push(readCell(14, 2, 'policy1'));
    lines.push(readCell(15, 2, 'policy2'));
    lines.push(readCell(16, 2, 'policy3'));
    lines.push('');

    // ヘッダー不一致サマリー
    const errors = lines.filter(function(l) { return l.indexOf('❌') !== -1; });
    lines.push('--- サマリー ---');
    lines.push('ヘッダー不一致: ' + errors.length + '件');
    if (errors.length > 0) {
      lines.push('⚠️ Config.gsの行列定義と実際のシート構造が一致していません');
    } else {
      lines.push('✅ 全ヘッダー一致 - Config.gsの定義と実際のシートが一致');
    }

    return lines.join('\n');

  } catch (error) {
    return 'ERROR: ' + error.toString();
  }
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

    // ヘッダー行を取得（1行目）
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

/**
 * 出品シートの最新行データ + 全LISTING_COLUMNS照合 + 空データ原因を診断
 * clasp run diagnoseListingLastRow で実行
 */
function diagnoseListingLastRow() {
  try {
    const config = getEbayConfig();
    const lss = SpreadsheetApp.openById(config.listingSpreadsheetId);
    const listingSheet = lss.getSheetByName(SHEET_NAMES.LISTING);
    if (!listingSheet) return 'ERROR: 出品シートが見つかりません';

    const lastCol = listingSheet.getLastColumn();
    const headers = listingSheet.getRange(LISTING_ROWS.HEADER, 1, 1, lastCol).getValues()[0];

    // ヘッダー→列番号マップ
    const hmap = {};
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).trim();
      if (h) hmap[h] = i + 1;
    }

    // SKU列を特定
    const skuCol = hmap[LISTING_COLUMNS.SKU.header];

    // SKU列で最後にデータがある行を後ろから検索（getLastRowはフォーマットのみの行を含む場合があるため）
    let targetRow = -1;
    if (skuCol) {
      // SKU列の全データを一括取得（データ開始行から）
      const dataStart = LISTING_ROWS.DATA_START;
      const sheetLastRow = listingSheet.getLastRow();
      if (sheetLastRow >= dataStart) {
        const skuColData = listingSheet.getRange(dataStart, skuCol, sheetLastRow - dataStart + 1, 1).getValues();
        for (let r = skuColData.length - 1; r >= 0; r--) {
          if (skuColData[r][0] !== '' && skuColData[r][0] !== null) {
            targetRow = r + dataStart;
            break;
          }
        }
      }
    }
    // SKUで見つからなければ getLastRow() を使用
    const lastRow = targetRow > 0 ? targetRow : listingSheet.getLastRow();
    const dataStart2 = LISTING_ROWS.DATA_START;
    const rowData = lastRow >= dataStart2
      ? listingSheet.getRange(lastRow, 1, 1, lastCol).getValues()[0]
      : [];

    const rowSource = targetRow > 0 ? 'SKU列で検索' : 'getLastRow()フォールバック';
    const lines = [
      '=== 出品シート最新行診断 ===',
      '対象行: ' + lastRow + '行目 / 総列数: ' + lastCol + ' / 行特定方法: ' + rowSource,
      ''
    ];

    // 転記関数で書き込む全列をチェック
    const checkCols = [
      { key: 'SKU',              h: LISTING_COLUMNS.SKU.header,              req: true  },
      { key: 'LISTING_URL',      h: LISTING_COLUMNS.LISTING_URL.header,      req: true  },
      { key: 'STATUS',           h: LISTING_COLUMNS.STATUS.header,           req: true  },
      { key: 'KEYWORD',          h: LISTING_COLUMNS.KEYWORD.header,          req: true  },
      { key: 'MEMO',             h: LISTING_COLUMNS.MEMO.header,             req: true  },
      { key: 'PURCHASE_SOURCE_1',h: LISTING_COLUMNS.PURCHASE_SOURCE_1.header,req: true  },
      { key: 'PURCHASE_URL_1',   h: LISTING_COLUMNS.PURCHASE_URL_1.header,   req: true  },
      { key: 'PURCHASE_SOURCE_2',h: LISTING_COLUMNS.PURCHASE_SOURCE_2.header,req: true  },
      { key: 'PURCHASE_URL_2',   h: LISTING_COLUMNS.PURCHASE_URL_2.header,   req: true  },
      { key: 'PURCHASE_SOURCE_3',h: LISTING_COLUMNS.PURCHASE_SOURCE_3.header,req: true  },
      { key: 'PURCHASE_URL_3',   h: LISTING_COLUMNS.PURCHASE_URL_3.header,   req: true  },
      { key: 'RESEARCH_STAFF',   h: LISTING_COLUMNS.RESEARCH_STAFF.header,   req: true  },
      { key: 'LISTING_STAFF',    h: LISTING_COLUMNS.LISTING_STAFF.header,    req: false },
      { key: 'PICKUP_STAFF',     h: LISTING_COLUMNS.PICKUP_STAFF.header,     req: false },
      { key: 'WORD_CHECK',       h: LISTING_COLUMNS.WORD_CHECK.header,       req: false },
      { key: 'TITLE',            h: LISTING_COLUMNS.TITLE.header,            req: true  },
      { key: 'CHAR_COUNT_1',     h: LISTING_COLUMNS.CHAR_COUNT_1.header,     req: true  },
      { key: 'CONDITION',        h: LISTING_COLUMNS.CONDITION.header,        req: true  },
      { key: 'ITEM_URL',         h: LISTING_COLUMNS.ITEM_URL.header,         req: true  },
      { key: 'SPEC_URL',         h: LISTING_COLUMNS.SPEC_URL.header,         req: true  },
      { key: 'CATEGORY_ID',      h: LISTING_COLUMNS.CATEGORY_ID.header,      req: true  },
      { key: 'CATEGORY_NAME',    h: LISTING_COLUMNS.CATEGORY_NAME.header,    req: true  },
      { key: 'BRAND',            h: LISTING_COLUMNS.BRAND.header,            req: true  },
      { key: 'SHIPPING_CARRIER', h: LISTING_COLUMNS.SHIPPING_CARRIER.header, req: true  },
      { key: 'SHIPPING_METHOD',  h: LISTING_COLUMNS.SHIPPING_METHOD.header,  req: true  },
      { key: 'ACTUAL_WEIGHT',    h: LISTING_COLUMNS.ACTUAL_WEIGHT.header,    req: true  },
      { key: 'QUANTITY',         h: LISTING_COLUMNS.QUANTITY.header,         req: true  },
      { key: 'PURCHASE_PRICE',   h: LISTING_COLUMNS.PURCHASE_PRICE.header,   req: true  },
      { key: 'SELLING_PRICE',    h: LISTING_COLUMNS.SELLING_PRICE.header,    req: true  },
      { key: 'BEST_OFFER',       h: LISTING_COLUMNS.BEST_OFFER.header,       req: true  },
      { key: 'LOWEST_PRICE_URL', h: LISTING_COLUMNS.LOWEST_PRICE_URL.header, req: true  },
      { key: 'PROFIT_RATE_BEFORE_REFUND',  h: LISTING_COLUMNS.PROFIT_RATE_BEFORE_REFUND.header,  req: true },
      { key: 'PROFIT_AMOUNT_BEFORE_REFUND',h: LISTING_COLUMNS.PROFIT_AMOUNT_BEFORE_REFUND.header,req: true },
      { key: 'PROFIT_AMOUNT_AFTER_REFUND', h: LISTING_COLUMNS.PROFIT_AMOUNT_AFTER_REFUND.header, req: true },
      { key: 'PROFIT_RATE_AFTER_REFUND',   h: LISTING_COLUMNS.PROFIT_RATE_AFTER_REFUND.header,   req: true },
      { key: 'IMAGE_URL',        h: LISTING_COLUMNS.IMAGE_URL.header,        req: true  },
      { key: 'STORE_IMAGE',      h: LISTING_COLUMNS.STORE_IMAGE.header,      req: true  },
      { key: 'LISTING_TIMESTAMP',h: LISTING_COLUMNS.LISTING_TIMESTAMP.header,req: true  },
      { key: 'MGMT_YEAR_MONTH',  h: LISTING_COLUMNS.MGMT_YEAR_MONTH.header,  req: true  }
    ];

    const noHeaderCols = [];
    const emptyDataCols = [];
    const filledCols = [];

    for (let i = 0; i < checkCols.length; i++) {
      const c = checkCols[i];
      const col = hmap[c.h];
      const reqLabel = c.req ? '[必須]' : '[任意]';
      if (!col) {
        noHeaderCols.push('❌ ヘッダー未検出 ' + reqLabel + ' 「' + c.h + '」');
      } else {
        const val = rowData.length > 0 ? rowData[col - 1] : '(行なし)';
        const isEmpty = (val === '' || val === null || val === undefined);
        const display = isEmpty ? '(空)' : String(val).substring(0, 60);
        if (isEmpty) {
          emptyDataCols.push('⬜ col=' + col + ' ' + reqLabel + ' 「' + c.h + '」 → ' + display);
        } else {
          filledCols.push('✅ col=' + col + ' 「' + c.h + '」 → ' + display);
        }
      }
    }

    lines.push('--- ヘッダー未検出（シートに列が存在しない） ---');
    lines.push(noHeaderCols.length > 0 ? noHeaderCols.join('\n') : '(なし)');
    lines.push('');
    lines.push('--- データ空（ヘッダーはあるが値が空） ---');
    lines.push(emptyDataCols.length > 0 ? emptyDataCols.join('\n') : '(なし)');
    lines.push('');
    lines.push('--- データあり ---');
    lines.push(filledCols.length > 0 ? filledCols.join('\n') : '(なし)');
    lines.push('');
    lines.push('--- サマリー ---');
    lines.push('ヘッダー未検出: ' + noHeaderCols.length + '件  データ空: ' + emptyDataCols.length + '件  データあり: ' + filledCols.length + '件');

    return lines.join('\n');

  } catch (error) {
    return 'ERROR: ' + error.toString();
  }
}

/**
 * 出品シートのヘッダーとConfig.gsのLISTING_COLUMNS定義を照合してエビデンス出力
 * clasp run diagnoseListingHeaders で実行
 */
function diagnoseListingHeaders() {
  try {
    const config = getEbayConfig();
    const listingSpreadsheet = SpreadsheetApp.openById(config.listingSpreadsheetId);
    const listingSheet = listingSpreadsheet.getSheetByName(SHEET_NAMES.LISTING);

    if (!listingSheet) {
      return 'ERROR: シート「' + SHEET_NAMES.LISTING + '」が見つかりません';
    }

    // 実際のヘッダーを取得
    const lastCol = listingSheet.getLastColumn();
    const actualHeaders = listingSheet.getRange(LISTING_ROWS.HEADER, 1, 1, lastCol).getValues()[0];

    // ヘッダー名→列番号マップ
    const actualMap = {};
    for (let i = 0; i < actualHeaders.length; i++) {
      const h = String(actualHeaders[i]).trim();
      if (h) actualMap[h] = i + 1;
    }

    // Config.gsのLISTING_COLUMNS全キーと照合
    const defined = [
      LISTING_COLUMNS.LISTING_URL.header,
      LISTING_COLUMNS.STATUS.header,
      LISTING_COLUMNS.SKU.header,
      LISTING_COLUMNS.KEYWORD.header,
      LISTING_COLUMNS.MEMO.header,
      LISTING_COLUMNS.PURCHASE_SOURCE_1.header,
      LISTING_COLUMNS.PURCHASE_URL_1.header,
      LISTING_COLUMNS.PURCHASE_SOURCE_2.header,
      LISTING_COLUMNS.PURCHASE_URL_2.header,
      LISTING_COLUMNS.PURCHASE_SOURCE_3.header,
      LISTING_COLUMNS.PURCHASE_URL_3.header,
      LISTING_COLUMNS.RESEARCH_STAFF.header,
      LISTING_COLUMNS.LISTING_STAFF.header,
      LISTING_COLUMNS.PICKUP_STAFF.header,
      LISTING_COLUMNS.PURCHASE_SEARCH_STAFF.header,
      LISTING_COLUMNS.PROFIT_CALC_STAFF.header,
      LISTING_COLUMNS.TASK6_STAFF.header,
      LISTING_COLUMNS.WORD_CHECK.header,
      LISTING_COLUMNS.TITLE.header,
      LISTING_COLUMNS.CHAR_COUNT_1.header,
      LISTING_COLUMNS.CONDITION.header,
      LISTING_COLUMNS.CONDITION_DESC_TEMPLATE.header,
      LISTING_COLUMNS.CONDITION_DESC_2.header,
      LISTING_COLUMNS.DESCRIPTION.header,
      LISTING_COLUMNS.ITEM_URL.header,
      LISTING_COLUMNS.SPEC_URL.header,
      LISTING_COLUMNS.CATEGORY_ID.header,
      LISTING_COLUMNS.CATEGORY_NAME.header,
      LISTING_COLUMNS.BRAND.header,
      LISTING_COLUMNS.UPC.header,
      LISTING_COLUMNS.EAN.header,
      LISTING_COLUMNS.MPN.header,
      LISTING_COLUMNS.STORE_IMAGE.header
    ];

    const foundList = [];
    const missingList = [];

    for (let i = 0; i < defined.length; i++) {
      const headerName = defined[i];
      const col = actualMap[headerName];
      if (col) {
        foundList.push('✅ col=' + col + ' 「' + headerName + '」');
      } else {
        missingList.push('❌ MISSING 「' + headerName + '」');
      }
    }

    const lines = [
      '=== 出品シートヘッダー診断 ===',
      'シート: ' + SHEET_NAMES.LISTING + ' / ヘッダー行: 1行目 / 総列数: ' + lastCol,
      '',
      '--- FOUND (' + foundList.length + '件) ---'
    ].concat(foundList).concat([
      '',
      '--- MISSING (' + missingList.length + '件) ---'
    ]).concat(missingList.length > 0 ? missingList : ['(なし)']).concat([
      '',
      missingList.length === 0 ? '✅ 全ヘッダー一致' : '⚠️ 不一致あり: ' + missingList.length + '件'
    ]);

    return lines.join('\n');

  } catch (error) {
    return 'ERROR: ' + error.toString();
  }
}

/**
 * 出品シートのSKUのみ入って他が全空の行を削除する（転記失敗残骸クリーンアップ）
 * clasp run cleanupOrphanedSkuRows で実行
 */
function cleanupOrphanedSkuRows() {
  try {
    const config = getEbayConfig();
    const lss = SpreadsheetApp.openById(config.listingSpreadsheetId);
    const sheet = lss.getSheetByName(SHEET_NAMES.LISTING);
    if (!sheet) return 'ERROR: 出品シートが見つかりません';

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(LISTING_ROWS.HEADER, 1, 1, lastCol).getValues()[0];
    const hmap = {};
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).trim();
      if (h) hmap[h] = i;
    }

    const skuIdx = hmap[LISTING_COLUMNS.SKU.header];
    const titleIdx = hmap[LISTING_COLUMNS.TITLE.header];
    const itemUrlIdx = hmap[LISTING_COLUMNS.ITEM_URL.header];
    if (skuIdx === undefined) return 'ERROR: SKU列が見つかりません';

    const dataStart = LISTING_ROWS.DATA_START;
    const sheetLastRow = sheet.getLastRow();
    if (sheetLastRow < dataStart) return '削除対象なし';

    const allData = sheet.getRange(dataStart, 1, sheetLastRow - dataStart + 1, lastCol).getValues();
    const rowsToDelete = [];

    for (let r = allData.length - 1; r >= 0; r--) {
      const row = allData[r];
      const sku = row[skuIdx];
      const title = titleIdx !== undefined ? row[titleIdx] : '';
      const itemUrl = itemUrlIdx !== undefined ? row[itemUrlIdx] : '';
      // SKUあり かつ タイトル・ItemURLが両方空 → 孤立SKU行
      if (sku && !title && !itemUrl) {
        rowsToDelete.push(r + 4); // 実際の行番号
      }
    }

    if (rowsToDelete.length === 0) return '削除対象の孤立SKU行なし';

    // 後ろから削除（行番号がずれないように）
    rowsToDelete.forEach(function(rowNum) {
      sheet.deleteRow(rowNum);
    });

    return '削除完了: ' + rowsToDelete.length + '行 (行番号: ' + rowsToDelete.join(', ') + ')';

  } catch (e) {
    return 'ERROR: ' + e.toString();
  }
}

/**
 * 転記デバッグ情報を読み取る
 * clasp run readTransferDebug で実行
 */
function readTransferDebug() {
  const val = PropertiesService.getScriptProperties().getProperty('DEBUG_TRANSFER');
  return val ? val : '(デバッグデータなし)';
}

/**
 * 転記直前のtransferDataの中身を確認（実際には書き込まない）
 * clasp run diagnoseTransferDataContent で実行
 */
function diagnoseTransferDataContent() {
  try {
    const lines = ['=== transferData中身診断 ===', ''];

    // 出品シート取得
    const config = getEbayConfig();
    const listingSpreadsheet = SpreadsheetApp.openById(config.listingSpreadsheetId);
    const listingSheet = listingSpreadsheet.getSheetByName(SHEET_NAMES.LISTING);
    if (!listingSheet) return 'ERROR: 出品シートが見つかりません';

    // headerMapping 確認
    const headerMapping = buildHeaderMapping(listingSheet);
    const hmKeys = Object.keys(headerMapping);
    const hmVals = Object.values(headerMapping);
    const maxCol = Math.max.apply(null, hmVals);

    lines.push('[headerMapping]');
    lines.push('  総エントリ数: ' + hmKeys.length);
    lines.push('  maxCol: ' + maxCol);
    lines.push('  リサーチ担当列: ' + (headerMapping[LISTING_COLUMNS.RESEARCH_STAFF.header] || '未定義'));
    lines.push('  タイトル列:     ' + (headerMapping[LISTING_COLUMNS.TITLE.header] || '未定義'));
    lines.push('  ItemURL列:      ' + (headerMapping[LISTING_COLUMNS.ITEM_URL.header] || '未定義'));
    lines.push('  状態列:         ' + (headerMapping[LISTING_COLUMNS.CONDITION.header] || '未定義'));
    lines.push('');

    // リサーチシートからデータ取得
    const researchSheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);
    if (!researchSheet) return 'ERROR: リサーチシートが見つかりません';

    const topInfo = {
      staff: researchSheet.getRange(RESEARCH_TOP_INFO.DATA_ROW, RESEARCH_TOP_INFO.COLUMNS.STAFF.col).getValue()
    };
    const itemUrl = researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.ITEM_URL.col).getValue();

    lines.push('[リサーチシート読取]');
    lines.push('  topInfo.staff: ' + (topInfo.staff || '(空)'));
    lines.push('  itemUrl:       ' + (itemUrl || '(空)'));
    lines.push('');

    // eBay API
    if (!itemUrl) return lines.join('\n') + '\n❌ itemUrlが空なのでAPI呼び出しスキップ';

    lines.push('[eBay API呼び出し中...]');
    let itemInfo = null;
    try {
      itemInfo = getProductInfoFromUrl(itemUrl.toString());
      lines.push('  title: ' + (itemInfo.title ? itemInfo.title.substring(0, 60) : '(空)'));
    } catch (e) {
      return lines.join('\n') + '\n❌ API エラー: ' + e.toString();
    }
    lines.push('');

    // transferData に実際にセットされる値を確認
    const transferData = new Array(maxCol).fill('');

    // リサーチ担当
    const staffCol = headerMapping[LISTING_COLUMNS.RESEARCH_STAFF.header];
    if (staffCol) {
      transferData[staffCol - 1] = topInfo.staff;
    }
    // タイトル
    const titleCol = headerMapping[LISTING_COLUMNS.TITLE.header];
    const title = itemInfo.title || '';
    if (titleCol) {
      transferData[titleCol - 1] = title;
    }

    lines.push('[transferData 書き込み予定値]');
    lines.push('  transferData[' + (staffCol - 1) + '] (リサーチ担当) = "' + transferData[staffCol - 1] + '"');
    lines.push('  transferData[' + (titleCol - 1) + '] (タイトル)     = "' + (transferData[titleCol - 1] ? transferData[titleCol - 1].substring(0, 60) : '(空)') + '"');
    lines.push('  transferData.length = ' + transferData.length);

    return lines.join('\n');

  } catch (e) {
    return 'ERROR: ' + e.toString();
  }
}

/**
 * 出品シートの実データを行ごとに確認
 * clasp run readListingSheetRows で実行
 */
function readListingSheetRows() {
  try {
    const config = getEbayConfig();
    const lss = SpreadsheetApp.openById(config.listingSpreadsheetId);
    const sheet = lss.getSheetByName(SHEET_NAMES.LISTING);
    if (!sheet) return 'ERROR: 出品シートが見つかりません';

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(LISTING_ROWS.HEADER, 1, 1, lastCol).getValues()[0];
    const hmap = {};
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).trim();
      if (h) hmap[h] = i;
    }

    // 確認列
    const checkHeaders = [
      LISTING_COLUMNS.SKU.header,
      LISTING_COLUMNS.RESEARCH_STAFF.header,
      LISTING_COLUMNS.TITLE.header,
      LISTING_COLUMNS.CONDITION.header,
      LISTING_COLUMNS.ITEM_URL.header,
      LISTING_COLUMNS.CATEGORY_ID.header,
      LISTING_COLUMNS.SHIPPING_CARRIER.header,
      LISTING_COLUMNS.SELLING_PRICE.header
    ];

    // データ開始行から最終行まで読む
    const dataStart3 = LISTING_ROWS.DATA_START;
    const sheetLastRow = sheet.getLastRow();
    const dataRows = sheetLastRow >= dataStart3
      ? sheet.getRange(dataStart3, 1, sheetLastRow - dataStart3 + 1, lastCol).getValues()
      : [];

    const lines = [
      '=== 出品シート行データ確認 ===',
      '総列数: ' + lastCol + ' / データ行数: ' + dataRows.length,
      ''
    ];

    let writtenCount = 0;
    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      const skuIdx = hmap[LISTING_COLUMNS.SKU.header];
      const sku = skuIdx !== undefined ? row[skuIdx] : '';
      if (!sku) continue; // SKUが空の行はスキップ

      writtenCount++;
      lines.push('--- 行' + (r + 4) + ' ---');
      checkHeaders.forEach(function(h) {
        const idx = hmap[h];
        const val = idx !== undefined ? row[idx] : '(列なし)';
        const display = (val === '' || val === null || val === undefined) ? '(空)' : String(val).substring(0, 80);
        lines.push('  ' + h + ': ' + display);
      });
    }

    if (writtenCount === 0) lines.push('SKUデータのある行が見つかりません');
    return lines.join('\n');

  } catch (e) {
    return 'ERROR: ' + e.toString();
  }
}

/**
 * 転記処理のドライラン診断（実際には書き込まない）
 * リサーチシートのデータ読み取り・eBay API呼び出しまでを実行し、
 * 何のデータがどの列に書き込まれるかをレポートする
 * clasp run diagnoseTransferDryRun で実行
 */
function diagnoseTransferDryRun() {
  try {
    const lines = ['=== 転記ドライラン診断 ===', ''];

    // ステップ1: リサーチシートのデータ確認
    const researchSheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);
    if (!researchSheet) return 'ERROR: リサーチシートが見つかりません';

    const staffName = researchSheet.getRange(RESEARCH_TOP_INFO.DATA_ROW, RESEARCH_TOP_INFO.COLUMNS.STAFF.col).getValue();
    const itemUrl   = researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.ITEM_URL.col).getValue();
    const specUrl   = researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.SPEC_URL.col).getValue();
    const condition = researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.CONDITION.col).getValue();

    lines.push('[リサーチシート読取]');
    lines.push('  担当者 (B2): ' + (staffName || '(空)'));
    lines.push('  Item URL:    ' + (itemUrl   || '(空)'));
    lines.push('  スペックURL: ' + (specUrl   || '(空)'));
    lines.push('  状態:        ' + (condition || '(空)'));
    lines.push('');

    if (!staffName) return lines.join('\n') + '\n❌ 中止: 担当者が空です';
    if (!itemUrl)   return lines.join('\n') + '\n❌ 中止: Item URLが空です';

    const effectiveSpecUrl = specUrl || itemUrl;

    // ステップ2: eBay API呼び出し
    lines.push('[eBay API呼び出し]');
    let itemInfo = null, specInfo = null;
    try {
      itemInfo = getProductInfoFromUrl(itemUrl.toString());
      lines.push('  itemInfo.title:    ' + (itemInfo && itemInfo.title ? itemInfo.title.substring(0, 80) : '(なし)'));
      lines.push('  itemInfo.category: ' + (itemInfo && itemInfo.category ? JSON.stringify(itemInfo.category) : '(なし)'));
    } catch (e) {
      lines.push('  ❌ itemInfo取得エラー: ' + e.toString());
      return lines.join('\n');
    }
    try {
      specInfo = getProductInfoFromUrl(effectiveSpecUrl.toString());
      lines.push('  specInfo.category: ' + (specInfo && specInfo.category ? JSON.stringify(specInfo.category) : '(なし)'));
      lines.push('  specInfo.brand:    ' + (specInfo && specInfo.brand ? specInfo.brand : '(なし)'));
    } catch (e) {
      lines.push('  ❌ specInfo取得エラー: ' + e.toString());
      return lines.join('\n');
    }
    lines.push('');

    // ステップ3: カテゴリID整合性チェック
    lines.push('[カテゴリID整合性チェック]');
    if (itemInfo && itemInfo.category && specInfo && specInfo.category) {
      const ic = itemInfo.category.categoryId;
      const sc = specInfo.category.categoryId;
      if (ic && sc && ic !== sc) {
        lines.push('  ❌ カテゴリID不一致: Item=' + ic + ' / Spec=' + sc);
        lines.push('  → この不一致が転記エラーの原因です');
      } else {
        lines.push('  ✅ カテゴリID一致: ' + ic);
      }
    } else {
      lines.push('  ⚠️ カテゴリ情報が不完全なためスキップ');
    }
    lines.push('');

    // ステップ4: タイトル・ワード判定
    const title = (itemInfo && itemInfo.title) ? itemInfo.title : '';
    lines.push('[タイトル・ワード判定]');
    lines.push('  タイトル: ' + (title || '(空)'));
    lines.push('  文字数:   ' + title.length);

    const config = getEbayConfig();
    const listingSpreadsheet = SpreadsheetApp.openById(config.listingSpreadsheetId);
    const wordResult = title ? checkVeroAndProhibitedWords(title, listingSpreadsheet) : '(タイトルなし)';
    lines.push('  ワード判定: ' + wordResult);
    lines.push('');

    // ステップ5: ストア画像
    lines.push('[ストア画像]');
    lines.push('  storeImageUrl: ' + (config.storeImageUrl || '(未設定)'));
    lines.push('');

    // ステップ6: 書き込み予定サマリー
    lines.push('[書き込み予定サマリー]');
    lines.push('  リサーチ担当: ' + (staffName || '(空)'));
    lines.push('  タイトル:     ' + (title.substring(0, 60) || '(空)'));
    lines.push('  状態:         ' + (condition || '(空)'));
    lines.push('  カテゴリID:   ' + (specInfo && specInfo.category ? specInfo.category.categoryId : '(空)'));
    lines.push('  Brand:        ' + (specInfo && specInfo.brand ? specInfo.brand : '(空)'));

    return lines.join('\n');

  } catch (error) {
    return 'ERROR: ' + error.toString();
  }
}
