/**
 * eBay出品管理 - メニュー機能（スタンドアロン版）
 *
 * 実用コード: UI操作なし、結果のみを返す
 * バインドスクリプト側でUI表示を行う
 */

/**
 * 【ポリシー取得】
 * eBayからポリシーを取得してシートに出力
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Object} { success: boolean, result?: Object, error?: string, message?: string }
 */
function menuGetPolicies(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    Logger.log('=== ポリシー取得開始 ===');

    // トークン自動更新（必要に応じて）
    autoRefreshTokenIfNeeded(spreadsheetId);

    // ポリシー取得実行
    const result = exportPoliciesToSheet(spreadsheetId);

    Logger.log('✅ ポリシー取得完了');
    Logger.log('- Fulfillment Policy: ' + result.fulfillmentCount + '件');
    Logger.log('- Return Policy: ' + result.returnCount + '件');
    Logger.log('- Payment Policy: ' + result.paymentCount + '件');

    return {
      success: true,
      result: result,
      message: '✅ ポリシーを取得しました\n\n' +
               '- Fulfillment Policy: ' + result.fulfillmentCount + '件\n' +
               '- Return Policy: ' + result.returnCount + '件\n' +
               '- Payment Policy: ' + result.paymentCount + '件\n' +
               '合計: ' + result.totalCount + '件'
    };

  } catch (error) {
    Logger.log('❌ ポリシー取得エラー: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: '❌ ポリシー取得エラー:\n\n' + error.toString()
    };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 【ポリシー更新】
 * シートの変更をeBayに同期
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Object} { success: boolean, result?: Object, error?: string, message?: string }
 */
function menuSyncPolicies(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    Logger.log('=== ポリシー同期開始 ===');

    // トークン自動更新（必要に応じて）
    autoRefreshTokenIfNeeded(spreadsheetId);

    // ポリシー同期実行
    const result = syncPoliciesToEbay(spreadsheetId);

    Logger.log('✅ ポリシー同期完了');
    Logger.log('- 作成: ' + result.created.length + '件');
    Logger.log('- 更新: ' + result.updated.length + '件');
    Logger.log('- 削除: ' + result.deleted.length + '件');
    Logger.log('- スキップ: ' + result.skipped + '件');

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

    return {
      success: true,
      result: result,
      message: message
    };

  } catch (error) {
    Logger.log('❌ ポリシー同期エラー: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: '❌ ポリシー同期エラー:\n\n' + error.toString()
    };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 設定確認（ログ出力）
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 */
function checkSettings(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const targetId = getTargetSpreadsheetId();
    const config = getEbayConfig();

    Logger.log('=== eBay出品設定 ===');
    Logger.log('');
    Logger.log('対象スプレッドシート: ' + targetId);
    Logger.log('App ID: ' + (config.appId ? config.appId.substring(0, 20) + '...' : '未設定'));
    Logger.log('Cert ID: ' + (config.certId ? config.certId.substring(0, 20) + '...' : '未設定'));
    Logger.log('Dev ID: ' + (config.devId ? config.devId.substring(0, 20) + '...' : '未設定'));
    Logger.log('User Token: ' + (config.userToken ? config.userToken.substring(0, 20) + '...' : '未設定'));
    Logger.log('カテゴリマスタ: ' + (config.categoryMasterSpreadsheetId ? 'OK' : '未設定'));
    Logger.log('');
    Logger.log('✅ 設定確認完了');

    return 'OK';

  } catch (error) {
    Logger.log('❌ 設定確認エラー: ' + error.toString());
    throw error;
  }
}
