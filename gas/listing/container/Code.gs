/**
 * eBay出品管理 - クライアント側バインドスクリプト
 *
 * このスクリプトは各クライアントのスプレッドシートに設置します
 *
 * セットアップ手順:
 * 1. スプレッドシートで「拡張機能」→「Apps Script」を開く
 * 2. このコードを貼り付け
 * 3. 「ライブラリ」→「ライブラリを追加」
 * 4. スクリプトID: ツール設定シートのライブラリスクリプトID（B18）を使用
 * 5. 識別子: EbayLib
 * 6. バージョン: Head（開発中）または最新バージョン（本番）
 * 7. 保存
 * 8. メニュー「eBay出品管理」→「権限承認・トリガー登録」を実行
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// シート起動時メニュー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * スプレッドシートを開いたときにカスタムメニューを追加する
 *
 * メニュー構成:
 *   出品管理
 *     ├── 出品（新規出品）
 *     └── 更新（出品済み商品の更新）
 *   初回セットアップ
 *     ├── ポリシー取得
 *     └── ポリシー更新
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('⚙️')
    .addItem('権限承認・トリガー登録', 'authorizeScript')
    .addSeparator()
    .addItem('OAuth認証URL生成', 'menuOAuthGenerateUrl')
    .addItem('認証コードでトークン取得', 'menuOAuthExchangeCode')
    .addSeparator()
    .addItem('出品者情報設定', 'menuSetupSellerInfo')
    .addItem('ポリシー取得', 'menuGetPolicies')
    .addItem('ポリシー更新', 'menuSyncPolicies')
    .addSeparator()
    .addItem('シート情報更新', 'menuSyncSheet')
    .addToUi();

  ui.createMenu('出品管理')
    .addItem('出品', 'menuCreateListing')
    .addSeparator()
    .addItem('更新', 'menuReviseItem')
    .addItem('取り下げ', 'menuEndListing')
    .addToUi();

  ui.createMenu('在庫管理')
    .addItem('セルスタCSV出力', 'menuExportSellstaCsv')
    .addItem('仕入元名を一括更新', 'menuUpdatePurchaseSiteNames')
    .addToUi();

  ui.createMenu('その他')
    .addItem('管理年月プルダウン更新', 'menuUpdateKanriYmDropdown')
    .addItem('報酬計算', 'menuCalculateReward')
    .addToUi();
}

/**
 * 【出品】アクティブ行を新規出品する
 */
function menuCreateListing() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  // 出品シート以外は拒否
  if (sheet.getName() !== '出品') {
    ui.alert('エラー', '出品シートを選択してください。', ui.ButtonSet.OK);
    return;
  }

  // 出品DBからの誤操作を防止
  // ツール設定の「出品シート」URLと現在のSSを比較
  try {
    const ebayConfig = EbayLib.getEbayConfig(spreadsheetId);
    const listingSheetUrl = String(ebayConfig.listingSheetUrl || '').trim();
    if (listingSheetUrl) {
      const listingSheetIdMatch = listingSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (listingSheetIdMatch && listingSheetIdMatch[1]) {
        const currentSsId = ss.getId();
        if (listingSheetIdMatch[1] !== currentSsId) {
          ui.alert(
            '❌ 出品不可',
            'このスプレッドシートからは出品できません。\n出品シートから操作してください。',
            ui.ButtonSet.OK
          );
          return;
        }
      }
    }
  } catch(configErr) {
    Logger.log('出品DBチェックエラー（続行）: ' + configErr.toString());
  }

  const row = sheet.getActiveRange().getRow();
  if (row <= 4) {
    ui.alert('エラー', 'データ行（5行目以降）を選択してください。', ui.ButtonSet.OK);
    return;
  }

  // 出品前に強制ワード判定を実行（シートの値に依存せず毎回チェック）
  const headerMapping = EbayLib.buildListingHeaderMapping(spreadsheetId, sheet.getName());
  const titleCol = headerMapping['タイトル'];
  const titleForCheck = titleCol
    ? String(sheet.getRange(row, titleCol).getValue() || '').trim()
    : '';

  // ワード判定を強制実行して結果を取得
  let wordCheck = '';
  try {
    if (titleForCheck) {
      wordCheck = EbayLib.forceCheckWordJudgement(spreadsheetId, row, titleForCheck);
    }
  } catch(wcErr) {
    Logger.log('forceCheckWordJudgement エラー（フォールバック）: ' + wcErr.toString());
  }
  // フォールバック: シートの既存値を使用
  if (!wordCheck) {
    try {
      wordCheck = String(EbayLib.getWordCheckValue(spreadsheetId, row) || '');
    } catch(e2) {
      Logger.log('getWordCheckValue エラー: ' + e2.toString());
    }
  }
  Logger.log('ワード判定結果: ' + wordCheck);

  // 禁止ワードは完全ブロック
  if (wordCheck && String(wordCheck).indexOf('禁止:') === 0) {
    ui.alert(
      '🚫 出品禁止',
      '禁止ワードが含まれているため出品できません。\n\n' +
      '判定結果: ' + wordCheck + '\n\n' +
      'タイトルを修正してから再度出品してください。',
      ui.ButtonSet.OK
    );
    return;
  }

  // 文字数オーバーは警告のみ
  if (wordCheck === '文字数オーバー') {
    const overResponse = ui.alert(
      '⚠️ 文字数オーバー警告',
      'タイトルが80文字を超えています。\n出品を続行しますか？',
      ui.ButtonSet.OK_CANCEL
    );
    if (overResponse !== ui.Button.OK) return;
  }

  // VEROは警告のみ
  if (wordCheck && String(wordCheck).indexOf('VERO:') === 0) {
    const veroResponse = ui.alert(
      '⚠️ VERO警告',
      'VEROワードが含まれています。\n判定結果: ' + wordCheck + '\n\n出品を続行しますか？',
      ui.ButtonSet.OK_CANCEL
    );
    if (veroResponse !== ui.Button.OK) return;
  }

  const condDescCol = headerMapping['状態説明'];
  if (condDescCol) {
    const condDesc = String(sheet.getRange(row, condDescCol).getValue() || '');
    if (condDesc.length > 1000) {
      ui.alert(
        '❌ 出品不可',
        '状態説明が1000文字を超えています（現在: ' + condDesc.length + '文字）。\n' +
        '1000文字以内に修正してから再度出品してください。',
        ui.ButtonSet.OK
      );
      return;
    }
  }

  const response = ui.alert(
    '出品確認',
    row + '行目を新規出品します。\n実行しますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (response !== ui.Button.OK) return;

  try {
    const result = EbayLib.menuCreateListing(spreadsheetId, row);
    if (result.success && result.warning) {
      ui.alert('⚠️ 注意', result.warning, ui.ButtonSet.OK);
    } else if (result.success) {
      const msg = '✅ 出品完了・DB転記完了\nItem ID: ' + result.itemId;
      ui.alert('出品完了', msg, ui.ButtonSet.OK);
    } else {
      ui.alert('エラー', result.message || '不明なエラーが発生しました。', ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('エラー', '❌ 出品エラー:\n' + e.toString(), ui.ButtonSet.OK);
  }
}

/**
 * 【更新】アクティブ行の出品済み商品を全フィールド更新する
 */
function menuReviseItem() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== '出品') {
    ui.alert('エラー', '「出品」シートを選択してください。', ui.ButtonSet.OK);
    return;
  }

  const row = sheet.getActiveRange().getRow();
  if (row <= 1) {
    ui.alert('エラー', 'データ行（2行目以降）を選択してください。', ui.ButtonSet.OK);
    return;
  }

  const headerMapping = EbayLib.buildListingHeaderMapping(spreadsheetId, sheet.getName());

  // Item IDを取得
  const itemIdCol = headerMapping['Item ID'];
  if (!itemIdCol) {
    ui.alert('エラー', '「Item ID」列が見つかりません。', ui.ButtonSet.OK);
    return;
  }
  const itemId = String(sheet.getRange(row, itemIdCol).getDisplayValue() || '').trim();
  if (!itemId) {
    ui.alert('エラー', row + '行目のItem IDが空です。', ui.ButtonSet.OK);
    return;
  }

  // タイトルを取得（確認ダイアログ用）
  const titleCol = headerMapping['タイトル'];
  const title = titleCol
    ? String(sheet.getRange(row, titleCol).getValue() || '')
    : '（タイトル不明）';

  const response = ui.alert(
    '出品更新確認',
    'Item ID: ' + itemId + '\n商品名: ' + title + '\n\n' +
    'この行のデータでeBayの商品情報を更新します。\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  try {
    const result = EbayLib.reviseFixedPriceItem(spreadsheetId, row);
    if (result.success) {
      ui.alert('✅ 更新完了', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
    }
  } catch(e) {
    ui.alert('❌ エラー', e.toString(), ui.ButtonSet.OK);
  }
}

/**
 * 【取り下げ】アクティブ行の出品を取り下げる
 */
function menuEndListing() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== '出品') {
    ui.alert('エラー', '「出品」シートを選択してください。', ui.ButtonSet.OK);
    return;
  }

  const row = sheet.getActiveRange().getRow();
  if (row <= 4) {
    ui.alert('エラー', 'データ行（5行目以降）を選択してください。', ui.ButtonSet.OK);
    return;
  }

  const headerMapping = EbayLib.buildListingHeaderMapping(spreadsheetId, sheet.getName());
  const itemIdCol = headerMapping['Item ID'];
  if (!itemIdCol) {
    ui.alert('エラー', '「Item ID」列が見つかりません。', ui.ButtonSet.OK);
    return;
  }

  const itemId = String(sheet.getRange(row, itemIdCol).getDisplayValue() || '').trim();
  if (!itemId) {
    ui.alert('エラー', row + '行目の Item ID が空です。', ui.ButtonSet.OK);
    return;
  }

  const titleCol = headerMapping['タイトル'];
  const title    = titleCol ? String(sheet.getRange(row, titleCol).getValue() || '') : '（タイトル不明）';

  const response = ui.alert(
    '出品取り下げ確認',
    'Item ID: ' + itemId + '\n商品名: ' + title + '\n\nこの出品を取り下げますか？',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  try {
    const result = EbayLib.endFixedPriceItem(spreadsheetId, itemId);
    if (result.success) {
      const statusCol  = headerMapping['出品ステータス'] || headerMapping['ステータス'];
      if (statusCol)  sheet.getRange(row, statusCol).setValue('End');
      const endDateCol = headerMapping['取り下げ日時'];
      if (endDateCol) sheet.getRange(row, endDateCol).setValue(
        Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
      );
      ui.alert('完了', '✅ 取り下げが完了しました。\nItem ID: ' + itemId, ui.ButtonSet.OK);
    } else {
      ui.alert('エラー', '❌ 取り下げに失敗しました:\n' + result.message, ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('エラー', '❌ 取り下げエラー:\n' + e.toString(), ui.ButtonSet.OK);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 初回セットアップ・ポリシー管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function menuSetupEbayManager() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();
  const result = EbayLib.setupEbayManager(spreadsheetId);
  if (result.success) {
    ui.alert('セットアップ完了', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', result.message, ui.ButtonSet.OK);
  }
}

function menuSetupSellerInfo() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();
  const result = EbayLib.setupSellerInfo(spreadsheetId);
  if (result.success) {
    ui.alert('出品者情報設定完了', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', result.message, ui.ButtonSet.OK);
  }
}

function menuGetPolicies() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'ポリシー取得',
    'eBayからポリシーを取得してシートを更新します。\n既存のデータは上書きされます。\n\n実行しますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (response !== ui.Button.OK) return;
  const result = EbayLib.menuGetPolicies(spreadsheetId);
  if (result.success) {
    ui.alert('取得完了', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', result.message, ui.ButtonSet.OK);
  }
}

function menuSyncPolicies() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'ポリシー更新',
    'シートの変更をeBayに反映します。\n\n' +
    '- 操作列が「追加」→ 新規作成\n' +
    '- 操作列が「更新」→ 更新\n' +
    '- 操作列が「削除」→ 削除\n\n' +
    '実行しますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (response !== ui.Button.OK) return;
  const result = EbayLib.menuSyncPolicies(spreadsheetId);
  if (result.success) {
    ui.alert('同期完了', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', result.message, ui.ButtonSet.OK);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 編集トリガー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 【インストール済みトリガー】handleEdit
 *
 * 出品シートの編集時に自動呼び出しされる。
 * authorizeScript() を実行するとトリガーが登録される。
 *
 * ・カテゴリID 列が変更された場合
 *     → 確認ダイアログを表示し、YES なら EbayLib.applyCategoryChange() を実行
 * ・それ以外の列
 *     → EbayLib.processOnEdit() に委譲（タイトル文字数更新など）
 *
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function handleEdit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) { Logger.log('他の処理が実行中のためスキップ'); return; }
  try {
    if (!e || !e.range) return;

    const range     = e.range;
    const sheet     = range.getSheet();
    const sheetName = sheet.getName();
    const row       = range.getRow();
    const col       = range.getColumn();

    // 出品シート以外の処理
    if (sheetName !== '出品') {
      // 状態テンプレのプルダウン選択時
      // ※ 状態テンプレシートは出品シートにバインドされているため
      // 出品シートの状態テンプレ列の変更を検知
      // → handleEdit内で出品シートの処理として対応済み
      return;
    }

    // ヘッダー行（1-4行目）は無視
    if (row <= 4) return;

    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

    // ヘッダーマッピングを構築
    const headerMapping = EbayLib.buildListingHeaderMapping(spreadsheetId, sheet.getName());

    // 出品ステータス → "End" の場合は取り下げ処理
    const statusCol = headerMapping['出品ステータス'] || headerMapping['ステータス'];
    if (statusCol && col === statusCol) {
      const newStatus = String(e.value !== undefined ? e.value : range.getValue()).trim();
      if (newStatus === '出品終了') {
        _handleEndListing(e, sheet, headerMapping, row, spreadsheetId);
      } else if (newStatus === '在庫切れ') {
        _handleOutOfStock(e, sheet, headerMapping, row, spreadsheetId);
      }
      return;
    }

    // スペックURL列の変更かどうかを確認
    const specUrlCol = headerMapping['スペックURL'];
    if (specUrlCol && col === specUrlCol) {
      const specUrl = String(e.value !== undefined ? e.value : (range.getValue() || '')).trim();
      if (specUrl) handleSpecUrlChangedInListing(sheet, row, headerMapping, specUrl);
      return;
    }

    // 状態テンプレ列（状態テンプレ）の変更
    const conditionTemplateCol = headerMapping['状態テンプレ'];
    if (conditionTemplateCol && col === conditionTemplateCol) {
      const selectedCondition = String(e.value !== undefined ? e.value : range.getValue()).trim();
      if (selectedCondition) {
        EbayLib.handleConditionTemplateChange(spreadsheetId, sheet.getName(), row, selectedCondition);
      }
      return;
    }

    // 発送業者列の変更
    const shipperCol = headerMapping['発送業者'];
    if (shipperCol && col === shipperCol) {
      const selectedShipper = String(e.value !== undefined ? e.value : range.getValue()).trim();
      if (selectedShipper) {
        EbayLib.handleShipperChange(spreadsheetId, sheet.getName(), row, selectedShipper);
      }
      return;
    }

    // カテゴリID列の変更
    const categoryIdCol = EbayLib.getCategoryIdColumnNumber(spreadsheetId);
    if (categoryIdCol && col === categoryIdCol) {
      _handleCategoryIdChange(e, spreadsheetId, sheetName, row);
      return;
    }

    // 仕入元URL①②③の変更 → サイト名を自動判定して仕入元名①②③に書き込む
    const purchaseUrlCols = ['仕入元URL①', '仕入元URL②', '仕入元URL③'];
    const changedHeader = Object.keys(headerMapping).find(function(h) {
      return headerMapping[h] === col;
    });
    if (changedHeader && purchaseUrlCols.indexOf(changedHeader) !== -1) {
      try {
        const siteNameMap = EbayLib.getSiteNameMap(spreadsheetId);
        EbayLib.updateSiteNameForRow(sheet, row, headerMapping, siteNameMap);
      } catch(siteErr) {
        Logger.log('仕入元名自動判定エラー: ' + siteErr.toString());
      }
      return;
    }

    // その他の列は既存処理（タイトル文字数更新・ワード判定など）に委譲
    EbayLib.processOnEdit(e, spreadsheetId);

  } catch (error) {
    Logger.log('handleEdit エラー: ' + error.toString());
    try {
      SpreadsheetApp.getUi().alert(
        'エラー',
        '❌ 編集処理中にエラーが発生しました:\n' + error.toString(),
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (uiError) {
      // UI 表示自体が失敗した場合は握り潰す
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * 出品ステータス → "End" 時の取り下げ処理（handleEdit から呼び出す）
 *
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 * @param {Sheet} sheet
 * @param {Object} headerMapping  列名→1-based列番号のマップ
 * @param {number} row
 * @param {string} spreadsheetId
 */
function _handleEndListing(e, sheet, headerMapping, row, spreadsheetId) {
  const ui = SpreadsheetApp.getUi();

  const statusCol  = headerMapping['出品ステータス'] || headerMapping['ステータス'];
  const itemIdCol  = headerMapping['Item ID'];
  if (!itemIdCol) {
    Logger.log('⚠️ Item ID 列が見つかりません');
    return;
  }

  const itemId = String(sheet.getRange(row, itemIdCol).getValue() || '').trim();
  if (!itemId) {
    Logger.log('⚠️ Item IDが空のためスキップ: row=' + row);
    sheet.getRange(row, statusCol).setValue(e.oldValue || '出品中');
    return;
  }

  const titleCol = headerMapping['タイトル'];
  const title    = titleCol
    ? String(sheet.getRange(row, titleCol).getValue() || '')
    : '（タイトル不明）';

  const response = ui.alert(
    '出品取り下げ確認',
    'Item ID: ' + itemId + '\n商品名: ' + title + '\n\nこの出品を取り下げますか？',
    ui.ButtonSet.YES_NO
  );

  const statusCell = sheet.getRange(row, statusCol);

  if (response !== ui.Button.YES) {
    statusCell.setValue(e.oldValue || '出品中');
    return;
  }

  let result;
  try {
    result = EbayLib.endFixedPriceItem(spreadsheetId, itemId);
  } catch(libErr) {
    Logger.log('endFixedPriceItem エラー: ' + libErr.toString());
    statusCell.setValue(e.oldValue || '出品中');
    ui.alert('エラー', '❌ eBay接続エラー:\n' + libErr.toString(), ui.ButtonSet.OK);
    return;
  }

  if (result.success) {
    statusCell.setValue('出品終了');
    const endDateCol = headerMapping['取り下げ日時'];
    if (endDateCol) {
      sheet.getRange(row, endDateCol).setValue(
        Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
      );
    }
    Logger.log('✅ 取り下げ完了: Item ID=' + itemId + ' row=' + row);
  } else {
    statusCell.setValue(e.oldValue || '出品中');
    ui.alert('エラー', '❌ 取り下げに失敗しました:\n' + result.message, ui.ButtonSet.OK);
    Logger.log('❌ 取り下げ失敗: ' + result.message);
  }
}

function _handleOutOfStock(e, sheet, headerMapping, row, spreadsheetId) {
  const ui = SpreadsheetApp.getUi();
  const statusCol = headerMapping['出品ステータス'] || headerMapping['ステータス'];
  const itemIdCol = headerMapping['Item ID'];

  if (!itemIdCol) {
    Logger.log('⚠️ Item ID列が見つかりません');
    return;
  }

  const itemId = String(sheet.getRange(row, itemIdCol).getValue() || '').trim();
  if (!itemId) {
    if (statusCol) sheet.getRange(row, statusCol).setValue(e.oldValue || '出品中');
    return;
  }

  const titleCol = headerMapping['タイトル'];
  const title = titleCol
    ? String(sheet.getRange(row, titleCol).getValue() || '')
    : '（タイトル不明）';

  const response = ui.alert(
    '在庫切れ確認',
    'Item ID: ' + itemId + '\n商品名: ' + title + '\n\n' +
    'eBayの数量を0にして在庫切れにします。\n実行しますか？',
    ui.ButtonSet.YES_NO
  );

  const statusCell = sheet.getRange(row, statusCol);

  if (response !== ui.Button.YES) {
    statusCell.setValue(e.oldValue || '出品中');
    return;
  }

  try {
    let result;
    try {
      result = EbayLib.reviseQuantityToZero(spreadsheetId, row, itemId);
    } catch(libErr) {
      Logger.log('reviseQuantityToZero エラー: ' + libErr.toString());
      statusCell.setValue(e.oldValue || '出品中');
      ui.alert('エラー', '❌ eBay接続エラー:\n' + libErr.toString(), ui.ButtonSet.OK);
      return;
    }

    if (result.success) {
      statusCell.setValue('在庫切れ');
      const quantityCol = headerMapping['個数'];
      if (quantityCol) {
        sheet.getRange(row, quantityCol).setValue(0);
      }
      ui.alert('完了', '✅ eBayの数量を0にしました。\nItem ID: ' + itemId, ui.ButtonSet.OK);
      Logger.log('✅ 在庫切れ処理完了: Item ID=' + itemId);
    } else {
      statusCell.setValue(e.oldValue || '出品中');
      ui.alert('エラー', '❌ 在庫切れ処理に失敗しました:\n' + result.message, ui.ButtonSet.OK);
    }
  } catch(e2) {
    statusCell.setValue(e.oldValue || '出品中');
    ui.alert('エラー', '❌ エラー:\n' + e2.toString(), ui.ButtonSet.OK);
  }
}

/**
 * カテゴリID 列変更時の処理（handleEdit から呼び出す）
 *
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {number} row
 */
function _handleCategoryIdChange(e, spreadsheetId, sheetName, row) {
  const newCategoryId = String(e.value    !== undefined ? e.value    : '').trim();
  const oldCategoryId = String(e.oldValue !== undefined ? e.oldValue : '').trim();

  // 値が変わっていなければスキップ
  if (newCategoryId === oldCategoryId) return;

  const oldCategoryName = EbayLib.getCategoryNameById(spreadsheetId, oldCategoryId)
    || (oldCategoryId ? oldCategoryId : '（なし）');
  const newCategoryName = EbayLib.getCategoryNameById(spreadsheetId, newCategoryId)
    || (newCategoryId ? newCategoryId : '（不明）');

  const ui = SpreadsheetApp.getUi();

  // 確認ポップアップ
  const response = ui.alert(
    'カテゴリ変更確認',
    '現在: ' + oldCategoryId + ' (' + oldCategoryName + ')\n' +
    '変更先: ' + newCategoryId + ' (' + newCategoryName + ')\n\n' +
    'カテゴリを変更するとスペック情報が初期化されます。\n変更しますか？',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    const result = EbayLib.applyCategoryChange(spreadsheetId, sheetName, row, newCategoryId);

    // コンディション値が新カテゴリと非互換の場合は通知
    if (result && result.conditionIncompatible) {
      ui.alert(
        'コンディション再選択',
        '選択されていた「' + result.oldConditionValue + '」は新しいカテゴリでは使用できません。\n' +
        'プルダウンから再度選択してください。',
        ui.ButtonSet.OK
      );
    }

  } else {
    EbayLib.revertCategoryId(spreadsheetId, sheetName, row, oldCategoryId);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 権限承認・トリガー登録
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 【権限承認 + handleEdit トリガー登録】
 *
 * 初回セットアップ時に実行する。メニューまたは図形ボタンから呼び出す。
 *
 * 実行内容:
 *   1. スプレッドシート / ドライブ / 外部URL の権限を一括承認
 *   2. handleEdit トリガーを登録（既存トリガーがある場合はスキップ）
 */
function authorizeScript() {
  const ui = SpreadsheetApp.getUi();
  try {
    // ── 1. 権限承認 ────────────────────────────────────────────────
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.getRange('A1').getValue();
    const folders = DriveApp.getFolders();
    if (folders.hasNext()) { folders.next(); }
    UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });

    // ── 2. handleEdit トリガー登録（重複チェック付き）──────────────
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const existing = ScriptApp.getUserTriggers(ss).filter(function(t) {
      return t.getHandlerFunction() === 'handleEdit';
    });

    let triggerRegistered;
    if (existing.length > 0) {
      Logger.log('handleEdit トリガーは既に登録済みのためスキップ（' + existing.length + '件）');
      triggerRegistered = false;
    } else {
      ScriptApp.newTrigger('handleEdit')
        .forSpreadsheet(ss)
        .onEdit()
        .create();
      Logger.log('✅ handleEdit トリガーを新規登録しました');
      triggerRegistered = true;
    }

    ui.alert(
      '権限承認完了',
      '✅ すべての権限が正常に承認されました。\n\n' +
      (triggerRegistered
        ? '✅ handleEdit トリガーを新規登録しました。'
        : 'ℹ️ handleEdit トリガーはすでに登録済みのためスキップしました。'),
      ui.ButtonSet.OK
    );
    Logger.log('✅ authorizeScript 完了');

  } catch (error) {
    ui.alert('エラー', '❌ 権限承認中にエラーが発生しました:\n' + error.toString(), ui.ButtonSet.OK);
    Logger.log('❌ authorizeScript エラー: ' + error.toString());
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eBay OAuth 初回認証メニュー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 【⚙️ → OAuth認証URL生成】
 *
 * ツール設定シートの App ID / RuName を読んで認証URLを生成し、
 * モーダルダイアログに表示する。URLをコピーしてブラウザで開くよう案内する。
 */
function menuOAuthGenerateUrl() {
  const ui = SpreadsheetApp.getUi();
  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const config = EbayLib.getListingToolConfig(spreadsheetId);
    const appId  = String(config['App ID']  || '').trim();
    const ruName = String(config['RuName']  || '').trim();

    if (!appId)  throw new Error('ツール設定に App ID が設定されていません');
    if (!ruName) throw new Error('ツール設定に RuName が設定されていません');

    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      'https://api.ebay.com/oauth/api_scope/sell.marketing',
      'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.finances'
    ].join(' ');

    const authUrl = 'https://auth.ebay.com/oauth2/authorize?' +
      'client_id='     + encodeURIComponent(appId)  +
      '&response_type=code' +
      '&redirect_uri=' + encodeURIComponent(ruName) +
      '&scope='        + encodeURIComponent(scopes);

    const html = HtmlService.createHtmlOutput(
      '<p style="font-size:13px">以下のURLをブラウザで開いてeBayにサインインしてください。</p>' +
      '<textarea style="width:100%;height:80px;font-size:11px" onclick="this.select()">' + authUrl + '</textarea>' +
      '<p style="font-size:12px;color:#555">' +
      'サインイン後のリダイレクトURLに含まれる <code>code=</code> の値をコピーし、<br>' +
      '⚙️ → <strong>認証コードでトークン取得</strong> から貼り付けてください。</p>'
    ).setWidth(520).setHeight(210);
    ui.showModalDialog(html, 'eBay OAuth 認証URL');

  } catch (error) {
    ui.alert('エラー', '❌ 認証URL生成に失敗しました:\n' + error.toString(), ui.ButtonSet.OK);
    Logger.log('❌ menuOAuthGenerateUrl エラー: ' + error.toString());
  }
}

/**
 * 【⚙️ → 認証コードでトークン取得】
 *
 * ブラウザのリダイレクトURLから取得した認証コードを入力してもらい、
 * Access Token / Refresh Token を取得してツール設定シートに保存する。
 */
function menuOAuthExchangeCode() {
  const ui = SpreadsheetApp.getUi();

  const prompt = ui.prompt(
    'eBay 認証コード入力',
    'ブラウザのリダイレクトURLに含まれる code=XXX の値を貼り付けてください:',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  const code = prompt.getResponseText().trim();
  if (!code) {
    ui.alert('エラー', '認証コードが入力されていません。', ui.ButtonSet.OK);
    return;
  }

  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const config  = EbayLib.getListingToolConfig(spreadsheetId);
    const appId   = String(config['App ID']  || '').trim();
    const certId  = String(config['Cert ID'] || '').trim();
    const ruName  = String(config['RuName']  || '').trim();

    if (!appId || !certId) throw new Error('ツール設定に App ID / Cert ID が設定されていません');
    if (!ruName)           throw new Error('ツール設定に RuName が設定されていません');

    const credentials = Utilities.base64Encode(appId + ':' + certId);
    const payloadStr  =
      'grant_type=authorization_code' +
      '&code='         + code   +
      '&redirect_uri=' + ruName;

    const response = UrlFetchApp.fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method:  'post',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + credentials
      },
      payload:           payloadStr,
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('トークン取得失敗（HTTP ' + response.getResponseCode() + '）:\n' +
                      response.getContentText().substring(0, 300));
    }

    const result = JSON.parse(response.getContentText());
    _saveOAuthTokensToSheet_(result.access_token, result.refresh_token,
                              result.expires_in, result.refresh_token_expires_in);

    ui.alert(
      'トークン取得完了',
      '✅ Access Token / Refresh Token をツール設定シートに保存しました。\n\n' +
      'Access Token 有効期限: 約 ' + Math.floor(result.expires_in / 60) + ' 分\n' +
      'Refresh Token 有効期限: 約18ヶ月',
      ui.ButtonSet.OK
    );
    Logger.log('✅ menuOAuthExchangeCode 完了');

  } catch (error) {
    ui.alert('エラー', '❌ トークン取得に失敗しました:\n' + error.toString(), ui.ButtonSet.OK);
    Logger.log('❌ menuOAuthExchangeCode エラー: ' + error.toString());
  }
}

/**
 * ツール設定シートに Access Token / Refresh Token を保存する（container 専用）
 * A列のキー名で行を探して B列の値を上書きする。
 *
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {number} expiresIn           Access Token 有効期限（秒）
 * @param {number} refreshTokenExpiresIn Refresh Token 有効期限（秒）
 */
function _saveOAuthTokensToSheet_(accessToken, refreshToken, expiresIn, refreshTokenExpiresIn) {
  const ss            = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('ツール設定');
  if (!settingsSheet) throw new Error('ツール設定シートが見つかりません');

  const data     = settingsSheet.getDataRange().getValues();
  const headers  = data[0];
  const itemIdx  = headers.indexOf('項目');
  const valueIdx = headers.indexOf('値');
  if (itemIdx === -1 || valueIdx === -1) throw new Error('ツール設定シートに「項目」「値」列が見つかりません');

  const accessExpiry  = new Date(Date.now() + expiresIn * 1000);
  const refreshExpiry = refreshTokenExpiresIn
    ? new Date(Date.now() + refreshTokenExpiresIn * 1000)
    : null;

  const writeMap = {
    'User Token':           accessToken,
    'Refresh Token':        refreshToken,
    'Token Expiry':         accessExpiry.toISOString(),
    'Refresh Token Expiry': refreshExpiry ? refreshExpiry.toISOString() : ''
  };

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][itemIdx] || '').trim();
    if (writeMap.hasOwnProperty(key)) {
      settingsSheet.getRange(i + 1, valueIdx + 1).setValue(writeMap[key]);
      Logger.log('✅ ' + key + ' を更新しました');
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OAuth設定テスト関数（Apps Scriptエディタから実行）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function showOAuthTestGuide() {
  EbayLib.showTestGuide();
}

function testCheckOAuthSettings() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testCheckOAuthSettings(spreadsheetId);
}

function testGenerateAuthUrl() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testGenerateAuthUrl(spreadsheetId);
}

function testExchangeTokens(authorizationCode) {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testExchangeTokens(spreadsheetId, authorizationCode);
}

function testAutoRefresh() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testAutoRefresh(spreadsheetId);
}

function testGetPolicies() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.testGetPolicies(spreadsheetId);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// スペックURL変更ハンドラー（listing/container 専用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * スペックURL変更時の確認ダイアログ
 * YES → スペック取得・書き込み
 * NO  → スペックURL列をクリア
 *
 * @param {Sheet} sheet
 * @param {number} row
 * @param {Object} headerMapping
 * @param {string} specUrl
 */
function handleSpecUrlChangedInListing(sheet, row, headerMapping, specUrl) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'スペック取得確認',
    'このURLからスペック情報を取得して Item Specifics に反映しますか？\n\n' + specUrl,
    ui.ButtonSet.YES_NO
  );
  if (response === ui.Button.YES) {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    SpreadsheetApp.getActiveSpreadsheet().toast('スペック情報を取得中...', 'スペックURL', 8);
    try {
      const result = EbayLib.fetchAndWriteSpecForListing(spreadsheetId, sheet.getName(), row, specUrl, false);

      if (result.categoryMismatch) {
        const mismatchResponse = ui.alert(
          'カテゴリ不一致',
          '現在のカテゴリID: ' + result.currentCategoryId + '\n' +
          '取得したカテゴリID: ' + result.fetchedCategoryId + ' (' + result.fetchedCategoryName + ')\n\n' +
          '取得したカテゴリIDで上書きしますか？',
          ui.ButtonSet.YES_NO
        );
        if (mismatchResponse === ui.Button.YES) {
          const retryResult = EbayLib.fetchAndWriteSpecForListing(spreadsheetId, sheet.getName(), row, specUrl, true);
          if (retryResult.success) {
            SpreadsheetApp.getActiveSpreadsheet().toast(
              'Item Specifics を設定しました（' + retryResult.filledCount + '件の値）',
              '✅ スペック取得完了', 4
            );
          } else {
            ui.alert('スペック取得エラー', '❌ ' + retryResult.message, ui.ButtonSet.OK);
          }
        } else {
          const specUrlCol = headerMapping['スペックURL'];
          if (specUrlCol) sheet.getRange(row, specUrlCol).clearContent();
        }
      } else if (result.success) {
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Item Specifics を設定しました（' + result.filledCount + '件の値）',
          '✅ スペック取得完了', 4
        );
      } else {
        ui.alert('スペック取得エラー', '❌ ' + result.message, ui.ButtonSet.OK);
      }
    } catch (e) {
      ui.alert('スペック取得エラー', '❌ ' + e.toString(), ui.ButtonSet.OK);
    }
  } else {
    const specUrlCol = headerMapping['スペックURL'];
    if (specUrlCol) sheet.getRange(row, specUrlCol).clearContent();
  }
}

/**
 * 【在庫管理】セルスタCSV出力
 */
function menuExportSellstaCsv() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    'セルスタCSV出力',
    '条件: 出品ステータス=Active、出品URLあり、CSV列が空\n\n対象行をセルスタ_CSVシートに出力してダウンロードします。\n実行しますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (confirm !== ui.Button.OK) return;

  try {
    const result = EbayLib.exportSellstaCsv(spreadsheetId);

    if (!result.success) {
      ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
      return;
    }

    // バックエンドでセルスタ_CSVシートをクリア
    EbayLib.clearSellstaCsvSheet(spreadsheetId);

    // ダウンロードダイアログを表示
    const html = HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif; padding:16px;">' +
      '<p style="font-size:14px; margin:0 0 8px;">✅ ' + result.message + '</p>' +
      '<p style="font-size:12px; color:#555; margin:0 0 16px;">ファイル名: ' + result.fileName + '</p>' +
      '<a href="' + result.downloadUrl + '" target="_blank"' +
      '   style="display:inline-block; padding:10px 20px; background:#1a73e8; color:#fff;' +
      '          text-decoration:none; border-radius:4px; font-size:14px; margin-right:12px;">' +
      '📥 CSVをダウンロード</a>' +
      '<button onclick="google.script.host.close();"' +
      '   style="padding:10px 20px; font-size:14px; cursor:pointer;">OK</button>' +
      '</body></html>'
    ).setTitle('CSVダウンロード').setWidth(450).setHeight(130);

    SpreadsheetApp.getUi().showModalDialog(html, 'CSVダウンロード');

  } catch (e) {
    ui.alert('❌ エラー', e.toString(), ui.ButtonSet.OK);
  }
}

/**
 * ダウンロード完了後のシートクリア（HTMLから呼び出す）
 */
function menuClearSellstaCsvSheet() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  EbayLib.clearSellstaCsvSheet(spreadsheetId);
}

/**
 * 【在庫管理】仕入元名を一括更新
 */
function menuUpdatePurchaseSiteNames() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();
  const result = EbayLib.updatePurchaseSiteNames(spreadsheetId);
  ui.alert(result.success ? '完了' : 'エラー', result.message, ui.ButtonSet.OK);
}

/**
 * 【⚙️】シート情報更新（双方向同期）
 */
function menuSyncSheet() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(
    '<html><body style="font-family:sans-serif; padding:16px;">' +
    '<p style="font-size:11px; color:#d32f2f; margin-bottom:8px;">⚠️ <b>プルダウン管理</b>・<b>ツール設定</b> は他のシートより先に同期してください。先に同期しないと数式・プルダウンエラーが発生する場合があります。</p>' +
    '<p style="font-size:13px; font-weight:bold; margin-bottom:8px;">同期するシートを選択してください：</p>' +
    '<select id="sheetName" style="width:100%; padding:6px; font-size:13px; margin-bottom:12px;">' +
    EbayLib.getSyncTargetSheets().map(function(s) {
      return '<option value="' + s + '">' + s + '</option>';
    }).join('') +
    '</select>' +
    '<p style="font-size:13px; font-weight:bold; margin-bottom:8px;">同期の方向：</p>' +
    '<label style="display:block; margin-bottom:6px;">' +
    '  <input type="radio" name="direction" value="ss_to_db" checked>' +
    '  出品スプレッドシート → 出品DB' +
    '</label>' +
    '<label style="display:block; margin-bottom:16px;">' +
    '  <input type="radio" name="direction" value="db_to_ss">' +
    '  出品DB → 出品スプレッドシート' +
    '</label>' +
    '<button onclick="execute()" style="padding:8px 20px; background:#1a73e8; color:#fff; border:none; border-radius:4px; font-size:13px; cursor:pointer;">同期実行</button>' +
    '<button onclick="google.script.host.close()" style="margin-left:8px; padding:8px 20px; font-size:13px; cursor:pointer;">キャンセル</button>' +
    '<script>' +
    'function execute() {' +
    '  const sheet = document.getElementById("sheetName").value;' +
    '  const dir = document.querySelector("input[name=direction]:checked").value;' +
    '  const label = dir === "ss_to_db" ? "出品スプレッドシート → 出品DB" : "出品DB → 出品スプレッドシート";' +
    '  if (!confirm("「" + sheet + "」を\\n" + label + "\\nに上書きします。よろしいですか？")) return;' +
    '  google.script.run' +
    '    .withSuccessHandler(function(result) {' +
    '      const icon = result.success ? "✅" : "❌";' +
    '      const msg  = result.message.replace(/\\n/g, "<br>");' +
    '      document.body.innerHTML =' +
    '        "<div style=\\"display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:24px; box-sizing:border-box; text-align:center;\\">" +' +
    '        "<p style=\\"font-size:22px; margin:0 0 12px;\\">" + icon + "</p>" +' +
    '        "<p style=\\"font-size:13px; line-height:1.6; margin:0 0 20px;\\">" + msg + "</p>" +' +
    '        "<button onclick=\\"google.script.host.close()\\" style=\\"padding:8px 24px; background:#1a73e8; color:#fff; border:none; border-radius:4px; font-size:13px; cursor:pointer;\\">閉じる</button>" +' +
    '        "</div>";' +
    '    })' +
    '    .withFailureHandler(function(err) {' +
    '      document.body.innerHTML =' +
    '        "<div style=\\"display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:24px; box-sizing:border-box; text-align:center;\\">" +' +
    '        "<p style=\\"font-size:22px; margin:0 0 12px;\\">❌</p>" +' +
    '        "<p style=\\"font-size:13px; line-height:1.6; margin:0 0 20px;\\">エラー: " + err.message + "</p>" +' +
    '        "<button onclick=\\"google.script.host.close()\\" style=\\"padding:8px 24px; background:#1a73e8; color:#fff; border:none; border-radius:4px; font-size:13px; cursor:pointer;\\">閉じる</button>" +' +
    '        "</div>";' +
    '    })' +
    '    .menuSyncSheetExecute(sheet, dir);' +
    '}' +
    '</script>' +
    '</body></html>'
  ).setTitle('シート情報更新').setWidth(420).setHeight(320);

  ui.showModalDialog(html, 'シート情報更新');
}

/**
 * HTMLから呼び出される実行関数
 */
function menuSyncSheetExecute(sheetName, direction) {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  return EbayLib.syncSheet(spreadsheetId, sheetName, direction);
}

function menuUpdateKanriYmDropdown() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();
  try {
    const result = EbayLib.updateKanriYmDropdown(spreadsheetId);
    if (result.success) {
      ui.alert('✅ 完了', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
    }
  } catch(e) {
    ui.alert('❌ エラー', e.toString(), ui.ButtonSet.OK);
  }
}

function menuCalculateReward() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    '報酬計算',
    '報酬管理シートのA2で選択中の管理年月で報酬計算を実行します。\n実行しますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (response !== ui.Button.OK) return;

  try {
    const result = EbayLib.calculateReward(spreadsheetId);
    if (result.success) {
      ui.alert('✅ 完了', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
    }
  } catch(e) {
    ui.alert('❌ エラー', e.toString(), ui.ButtonSet.OK);
  }
}
