/**
 * 出品前バリデーション（文字数制限チェック）
 */

/**
 * 出品前の文字数制限チェック
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {number} row
 * @returns {Object} { valid: true/false, errors: ['エラーメッセージ1', ...] }
 */
function validateCharacterLimits(spreadsheetId, sheetName, row) {
  const ss = getTargetSpreadsheet(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { valid: false, errors: ['シートが見つかりません'] };

  const headerMapping = buildListingHeaderMapping(spreadsheetId, sheetName);
  const errors = [];

  // 1. タイトル: 80文字制限
  const titleCol = headerMapping['タイトル'];
  if (titleCol) {
    const title = String(sheet.getRange(row, titleCol).getValue() || '');
    if (title.length > 80) {
      errors.push('タイトルが80文字を超えています（現在: ' + title.length + '文字）');
    }
  }

  // 2. 状態説明: 1000文字制限
  const condDescCol = headerMapping['状態説明'];
  if (condDescCol) {
    const condDesc = String(sheet.getRange(row, condDescCol).getValue() || '');
    if (condDesc.length > 1000) {
      errors.push('状態説明が1000文字を超えています（現在: ' + condDesc.length + '文字）');
    }
  }

  // 3. Description: 500,000文字制限
  const descCol = headerMapping['Description'];
  if (descCol) {
    const desc = String(sheet.getRange(row, descCol).getValue() || '');
    if (desc.length > 500000) {
      errors.push('Descriptionが500,000文字を超えています（現在: ' + desc.length + '文字）');
    }
  }

  // 4. Item Specifics: 各値65文字制限
  for (var i = 1; i <= 30; i++) {
    var nameCol = headerMapping['項目名（' + i + '）'];
    var valueCol = headerMapping['内容（' + i + '）'];
    if (nameCol && valueCol) {
      var specName = String(sheet.getRange(row, nameCol).getValue() || '').trim();
      var specValue = String(sheet.getRange(row, valueCol).getValue() || '').trim();
      if (specValue.length > 65) {
        errors.push('Item Specifics「' + (specName || '項目' + i) + '」が65文字を超えています（現在: ' + specValue.length + '文字）');
      }
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

/**
 * セル編集時のリアルタイム文字数チェック
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {number} row
 * @param {number} col
 * @param {string} value
 * @returns {Object|null} { warning: '...', over: boolean } or null（対象外の列）
 */
function checkCharacterLimitOnEdit(spreadsheetId, sheetName, row, col, value) {
  const headerMapping = buildListingHeaderMapping(spreadsheetId, sheetName);
  const len = value.length;

  // タイトル列: 80文字制限
  if (col === headerMapping['タイトル']) {
    if (len > 80) {
      return { warning: 'タイトルが80文字を超えています（現在: ' + len + '文字）', over: true };
    }
    return { warning: null, over: false };
  }

  // 状態説明列: 1000文字制限
  if (col === headerMapping['状態説明']) {
    if (len > 1000) {
      return { warning: '状態説明が1000文字を超えています（現在: ' + len + '文字）。出品時にブロックされます。', over: true };
    }
    return { warning: null, over: false };
  }

  // Item Specifics 内容列: 65文字制限
  for (var i = 1; i <= 30; i++) {
    var contentCol = headerMapping['内容（' + i + '）'];
    if (contentCol && col === contentCol) {
      if (len > 65) {
        var specNameCol = headerMapping['項目名（' + i + '）'];
        var specName = '';
        if (specNameCol) {
          var ss = getTargetSpreadsheet(spreadsheetId);
          var sheet = ss.getSheetByName(sheetName);
          specName = String(sheet.getRange(row, specNameCol).getValue() || '項目' + i);
        }
        return { warning: '「' + specName + '」が65文字を超えています（現在: ' + len + '文字）', over: true };
      }
      return { warning: null, over: false };
    }
  }

  return null; // 対象外の列
}

/**
 * eBay APIのエラーレスポンスを日本語のユーザー向けメッセージに変換
 * @param {string} apiErrorMessage eBay APIのエラーメッセージ（英語）
 * @param {Object} headerMapping ヘッダーマッピング（列番号特定用）
 * @returns {Object} { userMessage: '日本語メッセージ', fixable: true/false }
 */
function translateEbayError(apiErrorMessage, headerMapping) {
  var errors = [];
  var msg = String(apiErrorMessage || '');

  // createListingのプレフィックスを除去してeBayエラー本文だけを抽出
  msg = msg.replace(/❌.*?\n\n/g, '').trim();

  var patterns = [
    {
      pattern: /item specific ([\w\s/]+) is missing/i,
      handler: function(match) {
        var specName = match[1].trim();
        var colInfo = _findColumnForSpec(specName, headerMapping);
        return '「' + specName + '」が未入力です' + colInfo;
      }
    },
    {
      pattern: /ConditionDescription.*maximum.*?(\d+)/i,
      handler: function(match) {
        var limit = match[1];
        var colInfo = headerMapping['状態説明'] ? ' → ' + _colNumToLetter(headerMapping['状態説明']) + '列' : '';
        return '状態説明が' + limit + '文字を超えています' + colInfo + '。文字数を減らしてください';
      }
    },
    {
      pattern: /title.*exceed.*?(\d+)/i,
      handler: function() {
        var colInfo = headerMapping['タイトル'] ? ' → ' + _colNumToLetter(headerMapping['タイトル']) + '列' : '';
        return 'タイトルが80文字を超えています' + colInfo;
      }
    },
    {
      pattern: /image.*format.*not supported/i,
      handler: function() {
        return '画像のフォーマットが対応していません。JPG/PNGを使用してください';
      }
    },
    {
      pattern: /category.*changed/i,
      handler: function() {
        var colInfo = headerMapping['カテゴリID'] ? ' → ' + _colNumToLetter(headerMapping['カテゴリID']) + '列' : '';
        return 'カテゴリIDが正しくない可能性があります' + colInfo + '。確認してください';
      }
    },
    {
      pattern: /UPC.*not valid|invalid.*UPC/i,
      handler: function() {
        var colInfo = headerMapping['UPC'] ? ' → ' + _colNumToLetter(headerMapping['UPC']) + '列' : '';
        return 'UPCの値が無効です' + colInfo + '。正しい値を入力するか「Does not apply」を入力してください';
      }
    },
    {
      pattern: /EAN.*not valid|invalid.*EAN/i,
      handler: function() {
        var colInfo = headerMapping['EAN'] ? ' → ' + _colNumToLetter(headerMapping['EAN']) + '列' : '';
        return 'EANの値が無効です' + colInfo + '。正しい値を入力するか「Does not apply」を入力してください';
      }
    },
    {
      pattern: /shipping.*policy.*not found|invalid.*shipping/i,
      handler: function() {
        var colInfo = headerMapping['Shipping Policy'] ? ' → ' + _colNumToLetter(headerMapping['Shipping Policy']) + '列' : '';
        return 'Shipping Policyが見つかりません' + colInfo + '。正しいポリシー名を選択してください';
      }
    },
    {
      pattern: /return.*policy.*not found|invalid.*return/i,
      handler: function() {
        var colInfo = headerMapping['Return Policy'] ? ' → ' + _colNumToLetter(headerMapping['Return Policy']) + '列' : '';
        return 'Return Policyが見つかりません' + colInfo;
      }
    },
    {
      pattern: /payment.*policy.*not found|invalid.*payment/i,
      handler: function() {
        var colInfo = headerMapping['Payment Policy'] ? ' → ' + _colNumToLetter(headerMapping['Payment Policy']) + '列' : '';
        return 'Payment Policyが見つかりません' + colInfo;
      }
    },
    {
      pattern: /quantity.*must be|invalid.*quantity/i,
      handler: function() {
        var colInfo = headerMapping['個数'] ? ' → ' + _colNumToLetter(headerMapping['個数']) + '列' : '';
        return '個数の値が不正です' + colInfo + '。1以上の数値を入力してください';
      }
    },
    {
      pattern: /price.*invalid|invalid.*price|start price/i,
      handler: function() {
        var colInfo = headerMapping['売値($)'] ? ' → ' + _colNumToLetter(headerMapping['売値($)']) + '列' : '';
        return '売値が不正です' + colInfo + '。正しい金額を入力してください';
      }
    },
    // 層3: EPS/Self Hosted 混在エラー対訳
    {
      pattern: /mixture.*Self Hosted.*EPS|Self Hosted.*EPS.*not allowed|mixture.*EPS.*Self Hosted/i,
      handler: function() {
        return 'EPS画像 (eBayホスト) とSelf Hosted画像 (外部URL) が混在しています。\n' +
               'ストア画像列を空にするか、すべての画像列を同じ形式に統一してから再実行してください。\n' +
               '(ストア画像列に i.ebayimg.com のURLが残っているケースが多いです)';
      }
    },
    // 層3: 内部バリデーション (層2) が検出した混在エラー
    {
      pattern: /PICTURE_URL_MIXED_FORMAT/,
      handler: function() {
        return '内部バリデーションでEPS/Self Hosted混在を検出しました。\n' +
               'ストア画像列のURLを確認し、i.ebayimg.com のURLが含まれていれば削除してください。';
      }
    }
  ];

  var matched = false;
  for (var i = 0; i < patterns.length; i++) {
    var match = msg.match(patterns[i].pattern);
    if (match) {
      errors.push('・' + patterns[i].handler(match));
      matched = true;
    }
  }

  if (!matched) {
    errors.push('・eBayエラー: ' + msg.substring(0, 200));
  }

  return {
    userMessage: '❌ 出品できませんでした\n\n以下を修正して再度出品してください：\n' + errors.join('\n'),
    fixable: true
  };
}

/**
 * Item Specifics名から対応する列情報を返す
 */
function _findColumnForSpec(specName, headerMapping) {
  var directCols = { 'Brand': 'Brand', 'UPC': 'UPC', 'EAN': 'EAN', 'MPN': 'MPN(型番可)' };
  if (directCols[specName] && headerMapping[directCols[specName]]) {
    return ' → ' + _colNumToLetter(headerMapping[directCols[specName]]) + '列（' + directCols[specName] + '）に入力してください';
  }
  return ' → 項目名/内容列に「' + specName + '」を追加してください';
}

/**
 * 列番号をアルファベットに変換（1=A, 26=Z, 27=AA...）
 */
function _colNumToLetter(colNum) {
  var letter = '';
  while (colNum > 0) {
    var mod = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return letter;
}
