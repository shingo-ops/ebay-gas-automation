/**
 * リサーチシート スタンドアロン - 設定管理
 *
 * 出品ツール (gas/listing/standalone/Config.gs) と同じパターンを採用。
 * getActiveSpreadsheet() は使用しない。
 */

/**
 * グローバル変数: 実行中の対象スプレッドシートID
 * 関数実行時にパラメータで指定されたIDを保持し、finally でnullにリセットする。
 */
var CURRENT_SPREADSHEET_ID = null;

/**
 * 対象スプレッドシートを取得
 *
 * 優先順位:
 * 1. 引数で渡された spreadsheetId
 * 2. CURRENT_SPREADSHEET_ID グローバル変数
 *
 * @param {string=} spreadsheetId スプレッドシートID（省略可）
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 * @throws {Error} IDが取得できない場合
 */
function getTargetSpreadsheetResearch(spreadsheetId) {
  const id = spreadsheetId || CURRENT_SPREADSHEET_ID;
  if (!id) {
    throw new Error(
      'スプレッドシートIDが指定されていません。' +
      '関数の引数で渡すか、CURRENT_SPREADSHEET_ID を設定してください。'
    );
  }
  return SpreadsheetApp.openById(id);
}
