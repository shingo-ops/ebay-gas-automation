/**
 * RegisterTrigger.gs - eBay出品DB onEdit トリガー登録
 *
 * container script (standalone) から clasp run で実行可能。
 * CI フロー: clasp push → clasp run registerHandleEditTrigger
 *
 * 目的: eBay出品DB スプレッドシートの installable onEdit トリガーを
 *       このスクリプトプロジェクトに登録する。
 *       bind スクリプトは container-bound のため Execution API から実行不可であり、
 *       同等の handleEditDB をこの standalone スクリプトに配置して CI から自動登録する。
 */

var DB_SPREADSHEET_ID = '1gGoJSu-ckMllYWuFCoERGVIPBDGvpVVRHDStx58MEgQ';

var SYNC_TARGET_SHEETS_DB = [
  'プルダウン管理', 'ツール設定', '状態_テンプレ',
  'Description_テンプレ', '担当者管理', '報酬管理', 'ポリシー管理'
];

/**
 * eBay出品DB の installable onEdit トリガーを登録
 * 既存の handleEditDB トリガーを削除してから再登録（重複防止）
 *
 * 実行方法: clasp run registerHandleEditTrigger
 */
function registerHandleEditTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'handleEditDB') {
      ScriptApp.deleteTrigger(t);
    }
  });

  var ss = SpreadsheetApp.openById(DB_SPREADSHEET_ID);

  ScriptApp.newTrigger('handleEditDB')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log('✅ handleEditDB トリガー登録完了 (spreadsheetId=' + DB_SPREADSHEET_ID + ')');
}

/**
 * eBay出品DB の onEdit ハンドラー
 * 設定系シートの変更を検知して出品シートに自動同期 (db → ss)
 *
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function handleEditDB(e) {
  if (!e || !e.range) return;
  var sheetName = e.range.getSheet().getName();
  if (SYNC_TARGET_SHEETS_DB.indexOf(sheetName) === -1) return;

  try {
    var result = EbayLib.autoSyncDBToSheet(e.source.getId(), sheetName);
    if (result && !result.success) {
      Logger.log('⚠️ 自動同期スキップ（' + sheetName + '）: ' + result.message);
    }
  } catch (err) {
    Logger.log('handleEditDB エラー（継続）: ' + err.toString());
  }
}
