/**
 * リサーチシート スタンドアロン - PoC (概念実証) 検証関数
 *
 * Phase 2 の3点を検証する最小限の実装。
 * Phase 2 完了・確認後にこのファイルは削除する。
 *
 * 検証1: SpreadsheetApp.openById() で正しいシートを開けるか
 * 検証2: Return Object パターンが正常に動作するか
 * 検証3: ScriptProperties を引数で渡すパターンが動作するか
 */

/**
 * 検証1: openById() で正しいスプレッドシートを開けるか
 *
 * @param {string} spreadsheetId 対象スプレッドシートID
 * @returns {{ success: boolean, message: string }}
 */
function pocOpenById(spreadsheetId) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    return {
      success: true,
      message: '✅ openById 成功\nシート名: ' + ss.getName() + '\nID: ' + ss.getId()
    };
  } catch (e) {
    return {
      success: false,
      message: '❌ openById 失敗: ' + e.toString()
    };
  }
}

/**
 * 検証2: Return Object パターン
 * getTargetSpreadsheetResearch() を経由してシートを開き、結果をオブジェクトで返す。
 *
 * @param {string} spreadsheetId 対象スプレッドシートID
 * @returns {{ success: boolean, message: string }}
 */
function pocReturnObject(spreadsheetId) {
  try {
    const ss = getTargetSpreadsheetResearch(spreadsheetId);
    const sheetCount = ss.getSheets().length;
    return {
      success: true,
      message: '✅ Return Object パターン確認\nシート名: ' + ss.getName() + '\nシート数: ' + sheetCount
    };
  } catch (e) {
    return {
      success: false,
      message: '❌ Return Object 失敗: ' + e.toString()
    };
  }
}

/**
 * 検証3: ScriptProperties を引数で渡すパターン
 * バインドスクリプト側の PropertiesService.getScriptProperties().getProperties() を
 * プレーンオブジェクトとして受け取り、ライブラリ側はストレージにアクセスしない。
 *
 * @param {string} spreadsheetId 対象スプレッドシートID
 * @param {{ [key: string]: string }} propsData バインド側のScriptPropertiesの内容
 * @returns {{ success: boolean, message: string }}
 */
function pocProperties(spreadsheetId, propsData) {
  try {
    const token = propsData.EBAY_ACCESS_TOKEN || '(未設定)';
    const expiry = propsData.EBAY_TOKEN_EXPIRY || '(未設定)';
    return {
      success: true,
      message: '✅ Props引数渡し確認\n' +
               'EBAY_ACCESS_TOKEN 長: ' + token.length + '文字\n' +
               'EBAY_TOKEN_EXPIRY: ' + expiry
    };
  } catch (e) {
    return {
      success: false,
      message: '❌ Props引数渡し失敗: ' + e.toString()
    };
  }
}
