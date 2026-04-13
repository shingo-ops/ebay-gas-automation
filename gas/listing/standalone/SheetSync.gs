/**
 * シート双方向同期機能（スタンドアロン）
 * container/Code.gs の ⚙️メニューから呼び出す
 */

// 同期対象シート名リスト（出品シートは絶対に含めない）
const SYNC_TARGET_SHEETS = [
  'Vero/禁止ワード',
  '状態_テンプレ',
  'Description_テンプレ',
  '担当者管理',
  'ポリシー管理',
  'ツール設定',
  'HARU_CSV',
  'セルスタ_CSV',
  'プルダウン管理'
];

// 絶対に触ってはいけないシート
const PROTECTED_SHEETS = ['出品'];

/**
 * シート同期実行
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @param {string} sheetName 同期するシート名
 * @param {string} direction 'ss_to_db' または 'db_to_ss'
 * @returns {{ success: boolean, message: string }}
 */
function syncSheet(spreadsheetId, sheetName, direction) {
  try {
    Logger.log('=== シート同期開始: ' + sheetName + ' / 方向: ' + direction + ' ===');

    // 保護シートチェック
    if (PROTECTED_SHEETS.indexOf(sheetName) !== -1) {
      return { success: false, message: '「' + sheetName + '」は同期対象外のシートです。' };
    }

    // 対象シートチェック
    if (SYNC_TARGET_SHEETS.indexOf(sheetName) === -1) {
      return { success: false, message: '「' + sheetName + '」は同期対象のシートではありません。' };
    }

    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    // 出品DBのIDを取得
    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;
    if (!outputDbId) {
      return { success: false, message: '出品DBが設定されていません。ツール設定を確認してください。' };
    }

    // 出品SS・出品DBを開く
    const sourceSS = direction === 'ss_to_db'
      ? getTargetSpreadsheet(spreadsheetId)
      : SpreadsheetApp.openById(outputDbId);
    const destSS   = direction === 'ss_to_db'
      ? SpreadsheetApp.openById(outputDbId)
      : getTargetSpreadsheet(spreadsheetId);

    const sourceLabel = direction === 'ss_to_db' ? '出品スプレッドシート' : '出品DB';
    const destLabel   = direction === 'ss_to_db' ? '出品DB' : '出品スプレッドシート';

    // コピー元シートを取得
    const sourceSheet = sourceSS.getSheetByName(sheetName);
    if (!sourceSheet) {
      return { success: false, message: sourceLabel + 'に「' + sheetName + '」シートが見つかりません。' };
    }

    // コピー先シートを取得または作成
    let destSheet = destSS.getSheetByName(sheetName);
    if (!destSheet) {
      destSheet = destSS.insertSheet(sheetName);
      Logger.log('✅ ' + destLabel + 'に「' + sheetName + '」シートを新規作成しました');
    }

    // コピー元のデータを取得
    const lastRow = sourceSheet.getLastRow();
    const lastCol = sourceSheet.getLastColumn();

    // コピー先をクリア
    destSheet.clearContents();
    destSheet.clearFormats();

    if (lastRow > 0 && lastCol > 0) {
      // 値をコピー
      const values = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();
      destSheet.getRange(1, 1, lastRow, lastCol).setValues(values);

      // 書式をコピー（背景色・太字）
      try {
        const backgrounds = sourceSheet.getRange(1, 1, lastRow, lastCol).getBackgrounds();
        const fontWeights  = sourceSheet.getRange(1, 1, lastRow, lastCol).getFontWeights();
        destSheet.getRange(1, 1, lastRow, lastCol).setBackgrounds(backgrounds);
        destSheet.getRange(1, 1, lastRow, lastCol).setFontWeights(fontWeights);
      } catch (fmtErr) {
        Logger.log('⚠️ 書式コピーエラー（値のコピーは完了）: ' + fmtErr.toString());
      }

      Logger.log('✅ ' + lastRow + '行 × ' + lastCol + '列をコピー完了');
    } else {
      Logger.log('⚠️ コピー元が空のためクリアのみ実行');
    }

    return {
      success: true,
      message: '「' + sheetName + '」を ' + sourceLabel + ' → ' + destLabel + ' に同期しました。\n' +
               '（' + lastRow + '行 × ' + lastCol + '列）'
    };

  } catch (e) {
    Logger.log('❌ シート同期エラー: ' + e.toString());
    return { success: false, message: 'シート同期エラー: ' + e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 同期対象シートリストを返す（container側のHTML生成用）
 */
function getSyncTargetSheets() {
  return SYNC_TARGET_SHEETS;
}
