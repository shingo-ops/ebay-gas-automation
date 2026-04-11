/**
 * リサーチシート - リセット機能
 *
 * リサーチシートの特定フィールドをリセットする
 */

/**
 * リサーチシートの入力項目をリセット
 * 図形ボタン「リセット」に割り当てる関数
 *
 * リセット対象:
 * - リサーチ方法（C2）
 * - キーワード（D2）
 * - 目標利益率（E2）
 * - カテゴリ（H8）
 *
 * TODO: 以下の項目の位置を確認してください
 * - 下限価格$（セル位置不明）
 * - 上限価格$（セル位置不明）
 */
function resetResearchFields() {
  try {
    const ui = SpreadsheetApp.getUi();

    // 確認ダイアログを表示
    const response = ui.alert(
      'リサーチフィールドのリセット',
      '以下の項目をリセットします。よろしいですか？\n\n' +
      '・リサーチ方法\n' +
      '・キーワード\n' +
      '・目標利益率\n' +
      '・カテゴリ',
      ui.ButtonSet.YES_NO
    );

    // Noが選択された場合は中止
    if (response !== ui.Button.YES) {
      SpreadsheetApp.getActiveSpreadsheet().toast('リセットをキャンセルしました', 'リセット', 3);
      return;
    }

    // リサーチシートを取得
    const researchSheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);

    if (!researchSheet) {
      throw new Error('「' + SHEET_NAMES.RESEARCH + '」シートが見つかりません');
    }

    // リセット対象のセルをクリア
    const cellsToClear = [
      // トップ情報セクション（B1:E2）
      {
        row: RESEARCH_TOP_INFO.DATA_ROW,
        col: RESEARCH_TOP_INFO.COLUMNS.RESEARCH_METHOD.col,
        name: 'リサーチ方法'
      },
      {
        row: RESEARCH_TOP_INFO.DATA_ROW,
        col: RESEARCH_TOP_INFO.COLUMNS.KEYWORD.col,
        name: 'キーワード'
      },
      {
        row: RESEARCH_TOP_INFO.DATA_ROW,
        col: RESEARCH_TOP_INFO.COLUMNS.TARGET_PROFIT_RATE.col,
        name: '目標利益率'
      },
      // 商品リストセクション（B7:P8）
      {
        row: RESEARCH_ITEM_LIST.DATA_ROW,
        col: RESEARCH_ITEM_LIST.COLUMNS.CATEGORY_NAME.col,
        name: 'カテゴリ'
      }

      // TODO: 下限価格$、上限価格$の位置が確認できたら追加
      // 例:
      // {
      //   row: ?,
      //   col: ?,
      //   name: '下限価格$'
      // },
      // {
      //   row: ?,
      //   col: ?,
      //   name: '上限価格$'
      // }
    ];

    // セルをクリア
    cellsToClear.forEach(function(cell) {
      researchSheet.getRange(cell.row, cell.col).clearContent();
      Logger.log('クリア完了: ' + cell.name + ' (行' + cell.row + '列' + cell.col + ')');
    });

    // 完了メッセージ
    ui.alert(
      'リセット完了',
      'リサーチフィールドをリセットしました。\n\n' +
      'クリアした項目: ' + cellsToClear.length + '件',
      ui.ButtonSet.OK
    );

    Logger.log('リサーチフィールドのリセット完了: ' + cellsToClear.length + '件');

  } catch (error) {
    Logger.log('resetResearchFieldsエラー: ' + error.toString());
    SpreadsheetApp.getUi().alert('リセットエラー:\n\n' + error.toString());
  }
}
