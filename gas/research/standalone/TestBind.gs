/**
 * PoC テスト用バインドスクリプト
 *
 * このファイルは gas/research/standalone をライブラリとして追加した
 * バインドスクリプト側に配置し、Apps Script エディタから手動実行する。
 *
 * 使い方:
 * 1. Apps Script エディタで新規プロジェクトを作成
 * 2. 左メニュー「ライブラリ」→ research/standalone のスクリプトIDを追加
 *    識別子: ResearchLib
 * 3. このファイルのコードを貼り付け
 * 4. runAllPocTests() を実行
 *
 * Phase 2 完了・確認後にこのファイルは削除する。
 */

/**
 * 3点 PoC 検証を一括実行
 * Apps Script エディタから手動で実行する。
 */
function runAllPocTests() {
  const ui = SpreadsheetApp.getUi();
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();

  // バインドスクリプト側の ScriptProperties をプレーンオブジェクトに変換して渡す
  const propsData = PropertiesService.getScriptProperties().getProperties();

  // 検証1: openById
  const test1 = ResearchLib.pocOpenById(ssId);

  // 検証2: Return Object
  const test2 = ResearchLib.pocReturnObject(ssId);

  // 検証3: ScriptProperties 引数渡し
  const test3 = ResearchLib.pocProperties(ssId, propsData);

  const allPass = test1.success && test2.success && test3.success;

  const report = [
    '=== PoC 検証結果 ===',
    '',
    '【検証1: openById】',
    test1.message,
    '',
    '【検証2: Return Object】',
    test2.message,
    '',
    '【検証3: Props引数渡し】',
    test3.message,
    '',
    '─────────────────',
    '総合結果: ' + (allPass ? '✅ 全件PASS' : '❌ 失敗あり')
  ].join('\n');

  ui.alert('PoC 検証結果', report, ui.ButtonSet.OK);
  Logger.log(report);
}

/**
 * 検証1のみ単独実行（デバッグ用）
 */
function runTest1() {
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = ResearchLib.pocOpenById(ssId);
  SpreadsheetApp.getUi().alert('検証1', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 検証2のみ単独実行（デバッグ用）
 */
function runTest2() {
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = ResearchLib.pocReturnObject(ssId);
  SpreadsheetApp.getUi().alert('検証2', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 検証3のみ単独実行（デバッグ用）
 */
function runTest3() {
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const propsData = PropertiesService.getScriptProperties().getProperties();
  const result = ResearchLib.pocProperties(ssId, propsData);
  SpreadsheetApp.getUi().alert('検証3', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}
