/**
 * SetupConditionMaster.gs
 *
 * condition_master シートを作成し、eBay Condition ID のマスターデータを設定します。
 * このスクリプトは1回実行するだけで完了します。
 */

/**
 * condition_master シートを作成し、マスターデータを投入
 * 実行方法: Google Apps Script エディタでこの関数を選択して実行
 */
function createConditionMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 既存のシートを確認
  let sheet = ss.getSheetByName('condition_master');

  if (sheet) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'condition_master シートが既に存在します',
      '既存のシートを削除して再作成しますか？',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      ss.deleteSheet(sheet);
      Logger.log('既存の condition_master シートを削除しました');
    } else {
      Logger.log('処理をキャンセルしました');
      return;
    }
  }

  // 新しいシートを作成
  sheet = ss.insertSheet('condition_master');
  Logger.log('condition_master シートを作成しました');

  // ヘッダー行を設定
  const headers = [
    'condition_id',
    'condition_name',
    'condition_enum',
    'group',
    'requires_approval',
    'ja_display_name',
    'ja_check_1',
    'ja_check_2',
    'notes'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダー行のスタイリング
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Condition マスターデータ（16行）
  const conditionData = [
    ['1000', 'New', 'NEW', 'New', 'FALSE', '新品・未使用', '未開封', 'タグ付き', '完全な新品状態'],
    ['1500', 'New other (see details)', 'NEW_OTHER', 'New', 'FALSE', '未使用品（開封済み）', '開封済み', '未使用', '箱開封済みだが未使用'],
    ['1750', 'New with defects', 'NEW_WITH_DEFECTS', 'New', 'FALSE', '新品・訳あり', '訳あり', '小傷あり', '新品だが軽微な欠陥あり'],
    ['2000', 'Manufacturer refurbished', 'MANUFACTURER_REFURBISHED', 'Refurbished', 'TRUE', '認定整備済品（メーカー認定）', 'メーカー保証', '整備済み', 'メーカー認定の整備済品'],
    ['2010', 'Excellent - Refurbished', 'EXCELLENT_REFURBISHED', 'Refurbished', 'FALSE', '整備済品・使用痕なし', '使用痕なし', '整備済み', '優れた状態の整備済品'],
    ['2020', 'Very Good - Refurbished', 'VERY_GOOD_REFURBISHED', 'Refurbished', 'FALSE', '整備済品・使用痕わずか', '使用痕わずか', '整備済み', '良好な状態の整備済品'],
    ['2030', 'Good - Refurbished', 'GOOD_REFURBISHED', 'Refurbished', 'FALSE', '整備済品・使用痕あり', '使用痕あり', '整備済み', '標準的な整備済品'],
    ['2500', 'Seller refurbished', 'SELLER_REFURBISHED', 'Refurbished', 'FALSE', 'セラー整備済品', 'セラー整備', '動作確認済み', '出品者による整備済品'],
    ['2750', 'Like New', 'LIKE_NEW', 'Used', 'FALSE', '未使用に近い', 'ほぼ新品', '使用感なし', '使用感がほぼない中古品'],
    ['2990', 'Pre-owned - Excellent', 'PRE_OWNED_EXCELLENT', 'Used', 'FALSE', '目立った傷や汚れなし（アパレル）', '状態良好', '傷なし', 'アパレル専用：優良品'],
    ['3000', 'Used', 'USED', 'Used', 'FALSE', '目立った傷や汚れなし', '使用済み', '通常使用', '一般的な中古品'],
    ['3010', 'Pre-owned - Fair', 'PRE_OWNED_FAIR', 'Used', 'FALSE', 'やや傷や汚れあり（アパレル）', '傷あり', '使用感あり', 'アパレル専用：並品'],
    ['4000', 'Very Good', 'VERY_GOOD', 'Used', 'FALSE', 'やや傷や汚れあり（機能問題なし）', '軽い傷', '機能正常', '軽微な傷はあるが機能は正常'],
    ['5000', 'Good', 'GOOD', 'Used', 'FALSE', '傷や汚れあり', '傷汚れあり', '機能正常', '目立つ傷や汚れがある'],
    ['6000', 'Acceptable', 'ACCEPTABLE', 'Used', 'FALSE', '全体的に状態が悪い', '状態悪い', '機能する', '状態は悪いが使用可能'],
    ['7000', 'For parts or not working', 'FOR_PARTS', 'Not Working', 'FALSE', 'ジャンク品（部品取り）', 'ジャンク', '動作不良', '部品取りまたは動作しない']
  ];

  // データを挿入
  const dataRange = sheet.getRange(2, 1, conditionData.length, conditionData[0].length);
  dataRange.setValues(conditionData);

  // 列幅を調整
  sheet.setColumnWidth(1, 120);  // condition_id
  sheet.setColumnWidth(2, 250);  // condition_name
  sheet.setColumnWidth(3, 180);  // condition_enum
  sheet.setColumnWidth(4, 100);  // group
  sheet.setColumnWidth(5, 140);  // requires_approval
  sheet.setColumnWidth(6, 280);  // ja_display_name
  sheet.setColumnWidth(7, 120);  // ja_check_1
  sheet.setColumnWidth(8, 120);  // ja_check_2
  sheet.setColumnWidth(9, 300);  // notes

  // データ行のスタイリング
  dataRange.setHorizontalAlignment('left');
  dataRange.setVerticalAlignment('middle');

  // condition_id 列を数値フォーマットに
  sheet.getRange(2, 1, conditionData.length, 1).setNumberFormat('0');

  // 行を固定（ヘッダー行）
  sheet.setFrozenRows(1);

  // グリッド線を強調
  sheet.getRange(1, 1, conditionData.length + 1, headers.length).setBorder(
    true, true, true, true, true, true,
    '#cccccc', SpreadsheetApp.BorderStyle.SOLID
  );

  Logger.log('condition_master シートの作成が完了しました');
  Logger.log('データ行数: ' + conditionData.length);

  SpreadsheetApp.getUi().alert(
    'condition_master シート作成完了',
    conditionData.length + '行のConditionデータを挿入しました。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * condition_master シートからCondition情報を取得
 *
 * @param {string} conditionId - Condition ID (例: "1000")
 * @returns {Object|null} Condition情報オブジェクト、または null
 */
function getConditionInfo(conditionId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('condition_master');

  if (!sheet) {
    Logger.log('condition_master シートが見つかりません');
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // ヘッダーからインデックスを取得
  const indices = {};
  headers.forEach((header, index) => {
    indices[header] = index;
  });

  // conditionId に一致する行を検索
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][indices['condition_id']]) === String(conditionId)) {
      return {
        condition_id: data[i][indices['condition_id']],
        condition_name: data[i][indices['condition_name']],
        condition_enum: data[i][indices['condition_enum']],
        group: data[i][indices['group']],
        requires_approval: data[i][indices['requires_approval']],
        ja_display_name: data[i][indices['ja_display_name']],
        ja_check_1: data[i][indices['ja_check_1']],
        ja_check_2: data[i][indices['ja_check_2']],
        notes: data[i][indices['notes']]
      };
    }
  }

  Logger.log('conditionId ' + conditionId + ' が見つかりません');
  return null;
}

/**
 * テスト用: Condition 情報を取得
 */
function testGetConditionInfo() {
  const info = getConditionInfo('1000');
  Logger.log('Condition 1000: ' + JSON.stringify(info, null, 2));

  const info2 = getConditionInfo('3000');
  Logger.log('Condition 3000: ' + JSON.stringify(info2, null, 2));
}
