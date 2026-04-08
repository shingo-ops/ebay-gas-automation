/**
 * ConditionDropdown.gs
 *
 * eBay Condition のドロップダウン管理機能
 * category_master と condition_group_map シートを参照して、
 * C列（カテゴリID）の変更に応じてD列（Condition）のドロップダウンを動的に更新します。
 */

/**
 * グループIDに基づいて利用可能な Condition を取得
 *
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト
 * @param {string} groupId - group_id (例: "group_001")
 * @returns {Array<Object>} Condition オブジェクトの配列 [{id: "1000", name: "New"}, ...]
 */
function getConditionsByGroupId(ss, groupId) {
  if (!ss || !groupId) {
    Logger.log('getConditionsByGroupId: 無効な引数');
    return [];
  }

  try {
    const conditionGroupSheet = ss.getSheetByName('condition_group_map');
    if (!conditionGroupSheet) {
      Logger.log('condition_group_map シートが見つかりません');
      return [];
    }

    const data = conditionGroupSheet.getDataRange().getValues();
    const headers = data[0];
    const groupIdIndex = headers.indexOf('group_id');
    const conditionsJsonIndex = headers.indexOf('conditions_json');

    if (groupIdIndex === -1 || conditionsJsonIndex === -1) {
      Logger.log('必要な列が見つかりません: group_id または conditions_json');
      return [];
    }

    // グループIDに一致する行を検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][groupIdIndex] === groupId) {
        const conditionsJson = data[i][conditionsJsonIndex];
        if (conditionsJson) {
          try {
            return JSON.parse(conditionsJson);
          } catch (e) {
            Logger.log('JSON パースエラー: ' + e.toString());
            return [];
          }
        }
      }
    }

    Logger.log('グループIDが見つかりません: ' + groupId);
    return [];
  } catch (error) {
    Logger.log('getConditionsByGroupId エラー: ' + error.toString());
    return [];
  }
}

/**
 * カテゴリIDに基づいて利用可能な Condition を取得
 *
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト
 * @param {string} categoryId - eBay カテゴリID (例: "261581")
 * @returns {Array<Object>} Condition オブジェクトの配列 [{id: "1000", name: "New"}, ...]
 */
function getConditionsByCategoryId(ss, categoryId) {
  if (!ss || !categoryId) {
    Logger.log('getConditionsByCategoryId: 無効な引数');
    return [];
  }

  try {
    const categoryMasterSheet = ss.getSheetByName('category_master');
    if (!categoryMasterSheet) {
      Logger.log('category_master シートが見つかりません');
      return [];
    }

    const data = categoryMasterSheet.getDataRange().getValues();
    const headers = data[0];
    const categoryIdIndex = headers.indexOf('category_id');
    const groupIdIndex = headers.indexOf('group_id');

    if (categoryIdIndex === -1 || groupIdIndex === -1) {
      Logger.log('必要な列が見つかりません: category_id または group_id');
      return [];
    }

    // カテゴリIDに一致する行を検索
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][categoryIdIndex]) === String(categoryId)) {
        const groupId = data[i][groupIdIndex];
        if (groupId) {
          return getConditionsByGroupId(ss, groupId);
        }
      }
    }

    Logger.log('カテゴリIDが見つかりません: ' + categoryId);
    return [];
  } catch (error) {
    Logger.log('getConditionsByCategoryId エラー: ' + error.toString());
    return [];
  }
}

/**
 * C列（カテゴリID）変更時に呼び出される onEdit ハンドラ
 * D列（Condition）のドロップダウンを自動更新します
 *
 * @param {Event} e - onEdit イベントオブジェクト
 */
function processOnEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const row = range.getRow();
    const col = range.getColumn();

    // C列（カテゴリID）の変更を検出
    // ここでは C列 = 3 と仮定（必要に応じて調整）
    const CATEGORY_COLUMN = 3;
    const CONDITION_COLUMN = 4;

    if (col !== CATEGORY_COLUMN) {
      return; // C列以外の変更は無視
    }

    if (row === 1) {
      return; // ヘッダー行は無視
    }

    const categoryId = range.getValue();
    if (!categoryId) {
      // カテゴリIDが空の場合、D列のドロップダウンをクリア
      const conditionCell = sheet.getRange(row, CONDITION_COLUMN);
      conditionCell.clearDataValidations();
      conditionCell.clearContent();
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const conditions = getConditionsByCategoryId(ss, String(categoryId));

    if (conditions.length === 0) {
      Logger.log('カテゴリID ' + categoryId + ' に対応する Condition が見つかりません');
      return;
    }

    // condition_master シートから日本語表示名を取得
    const conditionMasterSheet = ss.getSheetByName('condition_master');
    const displayNames = [];

    if (conditionMasterSheet) {
      const masterData = conditionMasterSheet.getDataRange().getValues();
      const masterHeaders = masterData[0];
      const conditionIdIdx = masterHeaders.indexOf('condition_id');
      const jaDisplayNameIdx = masterHeaders.indexOf('ja_display_name');

      if (conditionIdIdx !== -1 && jaDisplayNameIdx !== -1) {
        for (const cond of conditions) {
          const condId = String(cond.id);
          let displayName = cond.name; // デフォルトは英語名

          // condition_master から対応する日本語名を検索
          for (let i = 1; i < masterData.length; i++) {
            if (String(masterData[i][conditionIdIdx]) === condId) {
              const jaName = masterData[i][jaDisplayNameIdx];
              if (jaName) {
                displayName = jaName + ' (' + cond.id + ')';
              }
              break;
            }
          }
          displayNames.push(displayName);
        }
      } else {
        // condition_master に必要な列がない場合は英語名を使用
        for (const cond of conditions) {
          displayNames.push(cond.name + ' (' + cond.id + ')');
        }
      }
    } else {
      // condition_master シートがない場合は英語名を使用
      for (const cond of conditions) {
        displayNames.push(cond.name + ' (' + cond.id + ')');
      }
    }

    // D列にドロップダウンを設定
    const conditionCell = sheet.getRange(row, CONDITION_COLUMN);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(displayNames, true)
      .setAllowInvalid(false)
      .build();

    conditionCell.setDataValidation(rule);

    // 既存値が新しいリストに含まれていない場合はクリア
    const currentValue = conditionCell.getValue();
    if (currentValue && !displayNames.includes(currentValue)) {
      conditionCell.clearContent();
    }

    Logger.log('カテゴリID ' + categoryId + ' の Condition ドロップダウンを更新しました（' + displayNames.length + '件）');
  } catch (error) {
    Logger.log('processOnEdit エラー: ' + error.toString());
  }
}

/**
 * グローバル onEdit トリガーとして登録する関数
 * この関数をスクリプトエディタのトリガーに登録してください
 *
 * @param {Event} e - onEdit イベントオブジェクト
 */
function onEdit(e) {
  processOnEdit(e);
}

/**
 * テスト用: グループIDから Condition を取得
 */
function testGetConditionsByGroupId() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const conditions = getConditionsByGroupId(ss, 'group_001');
  Logger.log('group_001 の Conditions: ' + JSON.stringify(conditions));
}

/**
 * テスト用: カテゴリIDから Condition を取得
 */
function testGetConditionsByCategoryId() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const conditions = getConditionsByCategoryId(ss, '261581');
  Logger.log('カテゴリID 261581 の Conditions: ' + JSON.stringify(conditions));
}
