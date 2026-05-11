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
 * 【出品実行】
 * "出品"シートの選択行を出品
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @param {number} rowNumber 出品する行番号（5行目以降）
 * @returns {Object} { success: boolean, result?: Object, error?: string, message?: string }
 */
function menuCreateListing(spreadsheetId, rowNumber) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    Logger.log('=== 出品実行: 行' + rowNumber + ' ===');

    // トークン自動更新（必要に応じて）
    autoRefreshTokenIfNeeded(spreadsheetId);

    // 出品実行
    const result = createListing(spreadsheetId, rowNumber);

    // 出品失敗チェック
    if (!result || !result.success) {
      var errorMsg = (result && result.message) ? result.message : '不明なエラーが発生しました';
      Logger.log('❌ 出品失敗: ' + errorMsg);
      return {
        success: false,
        message: errorMsg
      };
    }

    Logger.log('✅ 出品完了');
    Logger.log('- SKU: ' + result.sku);
    Logger.log('- Item ID: ' + result.itemId);
    Logger.log('- 転記: ' + (result.transferred ? '成功' : 'スキップ'));
    Logger.log('- 行処理: ' + (result.rowCleared ? 'クリア・移動完了' : 'スキップ'));

    let message = '✅ 出品が完了しました（Trading API）\n\n' +
                  'SKU: ' + result.sku + '\n' +
                  'Item ID: ' + result.itemId + '\n\n';

    // Promoted Listing結果を追加
    if (result.promotedListing) {
      if (result.promotedListing.success) {
        message += '✅ Promoted Listing設定完了\n';
        if (result.promotedListing.adId) {
          message += 'Ad ID: ' + result.promotedListing.adId + '\n';
        }
        message += '\n';
      } else {
        message += '⚠️ Promoted Listing設定失敗\n' +
                   result.promotedListing.error + '\n\n';
      }
    }

    // 転記・行処理結果を追加
    if (result.transferred) {
      message += '✅ 出品DBに転記しました\n';
      if (result.rowCleared) {
        message += '✅ データをクリアして行を最下部に移動しました\n';
        message += '   （数式・入力規則は維持されています）\n';
      }
      message += '\n';
    } else {
      message += '⚠️ 出品DB転記をスキップしました\n' +
                 '（"ツール設定"シートの"出品DB"を設定すると自動転記されます）\n\n';
    }

    message += 'Seller Hubで編集・管理が可能です';

    return {
      success: true,
      result: result,
      message: message
    };

  } catch (error) {
    Logger.log('❌ 出品エラー: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: '❌ 出品エラー:\n\n' + error.toString()
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
