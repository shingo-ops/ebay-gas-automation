/**
 * eBayポリシー管理モジュール
 *
 * Fulfillment Policy (Shipping)、Return Policy、Payment Policyを取得・管理
 */

/**
 * Fulfillment Policy（Shipping Policy）一覧を取得
 *
 * @returns {Array<Object>} ポリシー一覧 [{ policyId, name, description, marketplaceId }]
 */
function getFulfillmentPolicies() {
  try {
    const token = getUserToken();
    const config = getEbayConfig();
    // marketplace_idパラメータを追加（EBAY_US = アメリカ）
    const apiUrl = config.getAccountApiUrl() + '/fulfillment_policy?marketplace_id=EBAY_US';

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    Logger.log('Fulfillment Policy API呼び出し: ' + apiUrl);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log('APIエラー: ' + statusCode + ' - ' + responseText);
      throw new Error('Fulfillment Policy取得失敗(' + statusCode + '): ' + responseText);
    }

    const data = JSON.parse(responseText);
    const policies = data.fulfillmentPolicies || [];

    Logger.log('✅ Fulfillment Policy取得: ' + policies.length + '件');

    // 必要な情報のみ抽出
    return policies.map(function(policy) {
      return {
        policyId: policy.fulfillmentPolicyId,
        name: policy.name,
        description: policy.description || '',
        marketplaceId: policy.marketplaceId,
        // 詳細情報も保持
        rawData: policy
      };
    });

  } catch (error) {
    Logger.log('getFulfillmentPoliciesエラー: ' + error.toString());
    throw error;
  }
}

/**
 * Return Policy一覧を取得
 *
 * @returns {Array<Object>} ポリシー一覧 [{ policyId, name, description, marketplaceId }]
 */
function getReturnPolicies() {
  try {
    const token = getUserToken();
    const config = getEbayConfig();
    // marketplace_idパラメータを追加（EBAY_US = アメリカ）
    const apiUrl = config.getAccountApiUrl() + '/return_policy?marketplace_id=EBAY_US';

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    Logger.log('Return Policy API呼び出し: ' + apiUrl);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log('APIエラー: ' + statusCode + ' - ' + responseText);
      throw new Error('Return Policy取得失敗(' + statusCode + '): ' + responseText);
    }

    const data = JSON.parse(responseText);
    const policies = data.returnPolicies || [];

    Logger.log('✅ Return Policy取得: ' + policies.length + '件');

    return policies.map(function(policy) {
      return {
        policyId: policy.returnPolicyId,
        name: policy.name,
        description: policy.description || '',
        marketplaceId: policy.marketplaceId
      };
    });

  } catch (error) {
    Logger.log('getReturnPoliciesエラー: ' + error.toString());
    throw error;
  }
}

/**
 * Payment Policy一覧を取得
 *
 * @returns {Array<Object>} ポリシー一覧 [{ policyId, name, description, marketplaceId }]
 */
function getPaymentPolicies() {
  try {
    const token = getUserToken();
    const config = getEbayConfig();
    // marketplace_idパラメータを追加（EBAY_US = アメリカ）
    const apiUrl = config.getAccountApiUrl() + '/payment_policy?marketplace_id=EBAY_US';

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    Logger.log('Payment Policy API呼び出し: ' + apiUrl);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log('APIエラー: ' + statusCode + ' - ' + responseText);
      throw new Error('Payment Policy取得失敗(' + statusCode + '): ' + responseText);
    }

    const data = JSON.parse(responseText);
    const policies = data.paymentPolicies || [];

    Logger.log('✅ Payment Policy取得: ' + policies.length + '件');

    return policies.map(function(policy) {
      return {
        policyId: policy.paymentPolicyId,
        name: policy.name,
        description: policy.description || '',
        marketplaceId: policy.marketplaceId
      };
    });

  } catch (error) {
    Logger.log('getPaymentPoliciesエラー: ' + error.toString());
    throw error;
  }
}

/**
 * 全ポリシーを"Policy_設定"シートに出力
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 */
function exportPoliciesToSheet(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    Logger.log('=== ポリシー取得開始 ===');
    Logger.log('対象スプレッドシート: ' + getTargetSpreadsheetId());

    // 各ポリシーを取得
    const fulfillmentPolicies = getFulfillmentPolicies();
    const returnPolicies = getReturnPolicies();
    const paymentPolicies = getPaymentPolicies();

    Logger.log('');
    Logger.log('取得結果:');
    Logger.log('- Fulfillment Policy: ' + fulfillmentPolicies.length + '件');
    Logger.log('- Return Policy: ' + returnPolicies.length + '件');
    Logger.log('- Payment Policy: ' + paymentPolicies.length + '件');
    Logger.log('');

    // "Policy_設定"シートを取得または作成
    const targetSpreadsheet = getTargetSpreadsheet();
    let policySheet = targetSpreadsheet.getSheetByName(SHEET_NAMES.POLICY_SETTINGS);

    // ヘッダー定義を取得
    const headers = getPolicySheetHeaders();

    if (!policySheet) {
      Logger.log('"Policy_設定"シートを作成します');
      policySheet = targetSpreadsheet.insertSheet(SHEET_NAMES.POLICY_SETTINGS);

      // ヘッダー行を作成（新規シートのみ）
      policySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      policySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

      Logger.log('ヘッダー行を作成しました');
    } else {
      Logger.log('既存の"ポリシー管理"シートを使用します');

      // 既存シートの場合、2行目以降のみクリア（ヘッダー・書式・データ検証を保持）
      const lastRow = policySheet.getLastRow();
      if (lastRow > 1) {
        // 2行目から最終行までデータのみクリア
        // clearContent()はデータのみクリア、書式・データ検証は自動的に保持される
        const dataRange = policySheet.getRange(2, 1, lastRow - 1, policySheet.getLastColumn());
        dataRange.clearContent();
        Logger.log('2行目以降のデータをクリアしました（書式・データ検証保持）');
      }

      // ヘッダーが存在するか確認（念のため）
      const existingHeaders = policySheet.getRange(1, 1, 1, headers.length).getValues()[0];
      const headersMatch = existingHeaders.every(function(val, index) {
        return val === headers[index];
      });

      if (!headersMatch) {
        Logger.log('⚠️ ヘッダーが定義と異なります。更新します。');
        policySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        policySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
    }

    // データ行を作成（デフォルト操作は"-"）
    const rows = [];

    // Fulfillment Policy
    fulfillmentPolicies.forEach(function(policy) {
      rows.push([
        '-',  // デフォルト: 操作不要
        'Fulfillment Policy',
        policy.name,
        policy.policyId,
        policy.marketplaceId,
        policy.description
      ]);
    });

    // Return Policy
    returnPolicies.forEach(function(policy) {
      rows.push([
        '-',  // デフォルト: 操作不要
        'Return Policy',
        policy.name,
        policy.policyId,
        policy.marketplaceId,
        policy.description
      ]);
    });

    // Payment Policy
    paymentPolicies.forEach(function(policy) {
      rows.push([
        '-',  // デフォルト: 操作不要
        'Payment Policy',
        policy.name,
        policy.policyId,
        policy.marketplaceId,
        policy.description
      ]);
    });

    // データを書き込み（2行目から開始）
    if (rows.length > 0) {
      const dataRange = policySheet.getRange(2, 1, rows.length, headers.length);

      // データを書き込み
      // setValues()はデータのみ書き込み、既存のデータ検証（プルダウン）は保持される
      dataRange.setValues(rows);
      Logger.log('データを2行目から書き込みました（' + rows.length + '行）');
      Logger.log('✅ プルダウン設定（データ入力規則）は自動的に保持されます');
      Logger.log('✅ 列幅は既存の設定が保持されます');
    }

    Logger.log('');
    Logger.log('✅ "Policy_設定"シートに出力完了');
    Logger.log('総ポリシー数: ' + rows.length + '件');
    Logger.log('');
    Logger.log('=== 取得完了 ===');
    Logger.log('- Fulfillment Policy: ' + fulfillmentPolicies.length + '件');
    Logger.log('- Return Policy: ' + returnPolicies.length + '件');
    Logger.log('- Payment Policy: ' + paymentPolicies.length + '件');

    return {
      success: true,
      totalCount: rows.length,
      fulfillmentCount: fulfillmentPolicies.length,
      returnCount: returnPolicies.length,
      paymentCount: paymentPolicies.length
    };

  } catch (error) {
    Logger.log('❌ エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ポリシー名からポリシーIDを取得
 *
 * @param {string} policyName ポリシー名
 * @param {string} policyType ポリシータイプ（'Fulfillment Policy', 'Return Policy', 'Payment Policy'）
 * @returns {string|null} ポリシーID、見つからない場合はnull
 */
function getPolicyIdByName(policyName, policyType) {
  try {
    const policySheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.POLICY_SETTINGS);

    if (!policySheet) {
      Logger.log('⚠️ "Policy_設定"シートが見つかりません。exportPoliciesToSheet()を先に実行してください。');
      return null;
    }

    const data = policySheet.getDataRange().getValues();

    // ヘッダー行をスキップして検索
    for (let i = 1; i < data.length; i++) {
      const rowPolicyType = data[i][0];
      const rowPolicyName = data[i][1];
      const rowPolicyId = data[i][2];

      if (rowPolicyType === policyType && rowPolicyName === policyName) {
        Logger.log('ポリシーID検索: ' + policyName + ' → ' + rowPolicyId);
        return rowPolicyId;
      }
    }

    Logger.log('⚠️ ポリシーが見つかりません: ' + policyType + ' - ' + policyName);
    return null;

  } catch (error) {
    Logger.log('getPolicyIdByNameエラー: ' + error.toString());
    return null;
  }
}

/**
 * 発送ポリシーの詳細情報を取得
 *
 * @param {string} policyId ポリシーID
 * @returns {Object} 詳細情報
 */
function getFulfillmentPolicyDetails(policyId) {
  try {
    const token = getUserToken();
    const config = getEbayConfig();
    const apiUrl = config.getAccountApiUrl() + '/fulfillment_policy/' + policyId;

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    Logger.log('Fulfillment Policy詳細取得: ' + apiUrl);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log('APIエラー: ' + statusCode + ' - ' + responseText);
      throw new Error('Fulfillment Policy詳細取得失敗(' + statusCode + '): ' + responseText);
    }

    const policy = JSON.parse(responseText);

    // 詳細情報を抽出
    const details = {
      policyId: policy.fulfillmentPolicyId,
      name: policy.name,
      description: policy.description || '',
      marketplaceId: policy.marketplaceId,
      categoryTypes: policy.categoryTypes || [],

      // 処理時間
      handlingTime: policy.handlingTime ? policy.handlingTime.value + ' ' + policy.handlingTime.unit : '',

      // 配送オプション
      shippingOptions: [],

      // 配送先
      shipToLocations: policy.shipToLocations ? policy.shipToLocations.regionIncluded : [],

      // 国際配送
      globalShipping: policy.globalShipping || false,

      // 発送元
      pickupDropOff: policy.pickupDropOff || false,

      // フリーシッピング
      freightShipping: policy.freightShipping || false
    };

    // 配送オプションの詳細を抽出
    if (policy.shippingOptions && policy.shippingOptions.length > 0) {
      policy.shippingOptions.forEach(function(option) {
        const shippingService = option.shippingServices && option.shippingServices.length > 0
          ? option.shippingServices[0]
          : null;

        if (shippingService) {
          details.shippingOptions.push({
            optionType: option.optionType,
            costType: option.costType,
            serviceName: shippingService.shippingServiceCode || '',
            shippingCost: shippingService.shippingCost
              ? shippingService.shippingCost.value + ' ' + shippingService.shippingCost.currency
              : '0',
            additionalCost: shippingService.additionalShippingCost
              ? shippingService.additionalShippingCost.value + ' ' + shippingService.additionalShippingCost.currency
              : '0',
            freeShipping: shippingService.freeShipping || false,
            buyerResponsibleForShipping: shippingService.buyerResponsibleForShipping || false
          });
        }
      });
    }

    Logger.log('✅ Fulfillment Policy詳細取得成功');
    Logger.log('配送オプション数: ' + details.shippingOptions.length);

    return details;

  } catch (error) {
    Logger.log('getFulfillmentPolicyDetailsエラー: ' + error.toString());
    throw error;
  }
}

/**
 * 発送ポリシーの詳細をログ出力（デバッグ用）
 *
 * @param {string} policyId ポリシーID
 */
function logFulfillmentPolicyDetails(policyId) {
  try {
    const details = getFulfillmentPolicyDetails(policyId);

    Logger.log('=== Fulfillment Policy詳細 ===');
    Logger.log('ポリシー名: ' + details.name);
    Logger.log('ポリシーID: ' + details.policyId);
    Logger.log('マーケットプレイス: ' + details.marketplaceId);
    Logger.log('説明: ' + details.description);
    Logger.log('処理時間: ' + details.handlingTime);
    Logger.log('配送先: ' + details.shipToLocations.join(', '));
    Logger.log('国際配送: ' + (details.globalShipping ? 'あり' : 'なし'));
    Logger.log('');
    Logger.log('【配送オプション】');

    details.shippingOptions.forEach(function(option, index) {
      Logger.log('--- オプション' + (index + 1) + ' ---');
      Logger.log('タイプ: ' + option.optionType);
      Logger.log('サービス: ' + option.serviceName);
      Logger.log('送料: ' + option.shippingCost);
      Logger.log('追加送料: ' + option.additionalCost);
      Logger.log('送料無料: ' + (option.freeShipping ? 'はい' : 'いいえ'));
      Logger.log('');
    });

    return details;

  } catch (error) {
    Logger.log('❌ エラー: ' + error.toString());
    throw error;
  }
}

/**
 * プルダウン設定（データ検証）を新規行に適用
 *
 * @param {Sheet} sheet シートオブジェクト
 * @param {number} templateRow テンプレート行番号（通常は2行目）
 * @param {number} targetStartRow 適用開始行番号
 * @param {number} targetEndRow 適用終了行番号
 */
function applyDataValidationsToNewRows(sheet, templateRow, targetStartRow, targetEndRow) {
  try {
    if (targetStartRow > targetEndRow) {
      return; // 適用する行がない
    }

    const numCols = sheet.getLastColumn();

    // テンプレート行（通常は2行目）のデータ検証を取得
    const templateValidations = sheet.getRange(templateRow, 1, 1, numCols).getDataValidations()[0];

    // データ検証が存在しない場合は何もしない
    if (!templateValidations || templateValidations.length === 0) {
      Logger.log('テンプレート行にデータ検証が存在しないため、スキップします');
      return;
    }

    // 新規行にデータ検証を適用
    const numRows = targetEndRow - targetStartRow + 1;
    const validationsToApply = [];

    for (let i = 0; i < numRows; i++) {
      validationsToApply.push(templateValidations);
    }

    sheet.getRange(targetStartRow, 1, numRows, numCols).setDataValidations(validationsToApply);
    Logger.log('行' + targetStartRow + '～' + targetEndRow + 'にデータ検証（プルダウン設定）を適用しました');

  } catch (error) {
    Logger.log('⚠️ データ検証適用エラー（無視して続行）: ' + error.toString());
    // エラーが発生しても処理を続行
  }
}
