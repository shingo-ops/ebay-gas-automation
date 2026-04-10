/**
 * eBay利益計算ツール - セットアップ管理
 *
 * このファイルには実運転の初期設定で使用するすべての関数が集約されています
 *
 * 【セクション構成】
 * 1. 権限承認セクション - 初回権限承認関連
 * 2. 設定管理セクション - 初期セットアップ・設定表示・検証・トリガー登録
 * 3. 自動実行トリガー - handleEdit（Item URL入力時のカテゴリ自動取得）
 *
 * 操作方法: リサーチシートの図形ボタンから関数を実行
 *
 * 【自動実行機能】
 * - handleEdit: Item URL（B8セル）入力時に自動的にカテゴリ情報を取得
 *   ※インストール可能トリガーとして登録（completeInitialSetup実行時に自動登録）
 *   ※関数名を`onEdit`ではなく`handleEdit`にすることでシンプルトリガーを回避（二重実行防止）
 */

// ==========================================
// 1. 権限承認セクション
// ==========================================

/**
 * ワンクリック初期設定（推奨）
 *
 * 【このボタン1つで初期設定がすべて完了します】
 *
 * 実行内容:
 * 1. 権限承認（初回のみ、スプレッドシート、Googleドライブ、外部URL）
 * 2. 設定検証
 * 3. eBay API接続テスト
 *
 * 図形ボタンに割り当てる関数: completeInitialSetup
 *
 * 初回利用時にこのボタンを1回押すだけで、すべての初期設定が完了します。
 * 2回目以降は権限承認をスキップして、設定検証とAPI接続テストのみ実行されます。
 */
function completeInitialSetup() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    // 初回セットアップ完了フラグを確認
    const isFirstTime = !scriptProperties.getProperty('INITIAL_SETUP_COMPLETED');

    // ステップ1: 権限承認（初回のみ）
    if (isFirstTime) {
      // ✅ 修正：トークンキャッシュを明示的に削除（コピー先スプレッドシート対策）
      Logger.log('初回セットアップ: トークンキャッシュをクリアします');
      scriptProperties.deleteProperty('EBAY_ACCESS_TOKEN');
      scriptProperties.deleteProperty('EBAY_TOKEN_EXPIRY');

      ui.alert(
        'ステップ 1/3: 権限承認',
        '必要な権限を確認しています...\n\n次のダイアログで「許可」をクリックしてください。',
        ui.ButtonSet.OK
      );

      // スプレッドシート権限
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const testValue = sheet.getRange('A1').getValue();

      // Googleドライブ権限
      const folders = DriveApp.getFolders();
      if (folders.hasNext()) {
        const folder = folders.next();
        Logger.log('フォルダ確認: ' + folder.getName());
      }

      // 外部URL取得権限
      const testUrl = 'https://www.google.com';
      UrlFetchApp.fetch(testUrl, { muteHttpExceptions: true });

      Logger.log('ステップ1完了: 権限承認成功');

      // 初回セットアップ完了フラグを保存
      scriptProperties.setProperty('INITIAL_SETUP_COMPLETED', 'true');
    } else {
      Logger.log('権限承認済みのため、ステップ1をスキップします');
    }

    // ステップ2: 設定検証
    ui.alert(
      'ステップ 2/3: 設定検証',
      '設定内容を確認しています...',
      ui.ButtonSet.OK
    );

    const validation = validateConfig();
    let validationMessage = '';

    if (validation.isValid) {
      validationMessage = '✅ 設定は正常です';
      Logger.log('ステップ2完了: 設定検証成功');
    } else {
      validationMessage = '⚠️ 設定に不足があります:\n' + validation.errors.join('\n');
      Logger.log('ステップ2警告: ' + validationMessage);
    }

    // ステップ3: eBay API初期設定
    ui.alert(
      'ステップ 3/3: eBay API接続',
      'eBay APIに接続してトークンを取得しています...\n\nこれには数秒かかる場合があります。',
      ui.ButtonSet.OK
    );

    let ebayApiMessage = '';
    try {
      // OAuthトークンを取得
      const token = getOAuthToken();
      Logger.log('OAuthトークン取得成功');

      // eBay APIへのテスト接続（Browse APIで簡易テスト）
      const config = getEbayConfig();
      const testApiUrl = config.getBrowseApiUrl() + '/item/get_item_by_legacy_id?legacy_item_id=123456789012';
      const testOptions = {
        method: 'get',
        headers: {
          'Authorization': 'Bearer ' + token,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        },
        muteHttpExceptions: true
      };

      const testResponse = UrlFetchApp.fetch(testApiUrl, testOptions);
      const statusCode = testResponse.getResponseCode();

      // ステータスコード200または404であればAPI接続は成功（404は商品が存在しないだけ）
      if (statusCode === 200 || statusCode === 404) {
        ebayApiMessage = '✅ eBay API接続成功';
        Logger.log('ステップ3完了: eBay API接続成功（ステータスコード: ' + statusCode + '）');
      } else if (statusCode === 401) {
        ebayApiMessage = '⚠️ eBay API認証エラー（App ID/Cert IDを確認してください）';
        Logger.log('ステップ3警告: 認証エラー（401）');
      } else {
        ebayApiMessage = '⚠️ eBay API接続エラー（ステータスコード: ' + statusCode + '）';
        Logger.log('ステップ3警告: 接続エラー（' + statusCode + '）');
      }

    } catch (error) {
      ebayApiMessage = '⚠️ eBay API接続エラー: ' + error.toString();
      Logger.log('ステップ3エラー: ' + error.toString());
    }

    // ステップ4: onEditトリガー登録（初回のみ）
    let triggerMessage = '';
    if (isFirstTime) {
      try {
        Logger.log('ステップ4: onEditトリガーを登録します');
        setupOnEditTrigger();
        triggerMessage = '✅ 自動実行トリガー登録完了';
        Logger.log('ステップ4完了: トリガー登録成功');
      } catch (error) {
        triggerMessage = '⚠️ トリガー登録失敗（手動で再実行してください）';
        Logger.log('ステップ4エラー: ' + error.toString());
      }
    }

    // 完了メッセージ
    let completionMessage = '';
    if (isFirstTime) {
      completionMessage = '✅ 権限承認完了\n✅ 設定検証完了\n' + ebayApiMessage + '\n' + triggerMessage + '\n\n' + validationMessage;
    } else {
      completionMessage = '✅ 設定検証完了\n' + ebayApiMessage + '\n\n' + validationMessage;
    }

    ui.alert(
      isFirstTime ? '🎉 初期設定完了！' : '✅ 設定確認完了',
      completionMessage + '\n\n' +
      '【次のステップ】\n' +
      '1. スプレッドシートをリロード（F5キー）\n' +
      '2. リサーチシートの図形ボタン（Expedited/Economy/書状）で出品開始',
      ui.ButtonSet.OK
    );

    return {
      success: true,
      message: '初期設定が完了しました'
    };

  } catch (error) {
    Logger.log('初期設定エラー: ' + error.toString());

    ui.alert(
      '初期設定エラー',
      '初期設定中にエラーが発生しました。\n\n' +
      '以下を確認してください:\n' +
      '1. ツール設定シートの必須項目が全て入力されているか\n' +
      '2. 出品シートのスプレッドシートIDが正しいか\n' +
      '3. インターネット接続が正常か\n\n' +
      '修正後、図形ボタンから再度初期設定を実行してください。',
      ui.ButtonSet.OK
    );

    return {
      success: false,
      message: 'エラー: 初期設定に失敗しました'
    };
  }
}

/**
 * 権限承認用関数
 * すべての必要な権限を使用するダミー関数
 * この関数を実行することで、一度にすべての権限承認を完了できる
 *
 * 画像やボタンにこの関数名を割り当てることで、
 * スクリプトエディタにアクセスできないユーザーでも権限承認が可能
 *
 * ⚠️ 非推奨: completeInitialSetup() を使用してください
 */
function authorizePermissions() {
  try {
    // スプレッドシート権限
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const testValue = sheet.getRange('A1').getValue();

    // Googleドライブ権限
    const folders = DriveApp.getFolders();
    if (folders.hasNext()) {
      const folder = folders.next();
      Logger.log('フォルダ確認: ' + folder.getName());
    }

    // 外部URL取得権限
    const testUrl = 'https://www.google.com';
    UrlFetchApp.fetch(testUrl, { muteHttpExceptions: true });

    // 成功メッセージを表示
    SpreadsheetApp.getUi().alert(
      '権限承認完了',
      '✅ すべての権限が正常に承認されました。\n\nこれで画像ダウンロード機能を含む全機能が使用できます。',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    Logger.log('権限承認完了');
    return {
      success: true,
      message: '権限承認が完了しました'
    };

  } catch (error) {
    Logger.log('権限承認エラー: ' + error.toString());

    SpreadsheetApp.getUi().alert(
      '権限承認エラー',
      '権限の承認中にエラーが発生しました。\n\n' +
      '以下を確認してください:\n' +
      '1. Googleアカウントでログインしているか\n' +
      '2. スプレッドシートの編集権限があるか\n' +
      '3. ポップアップブロックが無効になっているか\n\n' +
      '修正後、図形ボタンから再度権限承認を実行してください。',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return {
      success: false,
      message: 'エラー: 権限承認に失敗しました'
    };
  }
}

/**
 * 権限承認ガイド表示
 * 画像ボタンの設定手順を説明
 */
function showAuthorizationGuide() {
  const ui = SpreadsheetApp.getUi();

  const message = '【初回利用時の権限承認手順】\n\n' +
    '1. リサーチシートの「権限承認」ボタンをクリック\n' +
    '2. 「承認が必要です」ダイアログが表示されます\n' +
    '3. 「続行」をクリック\n' +
    '4. Googleアカウントを選択\n' +
    '5. 「詳細」→「安全でないページに移動」をクリック\n' +
    '6. 必要な権限を確認して「許可」をクリック\n\n' +
    '✅ 権限承認は初回のみ必要です\n' +
    '✅ 承認後は画像ダウンロードを含む全機能が使用可能になります\n\n' +
    '【画像ボタンの設定方法】\n\n' +
    '1. リサーチシートにボタン用の画像を挿入\n' +
    '2. 画像を選択して右クリック → 「スクリプトを割り当て」\n' +
    '3. 関数名に「authorizePermissions」と入力\n' +
    '4. OKをクリック\n\n' +
    '設定完了後、画像をクリックすると権限承認が開始されます。';

  ui.alert('権限承認ガイド', message, ui.ButtonSet.OK);
}

// ==========================================
// 2. 設定管理セクション
// ==========================================

/**
 * onEditトリガーをインストール可能トリガーとして登録
 *
 * コピーしたスプレッドシートでもURLFetchApp権限を使えるようにするため、
 * シンプルトリガーではなくインストール可能トリガーとして登録します。
 *
 * 初回セットアップ時に自動的に実行されます。
 */
function setupOnEditTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 既存のonEditトリガーを全て削除
  const triggers = ScriptApp.getUserTriggers(ss);
  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i];
    if (trigger.getEventType() === ScriptApp.EventType.ON_EDIT) {
      Logger.log('既存のonEditトリガーを削除: ' + trigger.getUniqueId());
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // 新しいonEditトリガーを登録（handleEdit関数を使用）
  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log('✅ handleEdit関数をonEditトリガーとして登録しました');
}

/**
 * 初回セットアップフラグをリセット
 *
 * 開発・テスト時や、権限承認を再度実行したい場合に使用
 */
function resetInitialSetupFlag() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteProperty('INITIAL_SETUP_COMPLETED');

  SpreadsheetApp.getUi().alert(
    'リセット完了',
    '初回セットアップフラグをリセットしました。\n\n次回の completeInitialSetup() 実行時に、権限承認から再度実行されます。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  Logger.log('初回セットアップフラグをリセットしました');
}

/**
 * 初期セットアップを実行
 */
function initialSetup() {
  try {
    // 設定を検証
    const validation = validateConfig();

    if (!validation.isValid) {
      const errorMessage = '設定エラー:\n' + validation.errors.join('\n');
      SpreadsheetApp.getUi().alert(errorMessage);
      return;
    }

    // 必要なシートが存在するか確認
    const requiredSheets = [SHEET_NAMES.SETTINGS, SHEET_NAMES.RESEARCH];
    const missingSheets = [];

    requiredSheets.forEach(function(sheetName) {
      if (!ss.getSheetByName(sheetName)) {
        missingSheets.push(sheetName);
      }
    });

    if (missingSheets.length > 0) {
      throw new Error('以下のシートが見つかりません: ' + missingSheets.join(', '));
    }

    // OAuthトークンを取得してテスト
    const token = getOAuthToken();
    Logger.log('OAuthトークンを取得しました');

    SpreadsheetApp.getUi().alert('セットアップが完了しました');

  } catch (error) {
    Logger.log('セットアップエラー: ' + error.toString());
    SpreadsheetApp.getUi().alert('セットアップエラー: ' + error.toString());
  }
}

/**
 * 設定を表示
 */
function showConfig() {
  try {
    const config = getEbayConfig();
    const validation = validateConfig();

    let message = '=== eBay API設定 ===\n\n';
    message += 'App ID: ' + config.appId + '\n';
    message += 'Dev ID: ' + config.devId + '\n';
    message += 'Sandbox: ' + (config.isSandbox ? '有効' : '無効') + '\n';
    message += '画像フォルダ: ' + config.imageFolderUrl + '\n';
    message += '出品シートID: ' + config.listingSpreadsheetId + '\n\n';
    message += '検証結果: ' + (validation.isValid ? '✓ OK' : '✗ エラーあり') + '\n';

    if (!validation.isValid) {
      message += '\nエラー:\n' + validation.errors.join('\n');
    }

    SpreadsheetApp.getUi().alert(message);

  } catch (error) {
    SpreadsheetApp.getUi().alert('設定の取得に失敗しました: ' + error.toString());
  }
}

/**
 * 設定を検証
 */
function checkConfig() {
  try {
    const validation = validateConfig();

    if (validation.isValid) {
      SpreadsheetApp.getUi().alert('設定は正常です ✓');
    } else {
      const errorMessage = '設定エラー:\n\n' + validation.errors.join('\n');
      SpreadsheetApp.getUi().alert(errorMessage);
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert('検証エラー: ' + error.toString());
  }
}

// ==========================================
// 3. 自動実行トリガー
// ==========================================

/**
 * Item URL編集時の自動実行（インストール可能トリガー）
 *
 * リサーチシートのB8セル（Item URL）にURLを入力すると、
 * 自動的にカテゴリIDとカテゴリ名を取得してG8、H8セルに書き込みます。
 *
 * この関数はインストール可能トリガーとして登録されます。
 * completeInitialSetup() 実行時に自動的にトリガー登録されます（手動設定不要）。
 *
 * インストール可能トリガーにすることで、コピーしたスプレッドシートでも
 * 外部API呼び出し（UrlFetchApp）の権限を使用できます。
 *
 * 注: 関数名を`onEdit`から`handleEdit`に変更することで、
 *     シンプルトリガーとして動作しないようにしています（二重実行防止）。
 */
function handleEdit(e) {
  try {
    // デバッグログ: onEditが呼ばれたことを記録
    Logger.log('=== onEdit トリガー発火 ===');

    // イベントオブジェクトが存在しない場合は終了
    if (!e) {
      Logger.log('⚠️ イベントオブジェクトが存在しません');
      return;
    }

    const sheet = e.source.getActiveSheet();
    const range = e.range;
    const editedRow = range.getRow();
    const editedCol = range.getColumn();

    // デバッグログ: 編集されたセル情報
    Logger.log('編集シート名: ' + sheet.getName());
    Logger.log('編集セル: 行=' + editedRow + ', 列=' + editedCol);
    Logger.log('期待値: 行=' + RESEARCH_ITEM_LIST.DATA_ROW + ', 列=' + RESEARCH_ITEM_LIST.COLUMNS.ITEM_URL.col);

    // リサーチシート以外は無視
    if (sheet.getName() !== SHEET_NAMES.RESEARCH) {
      Logger.log('リサーチシート以外なのでスキップ');
      return;
    }

    if (editedRow !== RESEARCH_ITEM_LIST.DATA_ROW) {
      Logger.log('データ行以外なのでスキップ（行=' + editedRow + '）');
      return;
    }

    // B8セル（Item URL）の編集 → カテゴリ情報を自動取得
    if (editedCol === RESEARCH_ITEM_LIST.COLUMNS.ITEM_URL.col) {
      const url = range.getValue();
      Logger.log('✅ Item URLセル編集を検知: ' + url);

      // URLが空の場合はカテゴリ情報と状態プルダウンをクリア
      if (!url || url.toString().trim() === '') {
        Logger.log('URLが空なのでカテゴリ情報・状態プルダウンをクリア');
        sheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_ID.col).setValue('');
        sheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_NAME.col).setValue('');
        setConditionDropdown('', sheet);
        return;
      }

      // カテゴリ情報を自動取得（fetchCategoryFromUrl 内で状態プルダウンも生成）
      Logger.log('fetchCategoryFromUrl を呼び出します');
      fetchCategoryFromUrl(url.toString(), sheet);

    // G8セル（カテゴリID）の手動編集 → 状態プルダウンを更新
    } else if (editedCol === RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_ID.col) {
      const categoryId = range.getValue();
      Logger.log('✅ カテゴリIDセル編集を検知: ' + categoryId);
      setConditionDropdown(categoryId ? categoryId.toString() : '', sheet);

    } else {
      Logger.log('対象セル以外なのでスキップ（行=' + editedRow + ', 列=' + editedCol + '）');
    }

  } catch (error) {
    Logger.log('❌ onEditエラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    // エラーが発生しても処理を中断しない（他の編集操作に影響を与えないため）
  }
}

/**
 * URLからカテゴリ情報を取得してシートに書き込み
 *
 * @param {string} url eBay商品URL
 * @param {Sheet} sheet リサーチシート
 */
function fetchCategoryFromUrl(url, sheet) {
  try {
    // 処理中メッセージを表示
    SpreadsheetApp.getActiveSpreadsheet().toast('カテゴリ情報を取得中...', 'eBay API', 3);

    // eBay APIから商品情報を取得
    const productInfo = getProductInfoFromUrl(url);

    // カテゴリ情報を取得
    const categoryId = productInfo.category.categoryId || '';
    const categoryName = productInfo.category.categoryName || '';

    Logger.log('カテゴリID: ' + categoryId);
    Logger.log('カテゴリ名: ' + categoryName);

    // G8セル（カテゴリID）に書き込み
    sheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_ID.col).setValue(categoryId);

    // H8セル（カテゴリ名）に書き込み
    sheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_NAME.col).setValue(categoryName);

    Logger.log('✅ カテゴリ情報を自動設定しました');

    // E8セル（状態）プルダウンを生成（onEdit はスクリプトによる setValue を検知しないため直接呼び出し）
    if (categoryId) {
      setConditionDropdown(categoryId.toString(), sheet);
    }

    // 完了メッセージ
    SpreadsheetApp.getActiveSpreadsheet().toast('カテゴリ情報を取得しました', '✅ 完了', 2);

  } catch (error) {
    Logger.log('fetchCategoryFromUrlエラー: ' + error.toString());

    // ✅ 修正：エラーの種類に応じて異なるメッセージを表示
    let errorMessage = 'カテゴリ情報の取得に失敗しました。';
    const errorString = error.toString();

    // トークン取得エラーの場合
    if (errorString.indexOf('eBay APIトークンの取得') !== -1) {
      errorMessage = 'eBay API認証に失敗しました。\n\n初期設定を実行してください:\n図形ボタン「初期設定」をクリック';
    }
    // App ID未設定エラーの場合
    else if (errorString.indexOf('App ID') !== -1 || errorString.indexOf('Cert ID') !== -1) {
      errorMessage = 'eBay API設定が不完全です。\n\nツール設定シートでApp ID/Cert IDを確認してください。';
    }
    // 商品が見つからない場合
    else if (errorString.indexOf('見つかりません') !== -1 || errorString.indexOf('404') !== -1) {
      errorMessage = '指定された商品が見つかりません。\n\nItem URLを確認してください。';
    }
    // その他のエラー
    else {
      errorMessage = 'カテゴリ情報の取得に失敗しました。\n\n以下を確認してください:\n1. Item URLが正しいeBay URLか\n2. インターネット接続が正常か\n3. 初期設定が完了しているか';
    }

    // エラーメッセージを表示
    SpreadsheetApp.getActiveSpreadsheet().toast(
      errorMessage,
      '⚠️ エラー',
      10
    );

    // カテゴリ情報をクリア
    sheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_ID.col).setValue('');
    sheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_NAME.col).setValue('');
  }
}

/**
 * onEditトリガーのテスト
 *
 * 手動でonEdit関数をテストする際に使用
 * リサーチシートのB8セルに入力されているURLでカテゴリ情報を取得
 */
function testOnEdit() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);

    if (!sheet) {
      SpreadsheetApp.getUi().alert('リサーチシートが見つかりません');
      return;
    }

    // B8セルからURLを取得
    const url = sheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.ITEM_URL.col).getValue();

    if (!url || url.toString().trim() === '') {
      SpreadsheetApp.getUi().alert('Item URL（B8セル）が入力されていません');
      return;
    }

    Logger.log('=== onEditトリガーテスト ===');
    Logger.log('Item URL: ' + url);

    // カテゴリ情報を取得
    fetchCategoryFromUrl(url.toString(), sheet);

    SpreadsheetApp.getUi().alert(
      '✅ テスト完了',
      'カテゴリ情報を取得しました。\n\nG8セル（カテゴリID）とH8セル（カテゴリ名）を確認してください。',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (error) {
    Logger.log('testOnEditエラー: ' + error.toString());
    SpreadsheetApp.getUi().alert('エラー', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


