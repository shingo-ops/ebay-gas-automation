/**
 * セルスタCSV出力機能（スタンドアロン）
 * container/Code.gs の EbayLib.exportSellstaCsv() から呼び出す
 */

// セルスタCSVの必須ヘッダー定義
const SELLSTA_CSV_HEADERS = [
  'action', 'ebay_item_id', 'Item title',
  'image_url1','image_url2','image_url3','image_url4','image_url5','image_url6',
  'image_url7','image_url8','image_url9','image_url10','image_url11','image_url12',
  'image_url13','image_url14','image_url15','image_url16','image_url17','image_url18',
  'image_url19','image_url20','image_url21','image_url22','image_url23','image_url24',
  '①仕入先情報','②仕入先情報','③仕入先情報',
  'Custom label (SKU)','Condition','Condition description',
  'Item Code type','Item Code','CategoryID','Item Specifics',
  'ListingType','Duration','Selling Price',
  'Best Offers（accept offers of at least）','Best Offers（decline offers lower than）',
  'Quantity','Store Category','Shipping Policy','Payment Policy','Return Policy',
  'Private Listing','Description','listing_date','Memo','Custom Link'
];

/**
 * セルスタCSV出力メイン処理
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @returns {{ success: boolean, message: string, downloadUrl: string, fileName: string }}
 */
function exportSellstaCsv(spreadsheetId) {
  try {
    Logger.log('=== セルスタCSV出力開始 ===');
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    // 出品DBを開く
    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;
    if (!outputDbId) {
      return { success: false, message: '出品DBが設定されていません。ツール設定を確認してください。' };
    }
    const outputSS    = SpreadsheetApp.openById(outputDbId);
    const outputSheet = outputSS.getSheetByName('出品');
    if (!outputSheet) {
      return { success: false, message: '出品DBに「出品」シートが見つかりません。' };
    }

    // 出品DBのヘッダーマッピング
    const lastCol = outputSheet.getLastColumn();
    const lastRow = outputSheet.getLastRow();
    const dbHeaderRow = outputSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const dbMap = {};
    dbHeaderRow.forEach(function(h, i) { if (h) dbMap[String(h).trim()] = i; });

    // 必須列の存在チェック
    const requiredDbCols = ['出品ステータス', '出品URL', 'CSV', 'Item ID', 'タイトル',
      'カテゴリID', '状態', '売値($)', '個数', 'Shipping Policy', 'Payment Policy', 'Return Policy'];
    const missingDbCols = requiredDbCols.filter(function(c) { return dbMap[c] === undefined; });
    if (missingDbCols.length > 0) {
      return { success: false, message: '出品DBに以下の列が見つかりません:\n' + missingDbCols.join('\n') };
    }

    // セルスタ_CSVシートのヘッダーチェック
    const csvSheet = outputSS.getSheetByName('セルスタ_CSV');
    if (!csvSheet) {
      return { success: false, message: '出品DBに「セルスタ_CSV」シートが見つかりません。' };
    }
    const csvLastCol   = csvSheet.getLastColumn();
    const csvHeaderRow = csvSheet.getRange(1, 1, 1, Math.max(csvLastCol, 1)).getValues()[0];
    const csvMap       = {};
    csvHeaderRow.forEach(function(h, i) { if (h) csvMap[String(h).trim()] = i + 1; }); // 1-based

    // セルスタ_CSVシートの必須ヘッダー存在チェック
    const missingCsvHeaders = SELLSTA_CSV_HEADERS.filter(function(h) { return csvMap[h] === undefined; });
    if (missingCsvHeaders.length > 0) {
      return {
        success: false,
        message: '「セルスタ_CSV」シートに以下のヘッダーが見つかりません:\n' + missingCsvHeaders.join('\n')
      };
    }
    Logger.log('ヘッダーチェック完了');

    // データ行を全取得（5行目以降）
    if (lastRow < 5) {
      return { success: false, message: '出品DBにデータがありません（5行目以降にデータが必要）。' };
    }
    const dataValues  = outputSheet.getRange(5, 1, lastRow - 4, lastCol).getValues();
    const dataDisplay = outputSheet.getRange(5, 1, lastRow - 4, lastCol).getDisplayValues();

    // Conditionマッピングを構築
    const conditionMap = buildConditionMap(spreadsheetId);

    // フィルタ: 出品ステータス=Active & 出品URL≠空 & CSV=空
    const statusIdx = dbMap['出品ステータス'];
    const urlIdx    = dbMap['出品URL'];
    const csvIdx    = dbMap['CSV'];

    const targetRows = []; // { rowIndex: (5始まりの実際の行番号), disp: [] }
    dataValues.forEach(function(row, i) {
      const status = String(row[statusIdx] || '').trim();
      const url    = String(row[urlIdx]    || '').trim();
      const csv    = String(row[csvIdx]    || '').trim();
      if (status === 'Active' && url !== '' && csv === '') {
        targetRows.push({ rowIndex: i + 5, disp: dataDisplay[i] });
      }
    });

    Logger.log('対象行数: ' + targetRows.length + '件');
    if (targetRows.length === 0) {
      return { success: false, message: '出力対象のデータがありません。\n条件: 出品ステータス=Active、出品URLあり、CSV列が空' };
    }

    // セルスタ_CSVシートの既存データの最終行を取得（追記位置）
    const csvSheetLastRow = csvSheet.getLastRow();
    let writeRow = csvSheetLastRow < 1 ? 2 : csvSheetLastRow + 1;
    // 1行目はヘッダーなので最低2行目から
    if (writeRow < 2) writeRow = 2;

    // 各対象行を変換してシートに追記
    const now     = new Date();
    const csvMark = 'セルスタ/' + formatTimestampForCsv(now);
    const writtenDbRows = []; // CSV列を更新する行番号リスト

    targetRows.forEach(function(target) {
      const disp = target.disp;

      // 各フィールドを変換
      const imageUrls     = buildImageUrls(disp, dbMap);
      const itemSpecifics = buildItemSpecifics(disp, dbMap);
      const categoryId    = getCellDisplay(disp, dbMap, 'カテゴリID');
      const conditionJa   = getCellDisplay(disp, dbMap, '状態');
      const conditionId   = resolveConditionId(categoryId, conditionJa, conditionMap);
      const itemCode      = resolveItemCode(disp, dbMap);
      const listingDate   = convertTimestamp(getCellDisplay(disp, dbMap, '出品タイムスタンプ'));

      // セルスタ_CSV形式の行データを組み立て（ヘッダー名→列番号でセット）
      const rowData = {};
      rowData['action']           = 'Revise';
      rowData['ebay_item_id']     = getCellDisplay(disp, dbMap, 'Item ID');
      rowData['Item title']       = getCellDisplay(disp, dbMap, 'タイトル');
      imageUrls.forEach(function(url, i) {
        rowData['image_url' + (i + 1)] = url;
      });
      rowData['①仕入先情報']      = getCellDisplay(disp, dbMap, '仕入元URL①');
      rowData['②仕入先情報']      = getCellDisplay(disp, dbMap, '仕入元URL②');
      rowData['③仕入先情報']      = getCellDisplay(disp, dbMap, '仕入元URL③');
      rowData['Custom label (SKU)'] = getCellDisplay(disp, dbMap, '仕入れキーワード');
      rowData['Condition']         = conditionId;
      rowData['Condition description'] = getCellDisplay(disp, dbMap, '状態説明');
      rowData['Item Code type']    = itemCode.type;
      rowData['Item Code']         = itemCode.code;
      rowData['CategoryID']        = categoryId;
      rowData['Item Specifics']    = itemSpecifics;
      rowData['ListingType']       = 'fixed_price';
      rowData['Duration']          = 'gtc';
      rowData['Selling Price']     = getCellDisplay(disp, dbMap, '売値($)');
      rowData['Best Offers（accept offers of at least）'] = getCellDisplay(disp, dbMap, '承認価格');
      rowData['Best Offers（decline offers lower than）'] = getCellDisplay(disp, dbMap, '拒否価格');
      rowData['Quantity']          = getCellDisplay(disp, dbMap, '個数');
      rowData['Store Category']    = '1';
      rowData['Shipping Policy']   = getCellDisplay(disp, dbMap, 'Shipping Policy');
      rowData['Payment Policy']    = getCellDisplay(disp, dbMap, 'Payment Policy');
      rowData['Return Policy']     = getCellDisplay(disp, dbMap, 'Return Policy');
      rowData['Private Listing']   = 'TRUE';
      rowData['Description']       = getCellDisplay(disp, dbMap, 'Description');
      rowData['listing_date']      = listingDate;
      rowData['Memo']              = getCellDisplay(disp, dbMap, 'メモ');
      rowData['Custom Link']       = getCellDisplay(disp, dbMap, '検索URL');

      // csvMapを使ってシートの正しい列に書き込む
      SELLSTA_CSV_HEADERS.forEach(function(header) {
        const colNum = csvMap[header];
        if (!colNum) return;
        const val = rowData[header] !== undefined ? rowData[header] : '';
        csvSheet.getRange(writeRow, colNum).setValue(val);
      });

      writtenDbRows.push(target.rowIndex);
      writeRow++;
    });

    Logger.log('セルスタ_CSVシート書き込み完了: ' + writtenDbRows.length + '件');

    // 出品DBのCSV列にタイムスタンプを書き込む
    writtenDbRows.forEach(function(rowNum) {
      outputSheet.getRange(rowNum, csvIdx + 1).setValue(csvMark);
    });
    Logger.log('CSV列更新完了: ' + csvMark);

    // GoogleドライブにCSVバックアップを保存
    const csvContent  = buildCsvContent(csvSheet);
    const fileName    = 'sellsta_' + formatDateForFilename(now) + '.csv';
    const folder      = getOrCreateBackupFolder();
    const bom         = '\uFEFF';
    const blob        = Utilities.newBlob(bom + csvContent, 'text/csv', fileName);
    const file        = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const downloadUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();

    Logger.log('✅ バックアップ保存完了: ' + downloadUrl);

    return {
      success:     true,
      message:     writtenDbRows.length + '件のデータを出力しました。',
      downloadUrl: downloadUrl,
      fileName:    fileName
    };

  } catch (e) {
    Logger.log('❌ CSV出力エラー: ' + e.toString());
    return { success: false, message: 'CSV出力エラー: ' + e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * ダウンロード完了後にセルスタ_CSVシートをクリア（ヘッダー行は保持）
 * container/Code.gs から呼び出す
 */
function clearSellstaCsvSheet(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    const config   = getEbayConfig();
    const outputSS = SpreadsheetApp.openById(config.outputDbSpreadsheetId);
    const csvSheet = outputSS.getSheetByName('セルスタ_CSV');
    if (!csvSheet) return;
    const lastRow = csvSheet.getLastRow();
    if (lastRow > 1) {
      csvSheet.getRange(2, 1, lastRow - 1, csvSheet.getLastColumn()).clearContent();
    }
    Logger.log('✅ セルスタ_CSVシートクリア完了');
  } catch (e) {
    Logger.log('⚠️ クリアエラー: ' + e.toString());
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * セルスタ_CSVシートの内容をCSV文字列に変換
 */
function buildCsvContent(csvSheet) {
  const lastRow = csvSheet.getLastRow();
  const lastCol = csvSheet.getLastColumn();
  if (lastRow < 1) return '';
  const values = csvSheet.getRange(1, 1, lastRow, lastCol).getValues();
  return values.map(function(row) {
    return row.map(function(cell) {
      const val = String(cell === null || cell === undefined ? '' : cell);
      if (val.indexOf(',') !== -1 || val.indexOf('\n') !== -1 || val.indexOf('"') !== -1) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',');
  }).join('\n');
}

/**
 * バックアップ用フォルダを取得
 * ツール設定の「CSVデータフォルダ」URLからフォルダIDを取得して開く
 * 未設定時はマイドライブ直下に「セルスタCSVバックアップ」フォルダを作成
 */
function getOrCreateBackupFolder() {
  const config   = getEbayConfig();
  const folderId = config.csvBackupFolderId;
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log('⚠️ CSVデータフォルダが見つかりません（ID=' + folderId + '）。フォールバックフォルダを使用します。');
    }
  }
  // フォールバック: フォルダ名で検索または作成
  const folderName = 'セルスタCSVバックアップ';
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

/**
 * CSV列用タイムスタンプ: "2026-04-13 9:21"
 */
function formatTimestampForCsv(date) {
  const y   = date.getFullYear();
  const m   = String(date.getMonth() + 1).padStart(2, '0');
  const d   = String(date.getDate()).padStart(2, '0');
  const h   = date.getHours(); // 先頭0なし
  const min = String(date.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + d + ' ' + h + ':' + min;
}

/**
 * ファイル名用日時: "20260413_122530"
 */
function formatDateForFilename(date) {
  const y   = date.getFullYear();
  const m   = String(date.getMonth() + 1).padStart(2, '0');
  const d   = String(date.getDate()).padStart(2, '0');
  const h   = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s   = String(date.getSeconds()).padStart(2, '0');
  return y + m + d + '_' + h + min + s;
}

// ===== 以下は前バージョンから継続のヘルパー関数 =====

function getCellDisplay(disp, dbMap, colName) {
  const idx = dbMap[colName];
  if (idx === undefined) return '';
  const val = disp[idx];
  return (val === null || val === undefined) ? '' : String(val);
}

function buildImageUrls(disp, dbMap) {
  const urls = [];
  for (let i = 1; i <= 23; i++) {
    const url = getCellDisplay(disp, dbMap, '画像' + i).trim();
    if (url) urls.push(url);
  }
  const storeUrl = getCellDisplay(disp, dbMap, 'ストア画像').trim();
  if (storeUrl) urls.push(storeUrl);
  while (urls.length < 24) urls.push('');
  return urls.slice(0, 24);
}

function buildItemSpecifics(disp, dbMap) {
  const parts = [];
  for (let i = 1; i <= 30; i++) {
    const key = getCellDisplay(disp, dbMap, '項目名（' + i + '）').trim();
    const val = getCellDisplay(disp, dbMap, '内容（' + i + '）').trim();
    if (key) parts.push(key + ':' + val);
  }
  return parts.join(',');
}

function resolveItemCode(disp, dbMap) {
  const upc = getCellDisplay(disp, dbMap, 'UPC').trim();
  if (upc) return { type: 'upc', code: upc };
  const ean = getCellDisplay(disp, dbMap, 'EAN').trim();
  if (ean) return { type: 'ean', code: ean };
  const mpn = getCellDisplay(disp, dbMap, 'MPN(型番可)').trim();
  if (mpn) return { type: 'mpn', code: mpn };
  return { type: '', code: '' };
}

function buildConditionMap(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    const ss          = getTargetSpreadsheet(spreadsheetId);
    const catCondMap  = {};
    const condGroupMap = {};

    const catCondSheet = ss.getSheetByName('category_condition_map');
    if (catCondSheet) {
      const data = catCondSheet.getDataRange().getValues();
      data.forEach(function(row, i) {
        if (i === 0) return;
        const catId = String(row[0] || '').trim();
        const grpId = String(row[1] || '').trim();
        if (catId && grpId) catCondMap[catId] = grpId;
      });
    }

    const condGroupSheet = ss.getSheetByName('condition_group_map');
    if (condGroupSheet) {
      const data    = condGroupSheet.getDataRange().getValues();
      const headers = data[0].map(function(h) { return String(h).trim(); });
      const grpIdx  = headers.indexOf('group_id');
      const jsonIdx = headers.indexOf('conditions_json');
      data.forEach(function(row, i) {
        if (i === 0) return;
        const grpId = String(row[grpIdx] || '').trim();
        if (!grpId) return;
        if (!condGroupMap[grpId]) condGroupMap[grpId] = {};
        try {
          const conditions = JSON.parse(String(row[jsonIdx] || '').trim());
          conditions.forEach(function(c) {
            if (c.ja && c.id) condGroupMap[grpId][c.ja] = String(c.id);
          });
        } catch (e) {}
      });
    }
    return { catCondMap: catCondMap, condGroupMap: condGroupMap };
  } catch (e) {
    return { catCondMap: {}, condGroupMap: {} };
  }
}

function resolveConditionId(categoryId, conditionJa, conditionMap) {
  const catId = String(categoryId || '').trim();
  const ja    = String(conditionJa  || '').trim();
  if (!catId || !ja) return '';
  const grpId   = conditionMap.catCondMap[catId];
  if (!grpId)   return '';
  const grpData = conditionMap.condGroupMap[grpId];
  if (!grpData) return '';
  return grpData[ja] || '';
}

function convertTimestamp(ts) {
  if (!ts) return '';
  try {
    const match = ts.match(/(\d{4})\/(\d{2})\/(\d{2})[\/ ](\d{2}):(\d{2})/);
    if (match) {
      return match[1] + '-' + match[2] + '-' + match[3] + ' ' + parseInt(match[4], 10) + ':' + match[5];
    }
    return ts;
  } catch (e) { return ts; }
}
