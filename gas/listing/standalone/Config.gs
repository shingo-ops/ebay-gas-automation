/**
 * eBay出品管理 - 設定管理（スタンドアロン版）
 */

/**
 * グローバル変数: 実行中の対象スプレッドシートID
 * 関数実行時にパラメータで指定されたIDを保持
 */
var CURRENT_SPREADSHEET_ID = null;

/**
 * ライブラリのスクリプトID（フォールバック用）
 *
 * 本来は「ツール設定」シートから読み込みますが、
 * シートが存在しない場合のフォールバックとして定義
 */
const LIBRARY_SCRIPT_ID_FALLBACK = '13B_QVLCmt-KuxsyytDsS-2Ca6S_PLyNb-ZlEVbpg0T5-vEvM3otTLn1Y';
const LIBRARY_IDENTIFIER_FALLBACK = 'EbayLib';

/**
 * スプレッドシートIDを取得
 *
 * 優先順位:
 * 1. 関数実行時に引数で渡されたID（CURRENT_SPREADSHEET_ID）
 * 2. スクリプトプロパティに保存されたデフォルトID
 *
 * @returns {string} スプレッドシートID
 */
function getTargetSpreadsheetId() {
  // 1. 実行時に引数で指定されたIDを優先
  if (CURRENT_SPREADSHEET_ID) {
    Logger.log('実行時引数のスプレッドシートIDを使用: ' + CURRENT_SPREADSHEET_ID);
    return CURRENT_SPREADSHEET_ID;
  }

  // 2. スクリプトプロパティからデフォルトIDを取得
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty('DEFAULT_SPREADSHEET_ID');

  if (!spreadsheetId) {
    throw new Error('スプレッドシートIDが指定されていません。関数実行時に引数で渡すか、setDefaultSpreadsheetId()でデフォルトIDを設定してください。');
  }

  Logger.log('デフォルトスプレッドシートIDを使用: ' + spreadsheetId);
  return spreadsheetId;
}

/**
 * デフォルトのスプレッドシートIDを設定
 *
 * @param {string} spreadsheetId スプレッドシートID
 */
function setDefaultSpreadsheetId(spreadsheetId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('DEFAULT_SPREADSHEET_ID', spreadsheetId);
  Logger.log('✅ デフォルトスプレッドシートIDを設定: ' + spreadsheetId);
  return '設定完了: ' + spreadsheetId;
}

/**
 * ライブラリのスクリプトIDを取得
 *
 * 「ツール設定」シートから読み込み、見つからない場合はフォールバック値を使用
 * バインドスクリプトからこの関数を呼び出して、
 * セットアップ手順でスクリプトIDを表示するために使用
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Object} { scriptId: string, identifier: string }
 */
function getLibraryInfo(spreadsheetId) {
  try {
    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const settingsSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);

    if (!settingsSheet) {
      // シートが存在しない場合、フォールバック値を返す
      Logger.log('⚠️ ツール設定シートが見つかりません。フォールバック値を使用します。');
      return {
        scriptId: LIBRARY_SCRIPT_ID_FALLBACK,
        identifier: LIBRARY_IDENTIFIER_FALLBACK
      };
    }

    // A列:項目名、B列:値 の形式で読み込み
    const data = settingsSheet.getDataRange().getValues();

    let scriptId = null;
    let identifier = null;

    for (let i = 0; i < data.length; i++) {
      const key = data[i][0];   // A列: 項目名
      const value = data[i][1]; // B列: 値

      if (key === 'ライブラリスクリプトID') {
        scriptId = value;
      } else if (key === 'ライブラリ識別子') {
        identifier = value;
      }
    }

    // シートから取得できた場合
    if (scriptId && identifier) {
      Logger.log('✅ ツール設定シートからライブラリ情報を取得しました');
      return {
        scriptId: scriptId,
        identifier: identifier
      };
    }

    // シートに項目がない場合、フォールバック
    Logger.log('⚠️ ツール設定シートにライブラリ情報が見つかりません。フォールバック値を使用します。');
    return {
      scriptId: LIBRARY_SCRIPT_ID_FALLBACK,
      identifier: LIBRARY_IDENTIFIER_FALLBACK
    };

  } catch (error) {
    Logger.log('⚠️ ライブラリ情報取得エラー: ' + error.toString());
    // エラー時もフォールバック
    return {
      scriptId: LIBRARY_SCRIPT_ID_FALLBACK,
      identifier: LIBRARY_IDENTIFIER_FALLBACK
    };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 出品シートを取得
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Spreadsheet} スプレッドシートオブジェクト
 */
function getTargetSpreadsheet(spreadsheetId) {
  // 引数で指定された場合はグローバル変数に保存
  if (spreadsheetId) {
    CURRENT_SPREADSHEET_ID = spreadsheetId;
  }

  const targetId = getTargetSpreadsheetId();
  return SpreadsheetApp.openById(targetId);
}

/**
 * シート名定義
 */
const SHEET_NAMES = {
  LISTING: 'メイン',
  SETTINGS: 'ツール設定',
  POLICY_SETTINGS: 'ポリシー管理'
};

/**
 * ポリシー管理シートのヘッダー定義
 *
 * この定義を変更することで、出力される列をカスタマイズできます
 */
const POLICY_SHEET_HEADERS = {
  OPERATION: '操作',
  POLICY_TYPE: 'ポリシータイプ',
  POLICY_NAME: 'ポリシー名',
  POLICY_ID: 'ポリシーID',
  MARKETPLACE: 'マーケットプレイス',
  DESCRIPTION: '説明'
};

/**
 * ポリシー管理シートのヘッダー配列を取得
 *
 * @returns {Array<string>} ヘッダー名の配列
 */
function getPolicySheetHeaders() {
  return [
    POLICY_SHEET_HEADERS.OPERATION,
    POLICY_SHEET_HEADERS.POLICY_TYPE,
    POLICY_SHEET_HEADERS.POLICY_NAME,
    POLICY_SHEET_HEADERS.POLICY_ID,
    POLICY_SHEET_HEADERS.MARKETPLACE,
    POLICY_SHEET_HEADERS.DESCRIPTION
  ];
}

/**
 * ポリシー管理シートの列番号定義
 */
const POLICY_SHEET_COLUMNS = {
  OPERATION: 1,        // A列 - プルダウンあり (-, 追加, 更新, 削除)
  POLICY_TYPE: 2,      // B列 - プルダウンあり (Fulfillment Policy, Return Policy, Payment Policy)
  POLICY_NAME: 3,      // C列
  POLICY_ID: 4,        // D列
  MARKETPLACE: 5,      // E列 - プルダウンあり (EBAY_US等)
  DESCRIPTION: 6       // F列
};

/**
 * "ツール設定"シートから設定を取得
 *
 * 項目名ベースのマッピング:
 * - 1行目: ヘッダー行（"項目", "値"）をスキップ
 * - 2行目以降: A列の項目名でマッピング、B列の値を取得
 * - 列や行の順序が変わっても正しく取得できる
 *
 * @returns {Object} 設定オブジェクト { 'App ID': '...', 'User Token': '...', ... }
 */
function getConfig() {
  const settingsSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);

  if (!settingsSheet) {
    throw new Error(`「${SHEET_NAMES.SETTINGS}」シートが見つかりません`);
  }

  // A列:項目名、B列:値
  const data = settingsSheet.getDataRange().getValues();

  const config = {};

  // 1行目から開始（0-indexed）
  for (let i = 0; i < data.length; i++) {
    const key = data[i][0];   // A列: 項目名
    const value = data[i][1]; // B列: 値

    // ヘッダー行をスキップ（"項目"というキーは設定として扱わない）
    if (key === '項目' || key === 'Item' || key === 'Key') {
      Logger.log('ヘッダー行をスキップ: ' + key);
      continue;
    }

    if (key) {
      // User Token, Refresh Token, Token Expiry, RuNameは値が空でも設定に含める
      if (key === 'User Token' || key === 'Refresh Token' || key === 'Token Expiry' || key === 'RuName') {
        config[key] = value || '';
        // Refresh Tokenは機密情報なので一部のみ表示
        if (key === 'Refresh Token' && value) {
          Logger.log('設定取得: ' + key + ' = ' + value.substring(0, 20) + '...');
        } else {
          Logger.log('設定取得: ' + key + ' = ' + (value || '（空）'));
        }
      } else if (value) {
        config[key] = value;
        // 機密情報は一部だけ表示
        if (key === 'App ID' || key === 'Cert ID' || key === 'Dev ID') {
          Logger.log('設定取得: ' + key + ' = ' + value.substring(0, 20) + '...');
        } else {
          Logger.log('設定取得: ' + key + ' = ' + value);
        }
      }
    }
  }

  return config;
}

/**
 * スプレッドシートURLからIDを抽出
 *
 * @param {string} urlOrId URL または ID
 * @returns {string} スプレッドシートID
 */
function extractSpreadsheetId(urlOrId) {
  if (!urlOrId) {
    return '';
  }

  // すでにIDの場合（URLでない場合）はそのまま返す
  if (urlOrId.indexOf('/') === -1 && urlOrId.indexOf('https') === -1) {
    return urlOrId;
  }

  // URLからIDを抽出
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : '';
}

/**
 * eBay設定を取得
 *
 * @returns {Object} eBay設定
 */
function getEbayConfig() {
  const config = getConfig();

  return {
    appId: config['App ID'] || '',
    certId: config['Cert ID'] || '',
    devId: config['Dev ID'] || '',
    userToken: config['User Token'] || '',
    refreshToken: config['Refresh Token'] || '',
    tokenExpiry: config['Token Expiry'] || '',
    ruName: config['RuName'] || '',
    categoryMasterSpreadsheetId: extractSpreadsheetId(config['カテゴリマスタ']) || '',

    // eBay APIエンドポイント（本番環境）
    getApiEndpoint: function() {
      return 'https://api.ebay.com';
    },

    // Account APIエンドポイント
    getAccountApiUrl: function() {
      return this.getApiEndpoint() + '/sell/account/v1';
    }
  };
}

/**
 * User Tokenを取得（"ツール設定"シートから）
 *
 * @returns {string} User Token
 */
function getUserToken() {
  const config = getEbayConfig();

  if (!config.userToken || config.userToken.trim() === '') {
    throw new Error('User Tokenが設定されていません。"ツール設定"シートのUser Token行に値を設定してください。');
  }

  return config.userToken;
}

/**
 * 出品シートのヘッダーマッピングを構築
 *
 * @returns {Object} ヘッダー名→列番号のマッピング
 */
function buildHeaderMapping() {
  const listingSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.LISTING);

  if (!listingSheet) {
    throw new Error('「' + SHEET_NAMES.LISTING + '」シートが見つかりません');
  }

  const headerRow = 3; // ヘッダーは3行目
  const lastCol = listingSheet.getLastColumn();
  const headers = listingSheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];

  const mapping = {};

  for (let i = 0; i < headers.length; i++) {
    const headerName = headers[i];
    if (headerName) {
      mapping[headerName] = i + 1; // 列番号は1-based
    }
  }

  return mapping;
}

/**
 * ヘッダー名から列番号を取得
 *
 * @param {Object} headerMapping buildHeaderMapping()で作成したマッピング
 * @param {string} headerName ヘッダー名
 * @returns {number|null} 列番号（1-based）、見つからない場合はnull
 */
function getColumnByHeader(headerMapping, headerName) {
  return headerMapping[headerName] || null;
}

// ============================================================
// クライアント管理（完全手動 - GUIでスクリプトプロパティを作成）
// ============================================================

/**
 * 【重要】クライアント管理は完全手動で行います
 *
 * ## PropertiesServiceに保存する内容
 *
 * **設計原則:** スプレッドシートIDのみ保存
 * - eBay API認証情報（App ID、User Token等）は各クライアントの"ツール設定"シートに保存
 * - クライアント名などの追加情報は不要
 *
 * ## セットアップ手順（初回のみ）
 *
 * 1. Apps Scriptエディタを開く
 * 2. 左サイドバーの⚙️（歯車アイコン）をクリック
 * 3. 「プロパティを追加」ボタンをクリック
 * 4. プロパティ名: CLIENTS
 * 5. 値（JSON形式 - スプレッドシートIDのみ）:
 *    {"CLIENT_A":"1gGoJSu-ckMllYWuFCoERGVIPBDGvpVVRHDStx58MEgQ"}
 * 6. 保存
 *
 * ## 新規クライアント追加（運用時）
 *
 * 1. Apps Scriptエディタでスクリプトプロパティを開く
 * 2. CLIENTSプロパティを編集
 * 3. 新しいクライアントをJSONに追加:
 *    {"CLIENT_A":"1gGoJSu-ckMllYWuFCoERGVIPBDGvpVVRHDStx58MEgQ","CLIENT_B":"1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4"}
 * 4. 保存
 *
 * ## データ配置の原則
 *
 * | 保存場所 | 保存内容 | 管理者 |
 * |---------|---------|--------|
 * | **PropertiesService** | スプレッドシートIDのみ | 開発者（手動） |
 * | **出品シート"ツール設定"** | App ID、User Token等 | クライアント |
 *
 * ## メリット
 *
 * - ✅ ハードコーディング完全ゼロ（コードに一切IDを書かない）
 * - ✅ コード経由での保存が不要（GUIで直接編集）
 * - ✅ Config.gsは完全に読み取り専用
 * - ✅ PropertiesServiceには最小限の情報のみ（スプレッドシートIDのみ）
 * - ✅ 認証情報はクライアント側で管理（都度読み込み）
 *
 * ## 注意事項
 *
 * - JSON形式が正しくないとエラーになります
 * - ダブルクォート(")を使用してください（シングルクォート不可）
 * - 最後の要素にカンマ不要
 * - 値はスプレッドシートID（文字列）のみ
 *
 * ## Config.gsの役割
 *
 * - getClientInfo() - スクリプトプロパティからスプレッドシートIDを読み取り（読み取り専用）
 * - getEnabledClients() - 全クライアントのスプレッドシートIDを読み取り（読み取り専用）
 */

/**
 * クライアント情報取得
 *
 * @param {string} clientKey - クライアント識別キー
 * @returns {string} スプレッドシートID
 */
function getClientInfo(clientKey) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const clients = JSON.parse(scriptProperties.getProperty('CLIENTS') || '{}');

  if (!clients[clientKey]) {
    throw new Error('クライアントキーが見つかりません: ' + clientKey);
  }

  // スプレッドシートIDのみ返す
  return clients[clientKey];
}

/**
 * 登録されている全クライアント一覧を取得
 *
 * @returns {Array} [{ key: 'CLIENT_A', id: '...' }, ...]
 */
function getEnabledClients() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const clients = JSON.parse(scriptProperties.getProperty('CLIENTS') || '{}');

  const enabled = [];
  for (const key in clients) {
    enabled.push({
      key: key,
      id: clients[key]  // スプレッドシートIDのみ
    });
  }
  return enabled;
}
