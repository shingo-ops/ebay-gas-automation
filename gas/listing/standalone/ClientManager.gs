/**
 * クライアント別処理管理モジュール
 */

/**
 * 指定クライアントのポリシー取得処理
 *
 * @param {string} clientKey - クライアント識別キー（例: CLIENT_A）
 * @returns {Object} 処理結果
 */
function processClient(clientKey) {
  // グローバル変数をリセット（Tenant ID厳格分離）
  CURRENT_SPREADSHEET_ID = null;

  try {
    // === Config.gsの関数を使い回す ===
    const spreadsheetId = getClientInfo(clientKey);  // スプレッドシートIDのみ取得
    Logger.log('処理開始: ' + clientKey);

    // ポリシー取得処理
    const result = exportPoliciesToSheet(spreadsheetId);

    return {
      success: true,
      clientKey: clientKey,
      result: result
    };

  } catch (error) {
    Logger.log('❌ エラー: ' + clientKey + ' - ' + error.toString());
    return {
      success: false,
      clientKey: clientKey,
      error: error.toString()
    };

  } finally {
    // 処理完了後、グローバル変数をクリア
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 全クライアント一括処理
 *
 * @returns {Array} 各クライアントの処理結果
 */
function processAllClients() {
  // === Config.gsの関数を使い回す ===
  const clients = getEnabledClients();

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  Logger.log('=== 全クライアント処理開始 ===');
  Logger.log('対象クライアント数: ' + clients.length + '件');
  Logger.log('');

  clients.forEach(function(client) {
    try {
      const result = processClient(client.key);
      results.push(result);

      if (result.success) {
        successCount++;
        Logger.log('✅ 成功: ' + client.key);
      } else {
        failureCount++;
        Logger.log('❌ 失敗: ' + client.key);
      }

    } catch (error) {
      failureCount++;
      results.push({
        success: false,
        clientKey: client.key,
        error: error.toString()
      });
      Logger.log('❌ 例外: ' + client.key + ' - ' + error.toString());
    }
  });

  // 結果サマリー
  Logger.log('');
  Logger.log('=== 処理結果 ===');
  Logger.log('成功: ' + successCount + '件');
  Logger.log('失敗: ' + failureCount + '件');
  Logger.log('合計: ' + clients.length + '件');

  return results;
}

/**
 * メインシートのポリシー列を読み取る例（将来実装）
 *
 * @param {string} clientKey - クライアント識別キー
 */
function readClientPolicies(clientKey) {
  try {
    // === Config.gsの関数を使い回す ===
    const spreadsheetId = getClientInfo(clientKey);  // スプレッドシートIDのみ取得
    const targetSpreadsheet = getTargetSpreadsheet(spreadsheetId);
    const listingSheet = targetSpreadsheet.getSheetByName(SHEET_NAMES.LISTING);

    // === Config.gsのヘッダーマッピング関数を使い回す ===
    const headerMapping = buildHeaderMapping();

    const shippingPolicyCol = getColumnByHeader(headerMapping, 'Shipping Policy');
    const returnPolicyCol = getColumnByHeader(headerMapping, 'Return Policy');
    const paymentPolicyCol = getColumnByHeader(headerMapping, 'Payment Policy');

    // 列番号を使って読み取り
    const row = 5;
    const shippingPolicy = listingSheet.getRange(row, shippingPolicyCol).getValue();
    const returnPolicy = listingSheet.getRange(row, returnPolicyCol).getValue();
    const paymentPolicy = listingSheet.getRange(row, paymentPolicyCol).getValue();

    Logger.log('Shipping Policy: ' + shippingPolicy);
    Logger.log('Return Policy: ' + returnPolicy);
    Logger.log('Payment Policy: ' + paymentPolicy);

    return {
      shippingPolicy: shippingPolicy,
      returnPolicy: returnPolicy,
      paymentPolicy: paymentPolicy
    };

  } catch (error) {
    Logger.log('readClientPoliciesエラー: ' + error.toString());
    throw error;
  }
}
