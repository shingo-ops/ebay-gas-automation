/**
 * シート双方向同期機能（スタンドアロン）
 * container/Code.gs の ⚙️メニューから呼び出す
 */

// 同期対象シート名リスト（出品シートは絶対に含めない）
// ※ プルダウン管理・ツール設定は他のシートが参照するため必ず最初に同期すること
const SYNC_TARGET_SHEETS = [
  'プルダウン管理',
  'ツール設定',
  'Vero/禁止ワード',
  '状態_テンプレ',
  'Description_テンプレ',
  '担当者管理',
  'ポリシー管理',
  'HARU_CSV',
  'セルスタ_CSV'
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

    const tempName = '_sync_temp_' + sheetName + '_' + Date.now();
    let copiedSheet = null;

    try {
      // 1. 一時名でコピー（copyTo成功を確認してから既存シートを削除）
      copiedSheet = sourceSheet.copyTo(destSS);
      copiedSheet.setName(tempName);
      Logger.log('✅ copyTo() 完了（一時名: ' + tempName + '）');

      // 2. 既存シートを削除（コピー成功後なのでデータロスなし）
      const existingDestSheet = destSS.getSheetByName(sheetName);
      if (existingDestSheet) {
        // シートが1枚しかない場合は削除できないためダミーシートを挿入
        if (destSS.getSheets().length === 1) {
          destSS.insertSheet('__temp__');
        }
        destSS.deleteSheet(existingDestSheet);
        Logger.log('既存の「' + sheetName + '」シートを削除しました');
      }

      // ダミーシートが残っていれば削除
      const tempSheet = destSS.getSheetByName('__temp__');
      if (tempSheet) destSS.deleteSheet(tempSheet);

      // 3. 一時名を正式名にリネーム
      copiedSheet.setName(sheetName);
      Logger.log('✅ リネーム完了: 「' + sheetName + '」');

      const lastRow = sourceSheet.getLastRow();
      const lastCol = sourceSheet.getLastColumn();

      return {
        success: true,
        message: '「' + sheetName + '」を ' + sourceLabel + ' → ' + destLabel + ' に同期しました。\n' +
                 '列幅・行高さ・書式・数式をすべて引き継ぎました。（' + lastRow + '行 × ' + lastCol + '列）\n\n' +
                 '⚠️ 数式やプルダウンが他のシートを参照している場合、同期先でエラーになることがあります。\n' +
                 'まだ「プルダウン管理」「ツール設定」を同期していない場合は先に同期してください。'
      };

    } catch (syncErr) {
      // コピーは成功したが削除 or リネームで失敗した場合、一時シートを掃除
      if (copiedSheet) {
        try {
          destSS.deleteSheet(copiedSheet);
          Logger.log('一時シートを削除しました: ' + tempName);
        } catch (cleanupErr) {
          Logger.log('一時シート削除失敗: ' + cleanupErr.toString());
        }
      }
      throw syncErr;
    }

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
        // 「管理年月」というヘッダー文字列および空値を除外
        if (val && val !== '' && val !== '管理年月') ymSet[val] = true;
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

/**
 * 報酬計算メイン処理
 * 報酬管理シートA2の管理年月をもとに出品DBから作業件数を集計して出力
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @returns {{ success: boolean, message: string }}
 */
function calculateReward(spreadsheetId) {
  try {
    Logger.log('=== 報酬計算開始 ===');
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;
    if (!outputDbId) {
      return { success: false, message: '出品DBが設定されていません。' };
    }
    const outputSS = SpreadsheetApp.openById(outputDbId);

    // ① 報酬管理シートを取得
    const rewardSheet = outputSS.getSheetByName('報酬管理');
    if (!rewardSheet) {
      return { success: false, message: '出品DBに「報酬管理」シートが見つかりません。' };
    }

    // ② A2の管理年月を取得
    const targetYm = String(rewardSheet.getRange('A2').getValue() || '').trim();
    if (!targetYm) {
      return { success: false, message: '管理年月が選択されていません。A2のプルダウンで管理年月を選択してください。' };
    }
    Logger.log('対象管理年月: ' + targetYm);

    // ③ 報酬管理シートのヘッダーマッピングを取得（1行目）
    const rewardLastCol = rewardSheet.getLastColumn();
    const rewardHeaders = rewardSheet.getRange(1, 1, 1, rewardLastCol).getValues()[0];
    const rewardHeaderMap = {};
    rewardHeaders.forEach(function(h, i) {
      if (h) rewardHeaderMap[String(h).trim()] = i + 1; // 1-based
    });

    // 担当者名列を特定
    const staffNameCol = rewardHeaderMap['担当者名'];
    if (!staffNameCol) {
      return { success: false, message: '報酬管理シートに「担当者名」列が見つかりません。' };
    }

    // ④ 担当者管理シートから業務名・担当者を動的に取得
    const staffSheet = outputSS.getSheetByName('担当者管理');
    if (!staffSheet) {
      return { success: false, message: '出品DBに「担当者管理」シートが見つかりません。' };
    }

    const staffLastRow = staffSheet.getLastRow();
    const staffLastCol = staffSheet.getLastColumn();

    // 担当者管理シートの全ヘッダーを1行目から取得
    const staffHeaders = staffSheet.getRange(1, 1, 1, staffLastCol).getValues()[0];

    // D-K列相当を「〇〇単価」ヘッダーで動的に特定
    // 列番号ではなくヘッダー名で検索するため列がずれても対応可能
    const tankaColIndices = []; // 単価列の列インデックス（0-based）
    const taskNames = [];       // 業務名リスト（「単価」を除去）

    staffHeaders.forEach(function(h, i) {
      const header = String(h || '').trim();
      if (header.endsWith('単価') && header !== '単価') {
        const taskName = header.replace('単価', '').trim();
        if (taskName) {
          tankaColIndices.push(i);
          taskNames.push(taskName);
          Logger.log('単価列検出: ' + header + ' → 業務名: ' + taskName + ' （列' + (i + 1) + '）');
        }
      }
    });

    if (taskNames.length === 0) {
      return { success: false, message: '担当者管理シートに「〇〇単価」形式のヘッダーが見つかりません。\nD-K列の1行目を確認してください。' };
    }
    Logger.log('業務名リスト（単価列から取得）: ' + taskNames.join(', '));

    // P-W列相当を「〇〇」業務名で動的に特定（担当者名が入っている列）
    const staffColIndices = []; // 担当者列の列インデックス（0-based）
    taskNames.forEach(function(taskName) {
      const colIdx = staffHeaders.findIndex(function(h) {
        return String(h || '').trim() === taskName;
      });
      if (colIdx !== -1) {
        staffColIndices.push(colIdx);
        Logger.log('担当者列検出: ' + taskName + ' → 列' + (colIdx + 1));
      } else {
        Logger.log('⚠️ 担当者管理シートに「' + taskName + '」列が見つかりません');
        staffColIndices.push(-1);
      }
    });

    // 担当者管理シートの全データを取得
    const staffAllData = staffSheet.getRange(1, 1, staffLastRow, staffLastCol).getValues();

    // 2行目以降から各業務のスタッフ名リストを取得
    const staffByTask = {};
    taskNames.forEach(function(name) { staffByTask[name] = []; });

    for (let r = 1; r < staffAllData.length; r++) {
      taskNames.forEach(function(taskName, idx) {
        const colIdx = staffColIndices[idx];
        if (colIdx === -1) return;
        const staffName = String(staffAllData[r][colIdx] || '').trim();
        if (staffName) staffByTask[taskName].push(staffName);
      });
    }

    // ⑤ 出品DBの「出品」シートから対象管理年月の行を抽出
    const outputSheet = outputSS.getSheetByName('出品');
    if (!outputSheet) {
      return { success: false, message: '出品DBに「出品」シートが見つかりません。' };
    }

    const outLastRow = outputSheet.getLastRow();
    const outLastCol = outputSheet.getLastColumn();
    const outHeaders = outputSheet.getRange(1, 1, 1, outLastCol).getValues()[0];
    const outHeaderMap = {};
    outHeaders.forEach(function(h, i) { if (h) outHeaderMap[String(h).trim()] = i; });

    // 管理年月列のインデックス取得
    const ymIdx = outHeaderMap['管理年月'];
    if (ymIdx === undefined) {
      return { success: false, message: '出品シートに「管理年月」列が見つかりません。' };
    }

    // 出品シートの担当列を業務名の順序に合わせて動的マッピング
    // リサーチ担当・担当1〜7 を業務名の順序に対応
    const assignCols = ['リサーチ担当','担当1','担当2','担当3','担当4','担当5','担当6','担当7'];
    const taskColIndices = taskNames.map(function(taskName, idx) {
      const colName = assignCols[idx] || '';
      const colIdx = outHeaderMap[colName];
      if (colIdx === undefined) {
        Logger.log('⚠️ 出品シートに「' + colName + '」列が見つかりません');
        return -1;
      }
      Logger.log('出品列マッピング: ' + taskName + ' → ' + colName + '（列' + (colIdx + 1) + '）');
      return colIdx;
    });

    // 対象管理年月の行を全取得
    if (outLastRow < 2) {
      return { success: false, message: '出品シートにデータがありません。' };
    }
    const outData = outputSheet.getRange(2, 1, outLastRow - 1, outLastCol).getValues();

    // ⑥ 担当者ごと・業務ごとの作業件数を集計
    // counts = { "田中": { "リサーチ": 3, "タイトル": 2, ... }, ... }
    const counts = {};

    outData.forEach(function(row) {
      const ym = String(row[ymIdx] || '').trim();
      if (ym !== targetYm) return;

      // 各業務列を走査
      taskNames.forEach(function(taskName, taskIdx) {
        if (!taskName) return;
        const colIdx = taskColIndices[taskIdx];
        if (colIdx === -1) return;

        const staffName = String(row[colIdx] || '').trim();
        if (!staffName) return;

        if (!counts[staffName]) counts[staffName] = {};
        counts[staffName][taskName] = (counts[staffName][taskName] || 0) + 1;
      });
    });

    Logger.log('集計結果: ' + JSON.stringify(counts));

    // ⑦ 報酬管理シートに件数を書き込む
    // 担当者名列から担当者を特定して該当行の件数列に書き込む
    const rewardLastRow = rewardSheet.getLastRow();
    if (rewardLastRow < 2) {
      return { success: false, message: '報酬管理シートにデータ行がありません。' };
    }

    const rewardData = rewardSheet.getRange(2, 1, rewardLastRow - 1, rewardLastCol).getValues();
    let writeCount = 0;

    rewardData.forEach(function(row, rowIdx) {
      const staffName = String(row[staffNameCol - 1] || '').trim();
      if (!staffName) return;

      const staffCounts = counts[staffName] || {};

      // 各業務の件数列（{業務名}件数）に書き込む
      taskNames.forEach(function(taskName) {
        if (!taskName) return;
        const headerName = taskName + '件数';
        const colNum = rewardHeaderMap[headerName];
        if (!colNum) return;

        const count = staffCounts[taskName] || 0;
        rewardSheet.getRange(rowIdx + 2, colNum).setValue(count);
      });

      writeCount++;
    });

    Logger.log('✅ 報酬計算完了: ' + writeCount + '名分を書き込みました');

    return {
      success: true,
      message: '管理年月「' + targetYm + '」の報酬計算が完了しました。\n' +
               writeCount + '名分の件数を更新しました。'
    };

  } catch(e) {
    Logger.log('❌ 報酬計算エラー: ' + e.toString());
    return { success: false, message: '報酬計算エラー: ' + e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}
