/**
 * リサーチシート バインドスクリプト - カスタムメニュー & メニューハンドラ
 *
 * スタンドアロンライブラリ (ResearchLib) のラッパー。
 * ライブラリから Return Object { success, message } を受け取り、
 * getUi().alert() でユーザーに表示する。
 *
 * ライブラリ識別子: ResearchLib (appsscript.json の userSymbol)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// カスタムメニュー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 リサーチツール')
    .addItem('🚀 初期設定', 'menuCompleteInitialSetup')
    .addSeparator()
    .addItem('📦 出品 (Expedited)', 'menuListingPolicy1')
    .addItem('📦 出品 (Economy)',   'menuListingPolicy2')
    .addItem('📦 出品 (書状)',       'menuListingPolicy3')
    .addSeparator()
    .addItem('🔍 最安値検索（全件）',        'menuRunAllLowestPrice')
    .addItem('⏰ 毎日9時の自動実行を設定',   'menuSetupDailyTrigger')
    .addItem('⏹ 毎日9時の自動実行を解除',   'menuRemoveDailyTrigger')
    .addSeparator()
    .addItem('📄 仕様書シートを作成', 'menuCreateSpecSheets')
    .addSeparator()
    .addItem('⚙️ 設定を表示',               'menuShowConfig')
    .addItem('✅ 設定を検証',               'menuCheckConfig')
    .addItem('🔄 初期設定フラグをリセット', 'menuResetSetupFlag')
    .addItem('🔑 権限承認ガイド',           'menuShowAuthGuide')
    .addToUi();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Return Object { success, message } の内容をアラートで表示する
 * @param {Object} result ライブラリ関数の戻り値
 */
function showResult_(result) {
  const ui = SpreadsheetApp.getUi();
  if (!result || typeof result !== 'object') {
    ui.alert('❌ エラー', '予期しない戻り値: ' + JSON.stringify(result), ui.ButtonSet.OK);
    return;
  }
  const title = result.success ? '✅ 完了' : '❌ エラー';
  ui.alert(title, result.message || '', ui.ButtonSet.OK);
}

/**
 * アクティブなスプレッドシートのIDを返す
 * @returns {string}
 */
function getSsId_() {
  return SpreadsheetApp.getActiveSpreadsheet().getId();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メニューハンドラ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 初期設定（Setup.gs に委譲） */
function menuCompleteInitialSetup() {
  initialSetupWithConfirm_();
}

/**
 * 出品（Expedited）
 * カテゴリ不一致時はプロンプトで選択してリトライ
 */
function menuListingPolicy1() {
  const ssId = getSsId_();
  let result = ResearchLib.onListingButtonPolicy1(ssId, '');
  if (!result.success && result.message && result.message.indexOf('カテゴリ不一致') !== -1) {
    const choice = promptCategoryChoice_();
    if (choice === null) return;
    result = ResearchLib.onListingButtonPolicy1(ssId, choice);
  }
  showResult_(result);
}

/** 出品（Economy） */
function menuListingPolicy2() {
  const ssId = getSsId_();
  let result = ResearchLib.onListingButtonPolicy2(ssId, '');
  if (!result.success && result.message && result.message.indexOf('カテゴリ不一致') !== -1) {
    const choice = promptCategoryChoice_();
    if (choice === null) return;
    result = ResearchLib.onListingButtonPolicy2(ssId, choice);
  }
  showResult_(result);
}

/** 出品（書状） */
function menuListingPolicy3() {
  const ssId = getSsId_();
  let result = ResearchLib.onListingButtonPolicy3(ssId, '');
  if (!result.success && result.message && result.message.indexOf('カテゴリ不一致') !== -1) {
    const choice = promptCategoryChoice_();
    if (choice === null) return;
    result = ResearchLib.onListingButtonPolicy3(ssId, choice);
  }
  showResult_(result);
}

/** 最安値検索（全件）- Setup.gs の runAllLowestPriceSA ラッパーを使用 */
function menuRunAllLowestPrice() {
  showResult_(ResearchLib.runAllLowestPriceSA(getSsId_()));
}

/** 毎日9時の自動実行を設定（バインドスクリプト側トリガー） */
function menuSetupDailyTrigger() {
  showResult_(setupDailyTriggerBind_());
}

/** 毎日9時の自動実行を解除 */
function menuRemoveDailyTrigger() {
  showResult_(removeDailyTriggerBind_());
}

/** 仕様書シートを作成（既存削除の確認ダイアログあり） */
function menuCreateSpecSheets() {
  if (!confirmCreateSpecSheets_()) return;
  showResult_(ResearchLib.createSpecSheets(getSsId_()));
}

/** 設定を表示 */
function menuShowConfig() {
  showResult_(ResearchLib.showConfig());
}

/** 設定を検証 */
function menuCheckConfig() {
  showResult_(ResearchLib.checkConfig());
}

/** 初期設定フラグをリセット */
function menuResetSetupFlag() {
  showResult_(ResearchLib.resetInitialSetupFlag());
}

/** 権限承認ガイドを表示 */
function menuShowAuthGuide() {
  showResult_(ResearchLib.showAuthorizationGuide());
}
