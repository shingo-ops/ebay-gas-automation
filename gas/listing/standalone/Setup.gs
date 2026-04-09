/**
 * eBay出品管理 - 初回セットアップ
 *
 * 初回認証・設定確認用のスクリプト
 * 図形ボタンに割り当てて実行することで、必要な権限承認を取得します
 */

/**
 * 【初回セットアップ】
 * ライブラリ側のセットアップロジック（UI操作なし）
 *
 * 実行内容:
 * 1. 必要なシートの存在確認
 * 2. eBay API認証情報の検証
 * 3. eBay API接続テスト
 *
 * UI操作はバインドスクリプト側で行うこと
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Object} { success: boolean, steps: Array, error?: string }
 */
function setupEbayManager(spreadsheetId) {
  const steps = [];

  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const targetId = getTargetSpreadsheetId();

    Logger.log('=== eBay出品管理 - 初回セットアップ開始 ===');
    Logger.log('対象スプレッドシート: ' + targetId);

    // ステップ1: ツール設定シートの存在確認
    const settingsSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
    if (!settingsSheet) {
      Logger.log('❌ ツール設定シートが見つかりません');
      return {
        success: false,
        step: 'sheet_check',
        error: 'ツール設定シートが見つかりません',
        message: '❌ 「ツール設定」シートが見つかりません。\n\nシートを作成してから再度実行してください。'
      };
    }

    Logger.log('✅ ツール設定シート確認完了');
    steps.push({ step: 'sheet_check', success: true });

    // ステップ2: eBay API認証情報の検証
    const configResult = verifyEbayApiConfig(spreadsheetId);
    if (!configResult.success) {
      Logger.log('❌ eBay API認証情報が不足しています');
      return {
        success: false,
        step: 'config_verify',
        error: 'eBay API認証情報が不足しています',
        missingFields: configResult.missingFields,
        message: '❌ eBay API認証情報が不足しています:\n\n' +
                 configResult.missingFields.join('\n') + '\n\n' +
                 '「ツール設定」シートで設定してください。'
      };
    }

    Logger.log('✅ eBay API認証情報確認完了');
    steps.push({ step: 'config_verify', success: true });

    // ステップ3: eBay API接続テスト
    const connectionResult = testEbayConnection(spreadsheetId);
    if (!connectionResult.success) {
      Logger.log('❌ eBay API接続テスト失敗: ' + connectionResult.error);
      return {
        success: false,
        step: 'api_test',
        error: connectionResult.error,
        message: '❌ eBay API接続テストに失敗しました:\n\n' +
                 connectionResult.error + '\n\n' +
                 '認証情報を確認してください。'
      };
    }

    Logger.log('✅ eBay API接続テスト完了');
    steps.push({ step: 'api_test', success: true, policyCount: connectionResult.policyCount });

    Logger.log('=== 初回セットアップ完了 ===');

    return {
      success: true,
      steps: steps,
      message: '✅ 初回セットアップが完了しました\n\n' +
               '以降は以下の方法でツールを使用できます:\n\n' +
               '【図形ボタン】\n' +
               '- 📥 ポリシー取得\n' +
               '- 🔄 ポリシー更新\n\n' +
               '【カスタムメニュー】\n' +
               'スプレッドシートを再度開くと、\n' +
               '「eBay管理」メニューが表示されます。'
    };

  } catch (error) {
    Logger.log('❌ セットアップエラー: ' + error.toString());
    return {
      success: false,
      step: 'unknown',
      error: error.toString(),
      message: '❌ セットアップ中にエラーが発生しました:\n\n' + error.toString()
    };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * eBay API認証情報の検証
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Object} { success: boolean, missingFields: string[] }
 */
function verifyEbayApiConfig(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const config = getEbayConfig();
    const missingFields = [];

    // 必須項目のチェック
    if (!config.appId) {
      missingFields.push('- App ID（Client ID）');
    }
    if (!config.certId) {
      missingFields.push('- Cert ID（Client Secret）');
    }
    if (!config.devId) {
      missingFields.push('- Dev ID');
    }
    if (!config.userToken) {
      missingFields.push('- User Token');
    }

    if (missingFields.length > 0) {
      Logger.log('⚠️ 不足している認証情報:');
      missingFields.forEach(field => Logger.log(field));
      return {
        success: false,
        missingFields: missingFields
      };
    }

    Logger.log('✅ すべての認証情報が設定されています');
    return {
      success: true,
      missingFields: []
    };

  } catch (error) {
    Logger.log('❌ 認証情報検証エラー: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * eBay API接続テスト
 *
 * GetPolicies APIを呼び出して接続確認
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Object} { success: boolean, error?: string }
 */
function testEbayConnection(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    Logger.log('eBay API接続テスト開始...');

    // Fulfillment Policyを1件取得して接続確認
    const policies = getFulfillmentPolicies();

    if (!policies || !Array.isArray(policies)) {
      return {
        success: false,
        error: 'ポリシー取得に失敗しました。レスポンスが不正です。'
      };
    }

    Logger.log('✅ eBay API接続成功（Fulfillment Policy: ' + policies.length + '件）');

    return {
      success: true,
      policyCount: policies.length
    };

  } catch (error) {
    Logger.log('❌ eBay API接続エラー: ' + error.toString());

    // エラーメッセージから原因を特定
    let errorMessage = error.toString();
    if (errorMessage.includes('401')) {
      errorMessage = '認証エラー（401）: User Tokenが無効または期限切れです';
    } else if (errorMessage.includes('403')) {
      errorMessage = 'アクセス拒否（403）: App ID/Cert IDが無効です';
    } else if (errorMessage.includes('500')) {
      errorMessage = 'eBayサーバーエラー（500）: しばらく待ってから再試行してください';
    }

    return {
      success: false,
      error: errorMessage
    };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * ライブラリ情報の表示（テスト用）
 *
 * バインドスクリプトから呼び出される関数
 * ツール設定シートからライブラリ情報を読み込んで表示
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 */
function showLibraryInfo(spreadsheetId) {
  try {
    const info = getLibraryInfo(spreadsheetId);

    Logger.log('=== ライブラリ情報 ===');
    Logger.log('スクリプトID: ' + info.scriptId);
    Logger.log('識別子: ' + info.identifier);
    Logger.log('');
    Logger.log('【セットアップ手順】');
    Logger.log('1. Apps Scriptエディタで「ライブラリ」をクリック');
    Logger.log('2. 「ライブラリを追加」をクリック');
    Logger.log('3. スクリプトID: ' + info.scriptId);
    Logger.log('4. 識別子: ' + info.identifier);
    Logger.log('5. バージョン: Head');

    return info;

  } catch (error) {
    Logger.log('❌ ライブラリ情報取得エラー: ' + error.toString());
    throw error;
  }
}
