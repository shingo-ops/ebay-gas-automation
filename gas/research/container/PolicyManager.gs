/**
 * eBayポリシー管理モジュール
 *
 * Fulfillment Policy (Shipping)、Return Policy、Payment Policyを取得・管理
 */

/**
 * eBay Account APIのベースURL取得
 *
 * @returns {string} Account API URL
 */
function getAccountApiUrl() {
  const config = getEbayConfig();
  const baseUrl = config.getApiEndpoint();
  return baseUrl + '/sell/account/v1';
}

/**
 * Fulfillment Policy（Shipping Policy）一覧を取得
 *
 * @returns {Array<Object>} ポリシー一覧 [{ policyId, name, description, marketplaceId }]
 */
function getFulfillmentPolicies() {
  try {
    const token = getOAuthToken();
    const apiUrl = getAccountApiUrl() + '/fulfillment_policy';

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
      throw new Error(
        '発送ポリシーの取得に失敗しました。\n\n' +
        '以下を確認してください:\n' +
        '1. eBay Seller Hubで発送ポリシーが設定されているか\n' +
        '2. ツール設定シートのeBay API設定が正しいか'
      );
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
        marketplaceId: policy.marketplaceId
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
    const token = getOAuthToken();
    const apiUrl = getAccountApiUrl() + '/return_policy';

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
      throw new Error(
        '返品ポリシーの取得に失敗しました。\n\n' +
        '以下を確認してください:\n' +
        '1. eBay Seller Hubで返品ポリシーが設定されているか\n' +
        '2. ツール設定シートのeBay API設定が正しいか'
      );
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
    const token = getOAuthToken();
    const apiUrl = getAccountApiUrl() + '/payment_policy';

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
      throw new Error(
        '支払いポリシーの取得に失敗しました。\n\n' +
        '以下を確認してください:\n' +
        '1. eBay Seller Hubで支払いポリシーが設定されているか\n' +
        '2. ツール設定シートのeBay API設定が正しいか'
      );
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
 * すべてのポリシーを取得して"Policy_設定"シートに出力
 */
function exportPoliciesToSheet() {
  try {
    Logger.log('=== ポリシー一覧取得開始 ===');

    // 各ポリシーを取得
    const fulfillmentPolicies = getFulfillmentPolicies();
    const returnPolicies = getReturnPolicies();
    const paymentPolicies = getPaymentPolicies();

    Logger.log('');
    Logger.log('--- 取得結果 ---');
    Logger.log('Fulfillment Policy: ' + fulfillmentPolicies.length + '件');
    Logger.log('Return Policy: ' + returnPolicies.length + '件');
    Logger.log('Payment Policy: ' + paymentPolicies.length + '件');

    // "Policy_設定"シートを取得または作成
    let policySheet = ss.getSheetByName('Policy_設定');
    if (!policySheet) {
      policySheet = ss.insertSheet('Policy_設定');
      Logger.log('✅ "Policy_設定"シートを作成しました');
    } else {
      policySheet.clear();
      Logger.log('✅ "Policy_設定"シートをクリアしました');
    }

    // ヘッダー行を作成
    const headers = [
      'ポリシータイプ',
      'ポリシー名',
      'ポリシーID',
      'マーケットプレイス',
      '説明'
    ];

    policySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    policySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    policySheet.setFrozenRows(1);

    // データを整形
    const rows = [];

    // Fulfillment Policy
    fulfillmentPolicies.forEach(function(policy) {
      rows.push([
        'Fulfillment (Shipping)',
        policy.name,
        policy.policyId,
        policy.marketplaceId,
        policy.description
      ]);
    });

    // Return Policy
    returnPolicies.forEach(function(policy) {
      rows.push([
        'Return',
        policy.name,
        policy.policyId,
        policy.marketplaceId,
        policy.description
      ]);
    });

    // Payment Policy
    paymentPolicies.forEach(function(policy) {
      rows.push([
        'Payment',
        policy.name,
        policy.policyId,
        policy.marketplaceId,
        policy.description
      ]);
    });

    // データを書き込み
    if (rows.length > 0) {
      policySheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      Logger.log('✅ ' + rows.length + '件のポリシーを出力しました');
    }

    // 列幅を自動調整
    policySheet.autoResizeColumns(1, headers.length);

    Logger.log('');
    Logger.log('=== 完了 ===');
    Logger.log('"Policy_設定"シートにポリシー一覧を出力しました');

    return {
      success: true,
      fulfillmentCount: fulfillmentPolicies.length,
      returnCount: returnPolicies.length,
      paymentCount: paymentPolicies.length,
      totalCount: rows.length
    };

  } catch (error) {
    Logger.log('');
    Logger.log('=== エラー ===');
    Logger.log(error.toString());
    throw error;
  }
}

/**
 * ポリシー名からポリシーIDを取得
 *
 * @param {string} policyName ポリシー名
 * @param {string} policyType ポリシータイプ ('Fulfillment', 'Return', 'Payment')
 * @returns {string} ポリシーID（見つからない場合は空文字列）
 */
function getPolicyIdByName(policyName, policyType) {
  try {
    if (!policyName || policyName.toString().trim() === '') {
      return '';
    }

    // Policy_設定シートから検索
    const policySheet = ss.getSheetByName('Policy_設定');
    if (!policySheet) {
      Logger.log('⚠️ "Policy_設定"シートが見つかりません。exportPoliciesToSheet()を先に実行してください。');
      return '';
    }

    const lastRow = policySheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('⚠️ "Policy_設定"シートにデータがありません。');
      return '';
    }

    // データを取得（A列: タイプ, B列: 名前, C列: ID）
    const data = policySheet.getRange(2, 1, lastRow - 1, 3).getValues();

    // ポリシータイプの正規化
    let searchType = '';
    if (policyType === 'Fulfillment' || policyType === 'Shipping') {
      searchType = 'Fulfillment (Shipping)';
    } else if (policyType === 'Return') {
      searchType = 'Return';
    } else if (policyType === 'Payment') {
      searchType = 'Payment';
    }

    // 名前で検索
    for (let i = 0; i < data.length; i++) {
      const rowType = data[i][0];
      const rowName = data[i][1];
      const rowId = data[i][2];

      if (rowType === searchType && rowName === policyName) {
        Logger.log('✅ ポリシーID取得: ' + policyName + ' → ' + rowId);
        return rowId;
      }
    }

    Logger.log('⚠️ ポリシーが見つかりません: ' + policyName + ' (' + policyType + ')');
    return '';

  } catch (error) {
    Logger.log('getPolicyIdByNameエラー: ' + error.toString());
    return '';
  }
}

/**
 * ポリシーAPI接続テスト
 */
function testPolicyApi() {
  try {
    Logger.log('=== ポリシーAPI接続テスト ===');
    Logger.log('');

    const result = exportPoliciesToSheet();

    Logger.log('');
    Logger.log('=== テスト結果 ===');
    Logger.log('✅ API接続成功');
    Logger.log('Fulfillment Policy: ' + result.fulfillmentCount + '件');
    Logger.log('Return Policy: ' + result.returnCount + '件');
    Logger.log('Payment Policy: ' + result.paymentCount + '件');
    Logger.log('合計: ' + result.totalCount + '件');

    return true;

  } catch (error) {
    Logger.log('');
    Logger.log('=== テスト失敗 ===');
    Logger.log('❌ ' + error.toString());
    return false;
  }
}
