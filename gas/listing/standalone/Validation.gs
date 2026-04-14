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
