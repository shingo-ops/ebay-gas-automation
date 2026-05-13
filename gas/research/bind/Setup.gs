/**
 * リサーチシート バインドスクリプト - セットアップ & 確認ダイアログ
 *
 * 以下を担当:
 *  1. 初回セットアップフロー（確認ダイアログ → ResearchLib.completeInitialSetup）
 *  2. 毎日自動実行トリガー管理（バインドスクリプト側で保持）
 *  3. カテゴリ不一致選択プロンプト（Phase 5 で除去した ui.prompt を復活）
 *  4. 仕様書シート作成の削除確認ダイアログ（Phase 5 で除去した ui.alert を復活）
 *
 * 【タイムベーストリガー設計】
 * ライブラリ経由で登録したトリガーは CURRENT_SPREADSHEET_ID が null になるため、
 * バインドスクリプト側に runDailyLowestPriceBind_() を定義し、
 * ScriptProperties から ssId を取得して ResearchLib.runAllLowestPriceSA() を呼ぶ。
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 初回セットアップ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 初期設定フロー（Menu.gs の menuCompleteInitialSetup から呼ばれる）
 * 確認ダイアログを表示してから ResearchLib.completeInitialSetup を実行する
 */
function initialSetupWithConfirm_() {
  const ui = SpreadsheetApp.getUi();
  const ssId = getSsId_();

  const response = ui.alert(
    '⚙️ 初期設定',
    '初期設定を実行します。\n\n実行内容:\n' +
    '1. 権限承認（初回のみ）\n' +
    '2. 設定検証\n' +
    '3. eBay API 接続テスト\n' +
    '4. 自動実行トリガー登録（初回のみ）\n\n' +
    '続行しますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (response !== ui.Button.OK) return;

  // ssId を保存（毎日自動実行トリガー用）
  PropertiesService.getScriptProperties().setProperty('TARGET_SS_ID', ssId);

  showResult_(ResearchLib.completeInitialSetup(ssId));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 毎日自動実行トリガー（バインドスクリプト側で管理）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 毎日9時の自動実行ハンドラ（バインドスクリプト側トリガーから呼ばれる）
 * ScriptProperties の TARGET_SS_ID を取得して ResearchLib.runAllLowestPriceSA を実行する
 *
 * NOTE: ライブラリ経由でタイムベーストリガーを登録すると CURRENT_SPREADSHEET_ID が
 *       null のままになる。そのため、このバインドスクリプト側関数を代わりに登録する。
 */
function runDailyLowestPriceBind_() {
  const ssId = PropertiesService.getScriptProperties().getProperty('TARGET_SS_ID');
  if (!ssId) {
    Logger.log('ERROR: TARGET_SS_ID が未設定です。menuSetupDailyTrigger を再実行してください。');
    return;
  }
  const result = ResearchLib.runAllLowestPriceSA(ssId);
  Logger.log('runDailyLowestPriceBind_ 結果: ' + JSON.stringify(result));
}

/**
 * 毎日9時の自動実行トリガーをバインドスクリプト側に登録する
 * @returns {{ success: boolean, message: string }}
 */
function setupDailyTriggerBind_() {
  const ssId = getSsId_();

  // ssId を保存
  PropertiesService.getScriptProperties().setProperty('TARGET_SS_ID', ssId);

  // 既存の同名トリガーを削除（重複防止）
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runDailyLowestPriceBind_' &&
        t.getEventType() === ScriptApp.EventType.CLOCK) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('runDailyLowestPriceBind_')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  return { success: true, message: '✅ 毎日9時の自動実行を設定しました（バインドスクリプト側トリガー）' };
}

/**
 * 毎日9時の自動実行トリガーを解除する
 * @returns {{ success: boolean, message: string }}
 */
function removeDailyTriggerBind_() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runDailyLowestPriceBind_' &&
        t.getEventType() === ScriptApp.EventType.CLOCK) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  return {
    success: true,
    message: removed > 0 ? '✅ 自動実行を解除しました' : '⚠️ 自動実行が設定されていません',
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 確認ダイアログ（Phase 5 で除去した UI を復活）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * カテゴリ不一致時の選択プロンプト
 * transferListingDataWithPolicy が { success: false, message: 'カテゴリ不一致...' } を
 * 返した場合に呼ばれる（Menu.gs の menuListingPolicy1/2/3 から呼ばれる）
 *
 * @returns {string|null} '1'（Item URL）, '2'（スペックURL）、キャンセル時は null
 */
function promptCategoryChoice_() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📂 カテゴリ不一致',
    'Item URL のカテゴリIDとスペックURLのカテゴリIDが一致しません。\n\n' +
    'どちらのカテゴリを使用しますか？\n\n' +
    '  1: Item URL のカテゴリを使用\n' +
    '  2: スペック URL のカテゴリを使用\n\n' +
    '1 または 2 を入力してください',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return null;
  const val = response.getResponseText().trim();
  return (val === '1' || val === '2') ? val : null;
}

/**
 * 仕様書シート作成前の削除確認ダイアログ
 * 既存の仕様書シートがある場合に削除して再作成する旨を確認する
 *
 * @returns {boolean} OK なら true、キャンセルなら false
 */
function confirmCreateSpecSheets_() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '📄 仕様書シートを作成',
    '仕様書シートを作成します。\n\n' +
    '既存の「仕様書（ユーザー向け）」「仕様書（技術）」シートがある場合は\n' +
    '削除して再作成されます。\n\n' +
    '続行しますか？',
    ui.ButtonSet.OK_CANCEL
  );
  return response === ui.Button.OK;
}
