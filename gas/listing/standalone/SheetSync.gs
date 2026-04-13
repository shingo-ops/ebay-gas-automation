/**
 * シート双方向同期機能（スタンドアロン）
 * container/Code.gs の ⚙️メニューから呼び出す
 */

// 同期対象シート名リスト（出品シートは絶対に含めない）
const SYNC_TARGET_SHEETS = [
  'Vero/禁止ワード',
  '状態_テンプレ',
  'Description_テンプレ',
  '担当者管理',
  'ポリシー管理',
  'ツール設定',
  'HARU_CSV',
  'セルスタ_CSV',
  'プルダウン管理'
];

// 絶対に触ってはいけないシート
const PROTECTED_SHEETS = ['出品'];

/**
 * シート同期実行
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @param {string} sheetName 同期するシート名
 * @param {string} direction 'ss_to_db' または 'db_to_ss'
 * @returns {{ success: boolean, message: string }}
 */
function syncSheet(spreadsheetId, sheetName, direction) {
  try {
    Logger.log('=== シート同期開始: ' + sheetName + ' / 方向: ' + direction + ' ===');

    // 保護シートチェック
    if (PROTECTED_SHEETS.indexOf(sheetName) !== -1) {
      return { success: false, message: '「' + sheetName + '」は同期対象外のシートです。' };
    }

    // 対象シートチェック
    if (SYNC_TARGET_SHEETS.indexOf(sheetName) === -1) {
      return { success: false, message: '「' + sheetName + '」は同期対象のシートではありません。' };
    }

    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    // 出品DBのIDを取得
    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;
    if (!outputDbId) {
      return { success: false, message: '出品DBが設定されていません。ツール設定を確認してください。' };
    }

    // 出品SS・出品DBを開く
    const sourceSS = direction === 'ss_to_db'
      ? getTargetSpreadsheet(spreadsheetId)
      : SpreadsheetApp.openById(outputDbId);
    const destSS   = direction === 'ss_to_db'
      ? SpreadsheetApp.openById(outputDbId)
      : getTargetSpreadsheet(spreadsheetId);

    const sourceLabel = direction === 'ss_to_db' ? '出品スプレッドシート' : '出品DB';
    const destLabel   = direction === 'ss_to_db' ? '出品DB' : '出品スプレッドシート';

    // コピー元シートを取得
    const sourceSheet = sourceSS.getSheetByName(sheetName);
    if (!sourceSheet) {
      return { success: false, message: sourceLabel + 'に「' + sheetName + '」シートが見つかりません。' };
    }

    // コピー先に既存シートがあれば削除（copyTo後にリネームするため先に除去）
    const existingDestSheet = destSS.getSheetByName(sheetName);
    if (existingDestSheet) {
      // シートが1枚しかない場合は削除できないためダミーシートを挿入
      if (destSS.getSheets().length === 1) {
        destSS.insertSheet('__temp__');
      }
      destSS.deleteSheet(existingDestSheet);
      Logger.log('既存の「' + sheetName + '」シートを削除しました');
    }

    // copyTo() で完全コピー（列幅・行高さ・書式・数式・プルダウン・結合すべて引き継ぎ）
    const copiedSheet = sourceSheet.copyTo(destSS);
    copiedSheet.setName(sheetName);
    Logger.log('✅ copyTo() 完了: 「' + copiedSheet.getName() + '」');

    // ダミーシートが残っていれば削除
    const tempSheet = destSS.getSheetByName('__temp__');
    if (tempSheet) destSS.deleteSheet(tempSheet);

    const lastRow = sourceSheet.getLastRow();
    const lastCol = sourceSheet.getLastColumn();

    return {
      success: true,
      message: '「' + sheetName + '」を ' + sourceLabel + ' → ' + destLabel + ' に同期しました。\n' +
               '列幅・行高さ・書式・数式をすべて引き継ぎました。\n（' + lastRow + '行 × ' + lastCol + '列）'
    };

  } catch (e) {
    Logger.log('❌ シート同期エラー: ' + e.toString());
    return { success: false, message: 'シート同期エラー: ' + e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 同期対象シートリストを返す（container側のHTML生成用）
 */
function getSyncTargetSheets() {
  return SYNC_TARGET_SHEETS;
}

/**
 * 出品DBの管理年月列から一意の値を取得してプルダウンを設定
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @returns {{ success: boolean, message: string }}
 */
function updateKanriYmDropdown(spreadsheetId) {
  try {
    Logger.log('=== 管理年月プルダウン更新開始 ===');
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    // 出品DBを開く
    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;
    if (!outputDbId) {
      return { success: false, message: '出品DBが設定されていません。' };
    }
    const outputSS = SpreadsheetApp.openById(outputDbId);

    // 出品DBの「出品」シートから管理年月を取得
    const outputSheet = outputSS.getSheetByName('出品');
    if (!outputSheet) {
      return { success: false, message: '出品DBに「出品」シートが見つかりません。' };
    }

    const lastRow = outputSheet.getLastRow();
    const lastCol = outputSheet.getLastColumn();
    const headerRow = outputSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerMap = {};
    headerRow.forEach(function(h, i) { if (h) headerMap[String(h).trim()] = i; });

    const ymIdx = headerMap['管理年月'];
    if (ymIdx === undefined) {
      return { success: false, message: '出品DBに「管理年月」列が見つかりません。' };
    }

    // 2行目以降から管理年月を取得して一意化・降順ソート
    const ymSet = {};
    if (lastRow >= 2) {
      const ymValues = outputSheet.getRange(2, ymIdx + 1, lastRow - 1, 1).getValues();
      ymValues.forEach(function(row) {
        const val = String(row[0] || '').trim();
        if (val && val !== '') ymSet[val] = true;
      });
    }

    const ymList = Object.keys(ymSet).sort(function(a, b) {
      return parseInt(b) - parseInt(a); // 降順（新しい年月が上）
    });

    if (ymList.length === 0) {
      return { success: false, message: '管理年月のデータが見つかりません。' };
    }

    Logger.log('管理年月リスト: ' + ymList.join(', '));

    // 出品DBの「報酬管理」シートを取得または作成
    let kanriSheet = outputSS.getSheetByName('報酬管理');
    if (!kanriSheet) {
      kanriSheet = outputSS.insertSheet('報酬管理');
      Logger.log('✅ 「報酬管理」シートを新規作成しました');
    }

    // A1にヘッダーがなければ設定
    if (!kanriSheet.getRange('A1').getValue()) {
      kanriSheet.getRange('A1').setValue('管理年月');
      kanriSheet.getRange('A1').setFontWeight('bold').setBackground('#D5E8F0');
    }

    // A2にプルダウンを設定
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(ymList, true)
      .setAllowInvalid(false)
      .build();
    kanriSheet.getRange('A2').setDataValidation(rule);

    // 現在値が未設定なら最新年月をデフォルト設定
    const currentVal = kanriSheet.getRange('A2').getValue();
    if (!currentVal) {
      kanriSheet.getRange('A2').setValue(ymList[0]);
    }

    Logger.log('✅ 管理年月プルダウン更新完了: ' + ymList.length + '件');

    return {
      success: true,
      message: '管理年月プルダウンを更新しました。\n' + ymList.length + '件: ' + ymList.join(', ')
    };

  } catch(e) {
    Logger.log('❌ 管理年月プルダウン更新エラー: ' + e.toString());
    return { success: false, message: 'エラー: ' + e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}
