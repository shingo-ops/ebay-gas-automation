/**
 * eBay出品管理 - クライアント側バインドスクリプト
 *
 * このスクリプトは各クライアントのスプレッドシートに設置します
 *
 * セットアップ手順:
 * 1. スプレッドシートで「拡張機能」→「Apps Script」を開く
 * 2. このコードを貼り付け
 * 3. 「ライブラリ」→「ライブラリを追加」
 * 4. スクリプトID: ツール設定シートのライブラリスクリプトID（B18）を使用
 * 5. 識別子: EbayLib
 * 6. バージョン: Head（開発中）または最新バージョン（本番）
 * 7. 保存
 *
 * 図形ボタンに割り当てる関数:
 * - setupEbayManager: 初回セットアップ
 * - menuGetPolicies: ポリシー取得
 * - menuSyncPolicies: ポリシー更新
 */


/**
 * 【ポリシー取得ボタン】
 *
 * 図形ボタンから呼び出す関数
 * スクリプト割り当て: menuGetPolicies
 */
function menuGetPolicies() {
  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const ui = SpreadsheetApp.getUi();

    // 確認ダイアログ
    const response = ui.alert(
      'ポリシー取得',
      'eBayからポリシーを取得してシートを更新します。\n既存のデータは上書きされます（操作列とプルダウンは保持）。\n\n実行しますか？',
      ui.ButtonSet.OK_CANCEL
    );

    if (response !== ui.Button.OK) {
      Logger.log('キャンセルされました');
      return;
    }

    // ライブラリ経由でポリシー取得実行
    const result = EbayLib.exportPoliciesToSheet(spreadsheetId);

    // 完了メッセージ
    ui.alert(
      '取得完了',
      '✅ ポリシーを取得しました\n\n' +
      '- Fulfillment Policy: ' + result.fulfillmentCount + '件\n' +
      '- Return Policy: ' + result.returnCount + '件\n' +
      '- Payment Policy: ' + result.paymentCount + '件\n' +
      '合計: ' + result.totalCount + '件',
      ui.ButtonSet.OK
    );

  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('エラー', '❌ ' + error.toString(), ui.ButtonSet.OK);
    Logger.log('❌ ポリシー取得エラー: ' + error.toString());
  }
}

/**
 * 【ポリシー更新ボタン】
 *
 * 図形ボタンから呼び出す関数
 * スクリプト割り当て: menuSyncPolicies
 */
function menuSyncPolicies() {
  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const ui = SpreadsheetApp.getUi();

    // 確認ダイアログ
    const response = ui.alert(
      'ポリシー更新',
      'シートの変更をeBayに反映します。\n\n' +
      '- 操作列が「追加」→ 新規作成\n' +
      '- 操作列が「更新」→ 更新\n' +
      '- 操作列が「削除」→ 削除\n' +
      '- 操作列が「-」または空欄 → スキップ\n\n' +
      '実行しますか？',
      ui.ButtonSet.OK_CANCEL
    );

    if (response !== ui.Button.OK) {
      Logger.log('キャンセルされました');
      return;
    }

    // ライブラリ経由でポリシー同期実行
    const result = EbayLib.syncPoliciesToEbay(spreadsheetId);

    // 完了メッセージ
    let message = '✅ 同期が完了しました\n\n';
    message += '作成: ' + result.created.length + '件\n';
    message += '更新: ' + result.updated.length + '件\n';
    message += '削除: ' + result.deleted.length + '件\n';
    message += 'スキップ: ' + result.skipped + '件\n';

    if (result.errors.length > 0) {
      message += '\n⚠️ エラー: ' + result.errors.length + '件\n';
      message += '詳細はログを確認してください';
    }

    ui.alert('同期完了', message, ui.ButtonSet.OK);

  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('エラー', '❌ ' + error.toString(), ui.ButtonSet.OK);
    Logger.log('❌ ポリシー同期エラー: ' + error.toString());
  }
}

/**
 * 【初回セットアップ】
 * 図形ボタンに割り当てる関数
 *
 * 前提条件: EbayLib ライブラリが追加済みであること
 */
function setupEbayManager() {
  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const ui = SpreadsheetApp.getUi();

    Logger.log('=== eBay出品管理 - 初回セットアップ開始 ===');
    Logger.log('スプレッドシートID: ' + spreadsheetId);

    // ライブラリ経由でセットアップ実行
    const result = EbayLib.setupEbayManager(spreadsheetId);

    // 結果をUIに表示
    if (result.success) {
      ui.alert(
        'セットアップ完了',
        result.message,
        ui.ButtonSet.OK
      );
      Logger.log('✅ セットアップ完了');
    } else {
      ui.alert(
        'エラー',
        result.message,
        ui.ButtonSet.OK
      );
      Logger.log('❌ セットアップ失敗: ' + result.error);
    }

    Logger.log('=== 初回セットアップ処理完了 ===');
    return result;

  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('エラー', '❌ ' + error.toString(), ui.ButtonSet.OK);
    Logger.log('❌ セットアップエラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * ツール設定シートからライブラリ情報を取得
 *
 * ライブラリが未追加の場合に使用
 *
 * @returns {Object} { scriptId: string, identifier: string }
 */
function getLibraryInfoFromSheet() {
  try {
    const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ツール設定');

    if (!settingsSheet) {
      // フォールバック
      return {
        scriptId: '13B_QVLCmt-KuxsyytDsS-2Ca6S_PLyNb-ZlEVbpg0T5-vEvM3otTLn1Y',
        identifier: 'EbayLib'
      };
    }

    const data = settingsSheet.getDataRange().getValues();

    for (let i = 0; i < data.length; i++) {
      const key = data[i][0];
      const value = data[i][1];

      if (key === 'ライブラリスクリプトID') {
        return {
          scriptId: value,
          identifier: 'EbayLib'
        };
      }
    }

    // 見つからない場合はフォールバック
    return {
      scriptId: '13B_QVLCmt-KuxsyytDsS-2Ca6S_PLyNb-ZlEVbpg0T5-vEvM3otTLn1Y',
      identifier: 'EbayLib'
    };

  } catch (e) {
    Logger.log('⚠️ ライブラリ情報取得エラー: ' + e.toString());
    return {
      scriptId: '13B_QVLCmt-KuxsyytDsS-2Ca6S_PLyNb-ZlEVbpg0T5-vEvM3otTLn1Y',
      identifier: 'EbayLib'
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OAuth設定テスト関数（Apps Scriptエディタから実行）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 【テスト0】テストガイド表示
 */
function showOAuthTestGuide() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  EbayLib.showTestGuide();
}

/**
 * 【テスト1】OAuth設定確認
 */
function testCheckOAuthSettings() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testCheckOAuthSettings(spreadsheetId);
}

/**
 * 【テスト2】OAuth認証URL生成
 */
function testGenerateAuthUrl() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testGenerateAuthUrl(spreadsheetId);
}

/**
 * 【テスト3】トークン取得
 *
 * 使い方: testExchangeTokens("ここにコピーしたAuthorization Codeを貼り付け")
 */
function testExchangeTokens(authorizationCode) {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testExchangeTokens(spreadsheetId, authorizationCode);
}

/**
 * 【テスト4】トークン自動更新テスト
 */
function testAutoRefresh() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testAutoRefresh(spreadsheetId);
}

/**
 * 【テスト5】ポリシー取得（統合テスト）
 */
function testGetPolicies() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testGetPolicies(spreadsheetId);
}
