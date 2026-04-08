/**
 * eBay利益計算ツール - セットアップ・トリガー管理
 *
 * このファイルには実運転の初期設定で使用するすべての関数が集約されています
 *
 * 【セクション構成】
 * 1. 権限承認セクション - 初回権限承認関連
 * 2. トリガー管理セクション - トリガーの設定・削除・表示
 * 3. 設定管理セクション - 初期セットアップ・設定表示・検証
 * 4. イベントハンドラセクション - 編集時トリガー処理
 *
 * 操作方法: リサーチシートの図形ボタンから関数を実行
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
 * 1. 権限承認（スプレッドシート、Googleドライブ、外部URL）
 * 2. onOpenトリガー設定
 * 3. 設定検証
 *
 * 図形ボタンに割り当てる関数: completeInitialSetup
 *
 * 初回利用時にこのボタンを1回押すだけで、すべての初期設定が完了します。
 */
function completeInitialSetup() {
  const ui = SpreadsheetApp.getUi();

  try {
    // ステップ1: 権限承認
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

    // ステップ2: onOpenトリガー設定
    const triggers = ScriptApp.getProjectTriggers();
    let hasOnOpenTrigger = false;

    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'onOpen') {
        hasOnOpenTrigger = true;
      }
    });

    if (!hasOnOpenTrigger) {
      ScriptApp.newTrigger('onOpen')
        .forSpreadsheet(SpreadsheetApp.getActive())
        .onOpen()
        .create();
      Logger.log('ステップ2完了: onOpenトリガー設定成功');
    } else {
      Logger.log('ステップ2スキップ: onOpenトリガーは既に設定済み');
    }

    // ステップ3: 設定検証
    const validation = validateConfig();
    let validationMessage = '';

    if (validation.isValid) {
      validationMessage = '✅ 設定は正常です';
      Logger.log('ステップ3完了: 設定検証成功');
    } else {
      validationMessage = '⚠️ 設定に不足があります:\n' + validation.errors.join('\n');
      Logger.log('ステップ3警告: ' + validationMessage);
    }

    // 完了メッセージ
    ui.alert(
      '🎉 初期設定完了！',
      '✅ 権限承認完了\n' +
      '✅ 設定検証完了\n\n' +
      validationMessage + '\n\n' +
      '【次のステップ】\n' +
      '1. スプレッドシートをリロード（F5キー）\n' +
      '2. リサーチシートの図形ボタン（Expedited/Standard/書状）で出品開始',
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
// 3. 設定管理セクション
// ==========================================

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
// トリガー管理セクション
// ==========================================

/**
 * onOpenトリガーを設定
 * スプレッドシートを開いたときに自動実行されるトリガーを設定
 *
 * この関数を1回だけ実行してください
 */
function setupOnOpenTrigger() {
  try {
    // 既存のonOpenトリガーを削除
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'onOpen') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // 新しいonOpenトリガーを作成
    ScriptApp.newTrigger('onOpen')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onOpen()
      .create();

    SpreadsheetApp.getUi().alert('onOpenトリガーを設定しました\n\nスプレッドシートをリロードしてください。');

  } catch (error) {
    SpreadsheetApp.getUi().alert('onOpenトリガー設定エラー: ' + error.toString());
  }
}

/**
 * 編集時トリガーを有効化
 * リサーチシートのB8セル（URL）が編集されたときに自動実行
 */
function enableEditTrigger() {
  try {
    // 既存のトリガーを削除
    disableEditTrigger();

    // 新しいトリガーを作成
    ScriptApp.newTrigger('onEdit')
      .forSpreadsheet(ss)
      .onEdit()
      .create();

    SpreadsheetApp.getUi().alert('編集時トリガーを有効化しました\n\nリサーチシートのURL欄（B8）を編集すると、自動的にカテゴリ情報が取得されます。');

  } catch (error) {
    SpreadsheetApp.getUi().alert('トリガー有効化エラー: ' + error.toString());
  }
}

/**
 * 編集時トリガーを無効化
 */
function disableEditTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;

    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'onEdit') {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });

    // enableEditTrigger()から呼ばれた場合はメッセージを表示しない
    // 直接呼ばれた場合のみメッセージを表示
    const caller = new Error().stack;
    const isCalledFromEnable = caller.indexOf('enableEditTrigger') !== -1;

    if (!isCalledFromEnable) {
      if (deletedCount > 0) {
        SpreadsheetApp.getUi().alert('編集時トリガーを無効化しました');
      } else {
        SpreadsheetApp.getUi().alert('有効な編集時トリガーが見つかりませんでした');
      }
    }

    return deletedCount;

  } catch (error) {
    SpreadsheetApp.getUi().alert('トリガー無効化エラー: ' + error.toString());
    return 0;
  }
}

/**
 * すべてのトリガーを削除
 * 開発時のリセットや、トリガーの完全削除が必要な場合に使用
 */
function removeAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;

    triggers.forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    });

    if (deletedCount > 0) {
      SpreadsheetApp.getUi().alert('すべてのトリガーを削除しました\n\n削除数: ' + deletedCount + '個');
    } else {
      SpreadsheetApp.getUi().alert('削除するトリガーがありませんでした');
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert('トリガー削除エラー: ' + error.toString());
  }
}

/**
 * トリガー一覧を表示
 */
function showTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    if (triggers.length === 0) {
      SpreadsheetApp.getUi().alert('設定されているトリガーはありません');
      return;
    }

    let message = '=== トリガー一覧 ===\n\n';

    triggers.forEach(function(trigger, index) {
      message += (index + 1) + '. ' + trigger.getHandlerFunction() + '\n';
      message += '   種類: ' + trigger.getEventType() + '\n\n';
    });

    SpreadsheetApp.getUi().alert(message);

  } catch (error) {
    SpreadsheetApp.getUi().alert('トリガー一覧取得エラー: ' + error.toString());
  }
}

// ==========================================
// 4. イベントハンドラセクション
// ==========================================

/**
 * 編集時に実行される関数
 *
 * @param {Object} e イベントオブジェクト
 */
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    const range = e.range;

    // リサーチシート以外は無視
    if (sheet.getName() !== SHEET_NAMES.RESEARCH) {
      return;
    }

    // B8セル（URL）の編集のみ処理
    if (range.getRow() === RESEARCH_ROWS.DATA && range.getColumn() === RESEARCH_COLUMNS.URL) {
      const url = range.getValue();

      // URLが空の場合は処理しない
      if (!url || url.toString().trim() === '') {
        return;
      }

      // カテゴリ情報を取得
      Logger.log('URL編集を検知: ' + url);
      getCategoryFromUrl();
    }

  } catch (error) {
    Logger.log('onEditエラー: ' + error.toString());
  }
}
