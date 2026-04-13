/**
 * セルスタCSV出力機能（スタンドアロン）
 * container/Code.gs の EbayLib.exportSellstaCsv() から呼び出す
 */

/**
 * 出品DBからセルスタ形式CSVデータを生成してスプレッドシートに出力
 *
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @returns {{ success: boolean, message: string, rowCount: number }}
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

    const outputSS = SpreadsheetApp.openById(outputDbId);
    const outputSheet = outputSS.getSheetByName('出品');
    if (!outputSheet) {
      return { success: false, message: '出品DBに「出品」シートが見つかりません。' };
    }

    const lastCol = outputSheet.getLastColumn();
    const lastRow = outputSheet.getLastRow();
    if (lastRow < 5) {
      return { success: false, message: '出品DBにデータがありません（5行目以降にデータが必要）。' };
    }

    // ヘッダーマッピング作成
    const headerRow = outputSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const dbMap = {};
    headerRow.forEach(function(h, i) {
      if (h) dbMap[String(h).trim()] = i;
    });

    // データ行（5行目以降）を全取得
    const dataValues  = outputSheet.getRange(5, 1, lastRow - 4, lastCol).getValues();
    const dataDisplay = outputSheet.getRange(5, 1, lastRow - 4, lastCol).getDisplayValues();

    // Conditionマッピングを構築
    const conditionMap = buildConditionMap(spreadsheetId);

    // CSVヘッダー定義
    const csvHeaders = [
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

    const csvRows = [csvHeaders];

    // データ行を変換
    dataValues.forEach(function(row, rowIdx) {
      const disp = dataDisplay[rowIdx];

      // Item IDが空の行はスキップ
      const itemId = getCellDisplay(disp, dbMap, 'Item ID');
      if (!itemId || !itemId.trim()) return;

      // 画像URLを空白を詰めてimage_url1〜24に配置
      const imageUrls = buildImageUrls(disp, dbMap);

      // Item Specificsを結合
      const itemSpecifics = buildItemSpecifics(disp, dbMap);

      // Condition逆引き
      const categoryId = getCellDisplay(disp, dbMap, 'カテゴリID');
      const conditionJa = getCellDisplay(disp, dbMap, '状態');
      const conditionId = resolveConditionId(categoryId, conditionJa, conditionMap);

      // Item Code（UPC→EAN→MPN優先）
      const itemCodeResult = resolveItemCode(disp, dbMap);

      // タイムスタンプ変換
      const listingDate = convertTimestamp(getCellDisplay(disp, dbMap, '出品タイムスタンプ'));

      const csvRow = [
        'Revise',
        itemId.trim(),
        getCellDisplay(disp, dbMap, 'タイトル'),
      ].concat(imageUrls).concat([
        getCellDisplay(disp, dbMap, '仕入元URL①'),       // ① 仕入先情報
        getCellDisplay(disp, dbMap, '仕入元URL②'),       // ② 仕入先情報
        getCellDisplay(disp, dbMap, '仕入元URL③'),       // ③ 仕入先情報
        getCellDisplay(disp, dbMap, '仕入れキーワード'), // Custom label (SKU)
        conditionId,                                      // Condition
        getCellDisplay(disp, dbMap, '状態説明'),         // Condition description
        itemCodeResult.type,                              // Item Code type
        itemCodeResult.code,                              // Item Code
        categoryId,                                       // CategoryID
        itemSpecifics,                                    // Item Specifics
        'fixed_price',                                    // ListingType
        'gtc',                                            // Duration
        getCellDisplay(disp, dbMap, '売値($)'),          // Selling Price
        getCellDisplay(disp, dbMap, '承認価格'),         // Best Offers accept
        getCellDisplay(disp, dbMap, '拒否価格'),         // Best Offers decline
        getCellDisplay(disp, dbMap, '個数'),             // Quantity
        '1',                                              // Store Category
        getCellDisplay(disp, dbMap, 'Shipping Policy'),  // Shipping Policy
        getCellDisplay(disp, dbMap, 'Payment Policy'),   // Payment Policy
        getCellDisplay(disp, dbMap, 'Return Policy'),    // Return Policy
        'TRUE',                                           // Private Listing
        getCellDisplay(disp, dbMap, 'Description'),      // Description
        listingDate,                                      // listing_date
        getCellDisplay(disp, dbMap, 'メモ'),             // Memo
        getCellDisplay(disp, dbMap, '検索URL')           // Custom Link
      ]);

      csvRows.push(csvRow);
    });

    Logger.log('変換完了: ' + (csvRows.length - 1) + '件');

    // 出力先シートを準備（出品スプレッドシートに「セルスタCSV」シートを作成）
    const sourceSS = getTargetSpreadsheet(spreadsheetId);
    let csvSheet = sourceSS.getSheetByName('セルスタCSV');
    if (csvSheet) {
      csvSheet.clearContents();
    } else {
      csvSheet = sourceSS.insertSheet('セルスタCSV');
    }

    // シートに書き込み
    csvSheet.getRange(1, 1, csvRows.length, csvHeaders.length).setValues(csvRows);

    // ヘッダー行を太字・背景色で見やすく
    csvSheet.getRange(1, 1, 1, csvHeaders.length)
      .setFontWeight('bold')
      .setBackground('#D5E8F0');

    Logger.log('✅ セルスタCSVシート出力完了: ' + (csvRows.length - 1) + '件');

    return {
      success: true,
      message: (csvRows.length - 1) + '件のデータを「セルスタCSV」シートに出力しました。',
      rowCount: csvRows.length - 1
    };

  } catch (e) {
    Logger.log('❌ CSV出力エラー: ' + e.toString());
    return { success: false, message: 'CSV出力エラー: ' + e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * セルの表示値を取得
 */
function getCellDisplay(disp, dbMap, colName) {
  const idx = dbMap[colName];
  if (idx === undefined) return '';
  const val = disp[idx];
  return (val === null || val === undefined) ? '' : String(val);
}

/**
 * 画像URLを空白を詰めて最大24列に配置
 * 画像1〜23 → ストア画像 の順で走査し空白をスキップ
 */
function buildImageUrls(disp, dbMap) {
  const urls = [];
  for (let i = 1; i <= 23; i++) {
    const url = getCellDisplay(disp, dbMap, '画像' + i).trim();
    if (url) urls.push(url);
  }
  const storeUrl = getCellDisplay(disp, dbMap, 'ストア画像').trim();
  if (storeUrl) urls.push(storeUrl);

  // 24列になるよう空文字で埋める
  while (urls.length < 24) urls.push('');
  return urls.slice(0, 24);
}

/**
 * Item Specificsを「項目名:内容,」形式で結合（空ペアはスキップ）
 */
function buildItemSpecifics(disp, dbMap) {
  const parts = [];
  for (let i = 1; i <= 30; i++) {
    const key = getCellDisplay(disp, dbMap, '項目名（' + i + '）').trim();
    const val = getCellDisplay(disp, dbMap, '内容（' + i + '）').trim();
    if (key) parts.push(key + ':' + val);
  }
  return parts.join(',');
}

/**
 * Item Code（UPC→EAN→MPN優先）
 */
function resolveItemCode(disp, dbMap) {
  const upc = getCellDisplay(disp, dbMap, 'UPC').trim();
  if (upc) return { type: 'upc', code: upc };
  const ean = getCellDisplay(disp, dbMap, 'EAN').trim();
  if (ean) return { type: 'ean', code: ean };
  const mpn = getCellDisplay(disp, dbMap, 'MPN(型番可)').trim();
  if (mpn) return { type: 'mpn', code: mpn };
  return { type: '', code: '' };
}

/**
 * カテゴリID→コンディション日本語→数値IDのマップを構築
 */
function buildConditionMap(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    const ss = getTargetSpreadsheet(spreadsheetId);

    // category_condition_map: カテゴリID → group_id
    const catCondSheet = ss.getSheetByName('category_condition_map');
    const catCondMap = {};
    if (catCondSheet) {
      const data = catCondSheet.getDataRange().getValues();
      data.forEach(function(row, i) {
        if (i === 0) return;
        const catId = String(row[0] || '').trim();
        const grpId = String(row[1] || '').trim();
        if (catId && grpId) catCondMap[catId] = grpId;
      });
    }
    Logger.log('category_condition_map: ' + Object.keys(catCondMap).length + '件');

    // condition_group_map: group_id → { ja: conditionId }
    const condGroupSheet = ss.getSheetByName('condition_group_map');
    const condGroupMap = {};
    if (condGroupSheet) {
      const data = condGroupSheet.getDataRange().getValues();
      const headers = data[0].map(function(h) { return String(h).trim(); });
      const groupIdIdx        = headers.indexOf('group_id');
      const conditionsJsonIdx = headers.indexOf('conditions_json');

      data.forEach(function(row, i) {
        if (i === 0) return;
        const grpId = String(row[groupIdIdx] || '').trim();
        if (!grpId) return;
        if (!condGroupMap[grpId]) condGroupMap[grpId] = {};
        const json = String(row[conditionsJsonIdx] || '').trim();
        if (json) {
          try {
            const conditions = JSON.parse(json);
            conditions.forEach(function(c) {
              if (c.ja && c.id) condGroupMap[grpId][c.ja] = String(c.id);
            });
          } catch (e) {
            Logger.log('⚠️ conditions_json パースエラー: ' + e.toString());
          }
        }
      });
    }
    Logger.log('condition_group_map: ' + Object.keys(condGroupMap).length + 'グループ');

    return { catCondMap: catCondMap, condGroupMap: condGroupMap };

  } catch (e) {
    Logger.log('buildConditionMap エラー: ' + e.toString());
    return { catCondMap: {}, condGroupMap: {} };
  }
}

/**
 * カテゴリID + 日本語コンディション → 数値IDに変換
 */
function resolveConditionId(categoryId, conditionJa, conditionMap) {
  const catId = String(categoryId || '').trim();
  const ja    = String(conditionJa  || '').trim();
  if (!catId || !ja) return '';

  const grpId = conditionMap.catCondMap[catId];
  if (!grpId) {
    Logger.log('⚠️ カテゴリID=' + catId + ' のグループが見つかりません');
    return '';
  }

  const grpData = conditionMap.condGroupMap[grpId];
  if (!grpData) {
    Logger.log('⚠️ グループID=' + grpId + ' のコンディションデータが見つかりません');
    return '';
  }

  const condId = grpData[ja];
  if (!condId) {
    Logger.log('⚠️ 「' + ja + '」のconditionIdが見つかりません（グループ=' + grpId + '）');
    return '';
  }

  Logger.log('Condition変換: ' + ja + ' → ' + condId + '（カテゴリ=' + catId + '）');
  return condId;
}

/**
 * タイムスタンプ変換
 * 入力: "2026/04/13/09:21:09" 形式
 * 出力: "2026-04-13 9:21" 形式
 */
function convertTimestamp(ts) {
  if (!ts) return '';
  try {
    // "2026/04/13/09:21:09" → 数字を抽出
    const match = ts.match(/(\d{4})\/(\d{2})\/(\d{2})[\/ ](\d{2}):(\d{2})/);
    if (match) {
      const year  = match[1];
      const month = match[2];
      const day   = match[3];
      const hour  = parseInt(match[4], 10); // 先頭0を除去
      const min   = match[5];
      return year + '-' + month + '-' + day + ' ' + hour + ':' + min;
    }
    return ts;
  } catch (e) {
    return ts;
  }
}
