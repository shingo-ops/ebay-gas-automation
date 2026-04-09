/**
 * eBayポリシー同期管理モジュール
 *
 * スプレッドシートの変更をeBayに反映する機能
 */

/**
 * ポリシー管理シートの変更をeBayに同期
 *
 * 処理フロー:
 * 1. A列（操作）をチェック
 * 2. "-" または空欄 → スキップ（API呼び出しなし）
 * 3. "追加" → ポリシー作成 → IDを記入 → 操作を"-"に戻す
 * 4. "更新" → ポリシー更新 → 操作を"-"に戻す
 * 5. "削除" → ポリシー削除 → 行を削除
 * 6. 結果をシートに反映
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 */
function syncPoliciesToEbay(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    Logger.log('=== eBayポリシー同期開始 ===');
    Logger.log('対象スプレッドシート: ' + getTargetSpreadsheetId());
    Logger.log('');

    const policySheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.POLICY_SETTINGS);

    if (!policySheet) {
      throw new Error('"ポリシー管理"シートが見つかりません');
    }

    // データを取得（ヘッダー行を除く）
    const data = policySheet.getDataRange().getValues();
    const headers = data[0];

    // 列番号を確認（6列）
    const operationCol = POLICY_SHEET_COLUMNS.OPERATION - 1;
    const typeCol = POLICY_SHEET_COLUMNS.POLICY_TYPE - 1;
    const nameCol = POLICY_SHEET_COLUMNS.POLICY_NAME - 1;
    const idCol = POLICY_SHEET_COLUMNS.POLICY_ID - 1;
    const marketCol = POLICY_SHEET_COLUMNS.MARKETPLACE - 1;
    const descCol = POLICY_SHEET_COLUMNS.DESCRIPTION - 1;

    const results = {
      created: [],
      updated: [],
      deleted: [],
      skipped: 0,
      errors: []
    };

    // 2行目から処理（1行目はヘッダー）
    // 削除処理で行番号が変わるため、後ろから処理
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const rowNumber = i + 1; // スプレッドシートの行番号（1-indexed）

      const operation = row[operationCol];
      const policyType = row[typeCol];
      const policyName = row[nameCol];
      const policyId = row[idCol];
      const marketplace = row[marketCol];
      const description = row[descCol];

      // 空行をスキップ
      if (!policyType || !policyName) {
        continue;
      }

      // 操作を確認
      const op = (operation || '').toString().trim();

      try {
        if (op === '' || op === '-') {
          // スキップ（ログ出力なし、API呼び出しなし）
          results.skipped++;

        } else if (op === '追加') {
          // 新規作成
          Logger.log('--- 行' + rowNumber + ': 追加 - ' + policyName + ' ---');

          const newPolicyId = createPolicy(policyType, policyName, marketplace, description);

          // ポリシーIDを記入
          policySheet.getRange(rowNumber, POLICY_SHEET_COLUMNS.POLICY_ID).setValue(newPolicyId);
          // 操作を"-"に戻す
          policySheet.getRange(rowNumber, POLICY_SHEET_COLUMNS.OPERATION).setValue('-');

          Logger.log('✅ 作成完了: ' + policyName + ' (ID: ' + newPolicyId + ')');
          Logger.log('');

          results.created.push({
            row: rowNumber,
            name: policyName,
            id: newPolicyId
          });

        } else if (op === '更新') {
          // 更新
          Logger.log('--- 行' + rowNumber + ': 更新 - ' + policyName + ' ---');

          if (!policyId || policyId.toString().trim() === '') {
            throw new Error('ポリシーIDが空です。更新できません。');
          }

          updatePolicy(policyType, policyId, policyName, description);

          // 操作を"-"に戻す
          policySheet.getRange(rowNumber, POLICY_SHEET_COLUMNS.OPERATION).setValue('-');

          Logger.log('✅ 更新完了: ' + policyName);
          Logger.log('');

          results.updated.push({
            row: rowNumber,
            name: policyName,
            id: policyId
          });

        } else if (op === '削除') {
          // 削除
          Logger.log('--- 行' + rowNumber + ': 削除 - ' + policyName + ' ---');

          if (policyId && policyId.toString().trim() !== '') {
            // eBayからポリシーを削除
            deletePolicy(policyType, policyId);
          }

          // 行を削除
          policySheet.deleteRow(rowNumber);

          Logger.log('✅ 削除完了: ' + policyName);
          Logger.log('');

          results.deleted.push({
            row: rowNumber,
            name: policyName,
            id: policyId || '（eBay未登録）'
          });

        } else {
          // 不明な操作
          Logger.log('⚠️ 不明な操作（行' + rowNumber + '）: "' + op + '" - スキップ');
          results.skipped++;
        }

      } catch (error) {
        Logger.log('❌ エラー（行' + rowNumber + '）: ' + error.toString());
        Logger.log('');

        results.errors.push({
          row: rowNumber,
          name: policyName,
          error: error.toString()
        });
      }
    }

    // 結果サマリー
    Logger.log('=== 同期結果 ===');
    Logger.log('作成: ' + results.created.length + '件');
    Logger.log('更新: ' + results.updated.length + '件');
    Logger.log('削除: ' + results.deleted.length + '件');
    Logger.log('スキップ: ' + results.skipped + '件');
    Logger.log('エラー: ' + results.errors.length + '件');
    Logger.log('');

    if (results.created.length > 0) {
      Logger.log('【作成されたポリシー】');
      results.created.forEach(function(item) {
        Logger.log('- 行' + item.row + ': ' + item.name + ' (ID: ' + item.id + ')');
      });
      Logger.log('');
    }

    if (results.updated.length > 0) {
      Logger.log('【更新されたポリシー】');
      results.updated.forEach(function(item) {
        Logger.log('- 行' + item.row + ': ' + item.name + ' (ID: ' + item.id + ')');
      });
      Logger.log('');
    }

    if (results.deleted.length > 0) {
      Logger.log('【削除されたポリシー】');
      results.deleted.forEach(function(item) {
        Logger.log('- 行' + item.row + ': ' + item.name + ' (ID: ' + item.id + ')');
      });
      Logger.log('');
    }

    if (results.errors.length > 0) {
      Logger.log('【エラー詳細】');
      results.errors.forEach(function(err) {
        Logger.log('- 行' + err.row + ' (' + err.name + '): ' + err.error);
      });
      Logger.log('');
    }

    Logger.log('=== 同期完了 ===');

    return results;

  } catch (error) {
    Logger.log('❌ 同期エラー: ' + error.toString());
    throw error;
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * ポリシー作成（基本実装）
 *
 * @param {string} policyType ポリシータイプ
 * @param {string} name ポリシー名
 * @param {string} marketplace マーケットプレイス
 * @param {string} description 説明
 * @returns {string} 作成されたポリシーID
 */
function createPolicy(policyType, name, marketplace, description) {
  try {
    Logger.log('ポリシー作成API呼び出し: ' + name);

    // ポリシータイプに応じて適切なAPI呼び出し
    if (policyType === 'Fulfillment Policy') {
      return createFulfillmentPolicy(name, marketplace, description);
    } else if (policyType === 'Return Policy') {
      return createReturnPolicy(name, marketplace, description);
    } else if (policyType === 'Payment Policy') {
      return createPaymentPolicy(name, marketplace, description);
    } else {
      throw new Error('不明なポリシータイプ: ' + policyType);
    }

  } catch (error) {
    Logger.log('createPolicyエラー: ' + error.toString());
    throw error;
  }
}

/**
 * Fulfillment Policy作成
 *
 * @param {string} name ポリシー名
 * @param {string} marketplace マーケットプレイス
 * @param {string} description 説明
 * @returns {string} ポリシーID
 */
function createFulfillmentPolicy(name, marketplace, description) {
  try {
    const token = getUserToken();
    const config = getEbayConfig();
    const apiUrl = config.getAccountApiUrl() + '/fulfillment_policy';

    // 最小限のポリシー設定（デフォルト値）
    const policyData = {
      name: name,
      description: description || '',
      marketplaceId: marketplace || 'EBAY_US',
      categoryTypes: [
        {
          name: 'ALL_EXCLUDING_MOTORS_VEHICLES'
        }
      ],
      handlingTime: {
        value: 1,
        unit: 'DAY'
      },
      shippingOptions: [
        {
          optionType: 'DOMESTIC',
          costType: 'FLAT_RATE',
          shippingServices: [
            {
              shippingServiceCode: 'USPSPriority',
              freeShipping: false,
              shippingCost: {
                value: '0.00',
                currency: 'USD'
              }
            }
          ]
        }
      ],
      shipToLocations: {
        regionIncluded: [
          {
            regionName: 'US'
          }
        ]
      }
    };

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(policyData),
      muteHttpExceptions: true
    };

    Logger.log('Fulfillment Policy作成API呼び出し: ' + apiUrl);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 201 && statusCode !== 200) {
      Logger.log('APIエラー: ' + statusCode + ' - ' + responseText);
      throw new Error('Fulfillment Policy作成失敗(' + statusCode + '): ' + responseText);
    }

    const result = JSON.parse(responseText);
    const policyId = result.fulfillmentPolicyId;

    Logger.log('✅ Fulfillment Policy作成成功: ' + policyId);

    return policyId;

  } catch (error) {
    Logger.log('createFulfillmentPolicyエラー: ' + error.toString());
    throw error;
  }
}

/**
 * Return Policy作成（プレースホルダー）
 */
function createReturnPolicy(name, marketplace, description) {
  throw new Error('Return Policy作成は未実装です');
}

/**
 * Payment Policy作成（プレースホルダー）
 */
function createPaymentPolicy(name, marketplace, description) {
  throw new Error('Payment Policy作成は未実装です');
}

/**
 * ポリシー更新
 *
 * @param {string} policyType ポリシータイプ
 * @param {string} policyId ポリシーID
 * @param {string} name ポリシー名
 * @param {string} description 説明
 */
function updatePolicy(policyType, policyId, name, description) {
  try {
    Logger.log('ポリシー更新API呼び出し: ' + policyId);

    // ポリシータイプに応じて適切なAPI呼び出し
    if (policyType === 'Fulfillment Policy') {
      updateFulfillmentPolicy(policyId, name, description);
    } else if (policyType === 'Return Policy') {
      updateReturnPolicy(policyId, name, description);
    } else if (policyType === 'Payment Policy') {
      updatePaymentPolicy(policyId, name, description);
    } else {
      throw new Error('不明なポリシータイプ: ' + policyType);
    }

  } catch (error) {
    Logger.log('updatePolicyエラー: ' + error.toString());
    throw error;
  }
}

/**
 * Fulfillment Policy更新（プレースホルダー）
 */
function updateFulfillmentPolicy(policyId, name, description) {
  // 現在の仕様を取得 → 変更 → PUT
  // 実装が複雑なため、現時点では未実装
  Logger.log('⚠️ Fulfillment Policy更新: ' + policyId + ' - 実装予定');
  // throw new Error('Fulfillment Policy更新は未実装です');
}

/**
 * Return Policy更新（プレースホルダー）
 */
function updateReturnPolicy(policyId, name, description) {
  throw new Error('Return Policy更新は未実装です');
}

/**
 * Payment Policy更新（プレースホルダー）
 */
function updatePaymentPolicy(policyId, name, description) {
  throw new Error('Payment Policy更新は未実装です');
}

/**
 * ポリシー削除
 *
 * @param {string} policyType ポリシータイプ
 * @param {string} policyId ポリシーID
 */
function deletePolicy(policyType, policyId) {
  try {
    Logger.log('ポリシー削除API呼び出し: ' + policyId);

    const token = getUserToken();
    const config = getEbayConfig();

    let apiUrl = '';
    if (policyType === 'Fulfillment Policy') {
      apiUrl = config.getAccountApiUrl() + '/fulfillment_policy/' + policyId;
    } else if (policyType === 'Return Policy') {
      apiUrl = config.getAccountApiUrl() + '/return_policy/' + policyId;
    } else if (policyType === 'Payment Policy') {
      apiUrl = config.getAccountApiUrl() + '/payment_policy/' + policyId;
    } else {
      throw new Error('不明なポリシータイプ: ' + policyType);
    }

    const options = {
      method: 'delete',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      muteHttpExceptions: true
    };

    Logger.log('DELETE: ' + apiUrl);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 204 && statusCode !== 200) {
      const responseText = response.getContentText();
      Logger.log('APIエラー: ' + statusCode + ' - ' + responseText);
      throw new Error('ポリシー削除失敗(' + statusCode + '): ' + responseText);
    }

    Logger.log('✅ ポリシー削除成功: ' + policyId);

  } catch (error) {
    Logger.log('deletePolicyエラー: ' + error.toString());
    throw error;
  }
}
