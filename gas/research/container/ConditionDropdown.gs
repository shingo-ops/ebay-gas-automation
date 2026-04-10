/**
 * ConditionDropdown.gs
 *
 * リサーチシートの「状態」セル（E8）に、カテゴリIDに対応する
 * eBayコンディションのプルダウンを生成します。
 *
 * データソース: カテゴリマスタスプレッドシート（ツール設定の「カテゴリマスタ」）
 *   - category_master_EBAY_US シート: conditions_json でカテゴリ別コンディションIDを取得
 *   - condition_ja_map シート: ja_display で日本語表示名を取得
 *
 * トリガー経路:
 *   1. G8（カテゴリID）を手動編集 → handleEdit → setConditionDropdown
 *   2. B8（Item URL）入力 → fetchCategoryFromUrl がG8を自動セット → setConditionDropdown
 */

/**
 * カテゴリマスタスプレッドシートを開く
 * ツール設定の「カテゴリマスタ」に設定されたIDを使用
 *
 * @returns {Spreadsheet|null}
 */
function openCategoryMasterSs() {
  const config = getEbayConfig();
  const spreadsheetId = config.categoryMasterSpreadsheetId;

  if (!spreadsheetId) {
    Logger.log('⚠️ カテゴリマスタのスプレッドシートIDが設定されていません（ツール設定の「カテゴリマスタ」を確認）');
    return null;
  }

  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    Logger.log('❌ カテゴリマスタスプレッドシートを開けません: ' + e.toString());
    return null;
  }
}

/**
 * category_master_EBAY_US シートから指定カテゴリの conditions_json を取得
 *
 * @param {string} categoryId eBayカテゴリID
 * @returns {Array<{id: string, name: string, enum: string, category_display: string}>}
 *          コンディション情報の配列（見つからない場合は空配列）
 */
function getConditionItemsByCategoryId(categoryId) {
  if (!categoryId) return [];

  const categoryMasterSs = openCategoryMasterSs();
  if (!categoryMasterSs) return [];

  try {
    const sheet = categoryMasterSs.getSheetByName(SHEET_NAMES.CATEGORY_MASTER);
    if (!sheet) {
      Logger.log('⚠️ ' + SHEET_NAMES.CATEGORY_MASTER + ' シートが見つかりません');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // ヘッダー行からカラムインデックスを動的に取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const categoryIdIdx    = headers.indexOf('category_id');
    const conditionsJsonIdx = headers.indexOf('conditions_json');

    if (categoryIdIdx === -1 || conditionsJsonIdx === -1) {
      Logger.log('⚠️ 必要な列が見つかりません（category_id, conditions_json）');
      return [];
    }

    // 全行を一括取得してカテゴリIDで検索
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][categoryIdIdx]) === String(categoryId)) {
        const conditionsJson = data[i][conditionsJsonIdx];
        if (!conditionsJson) return [];
        try {
          const parsed = JSON.parse(conditionsJson);
          // [{id, name, enum, category_display}] 形式を想定
          return parsed.map(function(item) {
            if (typeof item === 'object' && item !== null) {
              return {
                id:               String(item.id || ''),
                name:             String(item.name || ''),
                enum:             String(item.enum || ''),
                category_display: String(item.category_display || item.name || '')
              };
            }
            return { id: String(item), name: String(item), enum: '', category_display: String(item) };
          });
        } catch (e) {
          Logger.log('❌ conditions_json パースエラー: ' + e.toString());
          return [];
        }
      }
    }

    Logger.log('カテゴリID ' + categoryId + ' が ' + SHEET_NAMES.CATEGORY_MASTER + ' に見つかりません');
    return [];

  } catch (error) {
    Logger.log('❌ getConditionItemsByCategoryId エラー: ' + error.toString());
    return [];
  }
}

/**
 * condition_ja_map シートを参照して、条件IDリストを日本語表示名にマッピング
 * condition_ja_map に登録されていない ID は category_display をそのまま使用
 *
 * @param {Spreadsheet} categoryMasterSs
 * @param {Array<{id: string, category_display: string}>} conditionItems
 * @returns {Array<string>} プルダウン表示名の配列（ja_display または category_display）
 */
function buildConditionDisplayOptions(categoryMasterSs, conditionItems) {
  if (!conditionItems || conditionItems.length === 0) return [];

  // condition_ja_map から id → ja_display の逆引きマップを構築
  const jaMap = {};
  try {
    const sheet = categoryMasterSs.getSheetByName(SHEET_NAMES.CONDITION_JA_MAP);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx        = headers.indexOf('condition_id');
      const jaDisplayIdx = headers.indexOf('ja_display');

      if (idIdx !== -1 && jaDisplayIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          const id = String(data[i][idIdx]);
          const ja = data[i][jaDisplayIdx];
          if (id && ja) jaMap[id] = String(ja);
        }
        Logger.log('condition_ja_map 読み込み完了: ' + Object.keys(jaMap).length + '件');
      }
    } else {
      Logger.log('⚠️ ' + SHEET_NAMES.CONDITION_JA_MAP + ' シートが見つかりません。英語名で表示します');
    }
  } catch (e) {
    Logger.log('⚠️ condition_ja_map 読み込みエラー: ' + e.toString());
  }

  return conditionItems.map(function(item) {
    return jaMap[item.id] || item.category_display || item.name || item.id;
  });
}

/**
 * リサーチシートのE8（状態）セルに、カテゴリIDに対応する状態プルダウンを設定
 * カテゴリIDが空の場合はプルダウンをクリアします
 *
 * @param {string} categoryId カテゴリID（G8の値）
 * @param {Sheet} sheet リサーチシート
 */
function setConditionDropdown(categoryId, sheet) {
  const conditionCell = sheet.getRange(
    RESEARCH_ITEM_LIST.DATA_ROW,
    RESEARCH_ITEM_LIST.COLUMNS.CONDITION.col
  );

  // カテゴリIDが空 → プルダウンをクリア
  if (!categoryId || String(categoryId).trim() === '') {
    conditionCell.clearDataValidations();
    Logger.log('カテゴリIDが空のため状態プルダウンをクリアしました');
    return;
  }

  const categoryMasterSs = openCategoryMasterSs();
  if (!categoryMasterSs) {
    // カテゴリマスタ未設定でもエラーにしない
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'カテゴリマスタが未設定のため状態プルダウンを生成できません。\nツール設定の「カテゴリマスタ」を確認してください。',
      '⚠️ 状態プルダウン',
      8
    );
    return;
  }

  const conditionItems = getConditionItemsByCategoryId(categoryId);

  if (conditionItems.length === 0) {
    Logger.log('カテゴリID ' + categoryId + ' のコンディション情報が取得できませんでした');
    conditionCell.clearDataValidations();
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'カテゴリID ' + categoryId + ' の状態情報が見つかりませんでした',
      '⚠️ 状態プルダウン',
      5
    );
    return;
  }

  const displayOptions = buildConditionDisplayOptions(categoryMasterSs, conditionItems);

  if (displayOptions.length === 0) {
    conditionCell.clearDataValidations();
    return;
  }

  // データ入力規則（プルダウン）を設定
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(displayOptions, true)
    .setAllowInvalid(false)
    .build();
  conditionCell.setDataValidation(rule);

  // 既存の値がリストにない場合はクリア
  const currentValue = conditionCell.getValue();
  if (currentValue && displayOptions.indexOf(String(currentValue)) === -1) {
    conditionCell.clearContent();
    Logger.log('既存の状態値がリストにないためクリアしました: ' + currentValue);
  }

  Logger.log('✅ 状態プルダウン設定完了: カテゴリID=' + categoryId + ' / ' + displayOptions.length + '件');
  SpreadsheetApp.getActiveSpreadsheet().toast(
    '状態プルダウンを設定しました（' + displayOptions.length + '件）',
    '✅ 状態',
    2
  );
}
