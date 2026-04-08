/**
 * eBay API スプレッドシートツール - メインエントリーポイント
 *
 * このファイルはスプレッドシートとの主要な接点となります
 */

/**
 * スプレッドシート起動時に実行される関数
 * カスタムメニューを追加します
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('eBay API')
    .addItem('🔐 認証', 'showAuthDialog')
    .addSeparator()
    .addItem('🔍 商品検索', 'showSearchDialog')
    .addItem('📦 在庫同期', 'syncInventory')
    .addItem('📋 注文取得', 'fetchOrders')
    .addSeparator()
    .addItem('📊 ダッシュボード作成', 'createDashboard')
    .addSeparator()
    .addItem('⚙️ 設定', 'showSettingsDialog')
    .addItem('ℹ️ バージョン情報', 'showAboutDialog')
    .addToUi();

  Logger.log('eBay API ツールが初期化されました');
}

/**
 * 認証ダイアログを表示
 */
function showAuthDialog() {
  const html = HtmlService.createHtmlOutputFromFile('AuthDialog')
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'eBay API 認証');
}

/**
 * 商品検索ダイアログを表示
 */
function showSearchDialog() {
  // 認証チェック
  if (!isAuthenticated()) {
    SpreadsheetApp.getUi().alert('先に認証を完了してください');
    return;
  }

  const html = HtmlService.createHtmlOutputFromFile('SearchDialog')
    .setWidth(600)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, '商品検索');
}

/**
 * 設定ダイアログを表示
 */
function showSettingsDialog() {
  const html = HtmlService.createHtmlOutputFromFile('SettingsDialog')
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, '設定');
}

/**
 * バージョン情報ダイアログを表示
 */
function showAboutDialog() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'eBay API スプレッドシートツール',
    'Version: 1.0.0\n\n' +
    '作成者: 谷澤真吾\n' +
    '作成日: 2026-03-10\n\n' +
    'eBay API を使用してスプレッドシートから商品管理、在庫管理、注文管理を行うツールです。',
    ui.ButtonSet.OK
  );
}

/**
 * 在庫同期を実行
 */
function syncInventory() {
  if (!isAuthenticated()) {
    SpreadsheetApp.getUi().alert('先に認証を完了してください');
    return;
  }

  try {
    SpreadsheetApp.getUi().alert('在庫同期を開始します...');
    // TODO: 在庫同期ロジックの実装
    const result = syncInventoryFromEbay();
    SpreadsheetApp.getUi().alert(`在庫同期が完了しました。\n${result.count}件の商品を更新しました。`);
  } catch (error) {
    Logger.log('在庫同期エラー: ' + error.toString());
    SpreadsheetApp.getUi().alert('エラー: ' + error.message);
  }
}

/**
 * 注文情報を取得
 */
function fetchOrders() {
  if (!isAuthenticated()) {
    SpreadsheetApp.getUi().alert('先に認証を完了してください');
    return;
  }

  try {
    SpreadsheetApp.getUi().alert('注文情報を取得しています...');
    // TODO: 注文取得ロジックの実装
    const result = fetchOrdersFromEbay();
    SpreadsheetApp.getUi().alert(`注文取得が完了しました。\n${result.count}件の注文を取得しました。`);
  } catch (error) {
    Logger.log('注文取得エラー: ' + error.toString());
    SpreadsheetApp.getUi().alert('エラー: ' + error.message);
  }
}

/**
 * ダッシュボードシートを作成
 */
function createDashboard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let dashboard = ss.getSheetByName('ダッシュボード');

    if (!dashboard) {
      dashboard = ss.insertSheet('ダッシュボード', 0);
    }

    dashboard.clear();

    // ヘッダー
    dashboard.getRange('A1:D1')
      .setValues([['eBay API ダッシュボード', '', '', '']])
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontSize(16)
      .setFontWeight('bold')
      .merge();

    // 統計情報セクション
    dashboard.getRange('A3').setValue('📊 統計情報');
    dashboard.getRange('A3').setFontWeight('bold').setFontSize(14);

    dashboard.getRange('A4:B8').setValues([
      ['総商品数', '=COUNTA(商品マスタ!A:A)-1'],
      ['総在庫数', '=SUM(商品マスタ!D:D)'],
      ['総注文数', '=COUNTA(注文管理!A:A)-1'],
      ['今月の売上', '=SUMIF(注文管理!C:C,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),注文管理!E:E)'],
      ['前月の売上', '=SUMIF(注文管理!C:C,">="&DATE(YEAR(TODAY()),MONTH(TODAY())-1,1),注文管理!E:E)-SUMIF(注文管理!C:C,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),注文管理!E:E)']
    ]);

    // 最終更新時刻
    dashboard.getRange('A10').setValue('最終更新:');
    dashboard.getRange('B10').setValue(new Date()).setNumberFormat('yyyy/mm/dd hh:mm:ss');

    SpreadsheetApp.getUi().alert('ダッシュボードを作成しました');
  } catch (error) {
    Logger.log('ダッシュボード作成エラー: ' + error.toString());
    SpreadsheetApp.getUi().alert('エラー: ' + error.message);
  }
}

/**
 * 認証状態をチェック
 */
function isAuthenticated() {
  const token = getAccessToken();
  return token !== null && token !== '';
}

/**
 * テスト用関数
 */
function testConnection() {
  Logger.log('接続テストを開始します');

  try {
    const config = getConfig();
    Logger.log('設定: ' + JSON.stringify(config));

    if (isAuthenticated()) {
      Logger.log('認証済み');
      const token = getAccessToken();
      Logger.log('トークン（先頭10文字）: ' + token.substring(0, 10));
    } else {
      Logger.log('未認証');
    }
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
  }
}
