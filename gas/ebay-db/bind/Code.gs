/**
 * eBay出品DB - バインドスクリプト（自動同期用）
 * Deployed to: eBay_出品DB spreadsheet (DEV)
 *
 * 出品DBスプレッドシートに設置するバインドスクリプト。
 * 設定系シートの変更を検知して出品シートに自動同期する (db → ss)。
 *
 * セットアップ手順:
 * 1. 出品DBスプレッドシートで「拡張機能」→「Apps Script」を開く
 * 2. このコードを貼り付け
 * 3. ライブラリ: EbayLib を追加（scriptID はツール設定 B18）、識別子 EbayLib
 * 4. 保存 → 「eBay出品DB」→「権限承認・トリガー登録」を実行
 */

// 自動同期対象シート（設定系シートのみ）
const SYNC_TARGET_SHEETS_DB = [
  'プルダウン管理', 'ツール設定', '状態_テンプレ',
  'Description_テンプレ', '担当者管理', '報酬管理', 'ポリシー管理'
];

/**
 * スプレッドシートを開いたときにカスタムメニューを追加
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ 出品DB')
    .addItem('権限承認・トリガー登録', 'authorizeDBScript')
    .addToUi();
}

/**
 * 出品DB側の onEdit トリガー
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

/**
 * 権限承認 & installable onEdit トリガー登録
 * 初回セットアップ時に手動で実行する
 */
function authorizeDBScript() {
  // 既存の handleEditDB トリガーを削除（重複登録防止）
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'handleEditDB') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // installable onEdit トリガーを登録
  ScriptApp.newTrigger('handleEditDB')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ セットアップ完了\n\n' +
    '出品DBの設定系シートを編集すると、\n' +
    '出品シートに自動同期されます。'
  );
}
