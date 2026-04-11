/**
 * eBay利益計算ツール - メイン機能
 *
 * URL処理、出品データ転記などのメイン機能
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ユーティリティ関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 指定列で空白の最初の行を探す
 *
 * @param {Sheet} sheet シート
 * @param {number} columnNumber 列番号（1-based）
 * @returns {number} 空白行の行番号
 */
function findEmptyRowInColumn(sheet, columnNumber) {
  const dataStartRow = LISTING_ROWS.DATA_START; // 5行目
  const lastRow = sheet.getLastRow();

  // データ開始行から最終行+10まで検索（関数が入っている可能性を考慮）
  const searchEndRow = Math.max(lastRow + 10, dataStartRow + 100);

  // 指定列のデータを一括取得
  const columnValues = sheet.getRange(dataStartRow, columnNumber, searchEndRow - dataStartRow + 1, 1).getValues();

  // 空白の最初の行を探す
  for (let i = 0; i < columnValues.length; i++) {
    const value = columnValues[i][0];
    if (!value || value.toString().trim() === '') {
      return dataStartRow + i; // 空白行を発見
    }
  }

  // 空白行が見つからない場合は最終行+1
  return searchEndRow + 1;
}

/**
 * リサーチ担当列が空白の最初の行を探す（ヘッダー名ベース）
 *
 * @param {Sheet} sheet 出品シート
 * @returns {number} 転記先行番号
 */
function findEmptyRowInResearchStaffColumn(sheet) {
  const headerMapping = buildHeaderMapping(sheet);
  const col = getColumnByHeader(headerMapping, LISTING_COLUMNS.RESEARCH_STAFF.header);
  if (!col) {
    throw new Error('出品シートに「' + LISTING_COLUMNS.RESEARCH_STAFF.header + '」列が見つかりません');
  }
  return findEmptyRowInColumn(sheet, col);
}

/**
 * タイトルがVEROまたは禁止ワードに該当するかチェック
 *
 * @param {string} title タイトル文字列
 * @param {Spreadsheet} listingSpreadsheet 出品シートのスプレッドシートオブジェクト
 * @returns {string} "VERO" | "禁止ワード" | ""
 */
function checkVeroAndProhibitedWords(title, listingSpreadsheet) {
  try {
    if (!title || String(title).trim() === '') {
      return '';
    }

    const veroSheet = listingSpreadsheet.getSheetByName('Vero/禁止ワード');

    if (!veroSheet) {
      Logger.log('⚠️ Vero/禁止ワードシートが見つかりません。ワード判定をスキップします。');
      return '';
    }

    const lastRow = veroSheet.getLastRow();

    if (lastRow < 2) {
      Logger.log('⚠️ Vero/禁止ワードシートにデータがありません。');
      return '';
    }

    // A列（VERO）とB列（禁止ワード）のデータを取得（2行目以降）
    const veroWords = veroSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const prohibitedWords = veroSheet.getRange(2, 2, lastRow - 1, 1).getValues();

    const titleLower = String(title).toLowerCase();

    // VEROワードチェック（優先度高）
    for (let i = 0; i < veroWords.length; i++) {
      const veroWord = veroWords[i][0];
      if (veroWord && String(veroWord).trim() !== '') {
        const veroWordLower = String(veroWord).toLowerCase();
        if (titleLower.indexOf(veroWordLower) !== -1) {
          Logger.log('✅ VEROワード検出: ' + veroWord);
          return 'VERO';
        }
      }
    }

    // 禁止ワードチェック
    for (let i = 0; i < prohibitedWords.length; i++) {
      const prohibitedWord = prohibitedWords[i][0];
      if (prohibitedWord && String(prohibitedWord).trim() !== '') {
        const prohibitedWordLower = String(prohibitedWord).toLowerCase();
        if (titleLower.indexOf(prohibitedWordLower) !== -1) {
          Logger.log('✅ 禁止ワード検出: ' + prohibitedWord);
          return '禁止ワード';
        }
      }
    }

    // 該当なし
    return '';

  } catch (error) {
    Logger.log('❌ ワード判定エラー: ' + error.toString());
    return '';
  }
}

/**
 * 出品シートのヘッダー行からカラムマッピングを構築
 *
 * @param {Sheet} listingSheet 出品シート
 * @returns {Object} ヘッダー名をキー、列番号を値とするマッピングオブジェクト
 */
function buildHeaderMapping(listingSheet) {
  const headerRow = 3; // ヘッダー行（2行目削除により4→3に変更）
  const lastCol = listingSheet.getLastColumn();
  const headers = listingSheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];

  const mapping = {};

  // ヘッダー名から列番号へのマッピングを作成
  for (let i = 0; i < headers.length; i++) {
    const headerName = headers[i];
    if (headerName && headerName !== '') {
      // trim()で前後の空白・タブ・改行を除去してマッピング
      const trimmedHeader = String(headerName).trim();
      if (trimmedHeader !== '') {
        mapping[trimmedHeader] = i + 1; // 1-based column number
      }
    }
  }

  Logger.log('ヘッダーマッピング構築完了: ' + Object.keys(mapping).length + '列');
  return mapping;
}

/**
 * Config.gsのヘッダー名から実際の列番号を取得
 *
 * @param {Object} headerMapping ヘッダー名→列番号のマッピング
 * @param {string} configHeader Config.gsで定義されているヘッダー名
 * @returns {number|null} 列番号（見つからない場合はnull）
 */
function getColumnByHeader(headerMapping, configHeader) {
  return headerMapping[configHeader] || null;
}

/**
 * 転記データを準備（ヘッダーマッピングベース）
 *
 * @param {Object} itemInfo Item URLから取得した商品情報（タイトル用、カテゴリは整合性チェック用）
 * @param {Object} specInfo スペックURLから取得した商品情報（カテゴリ、Brand, UPC, EAN, MPN, Item Specifics用）
 * @param {Sheet} listingSheet 出品シート
 * @param {Object} headerMapping ヘッダー名→列番号のマッピング
 * @param {Object} policyData ポリシーデータ（任意）
 * @param {string} sku SKU（任意）
 * @returns {Object} {data: 転記データ配列, specColors: Item Specifics色情報配列}
 */
function prepareTransferDataWithMapping(itemInfo, specInfo, listingSheet, headerMapping, policyData, sku) {
  Logger.log('>>> prepareTransferDataWithMapping開始');
  Logger.log('  - itemInfo: ' + (itemInfo ? 'あり' : 'なし'));
  Logger.log('  - specInfo: ' + (specInfo ? 'あり' : 'なし'));
  Logger.log('  - headerMapping keys: ' + Object.keys(headerMapping).length);
  Logger.log('  - policyData: ' + (policyData ? 'あり' : 'なし'));
  Logger.log('  - sku: ' + sku);

  const researchSheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);
  Logger.log('  - researchSheet取得完了');

  // リサーチシートから各セクションのデータを取得
  Logger.log('データ取得開始...');
  const topInfo = {
    staff: researchSheet.getRange(RESEARCH_TOP_INFO.DATA_ROW, RESEARCH_TOP_INFO.COLUMNS.STAFF.col).getValue(),
    keyword: researchSheet.getRange(RESEARCH_TOP_INFO.DATA_ROW, RESEARCH_TOP_INFO.COLUMNS.KEYWORD.col).getValue()
  };

  const mainInfo = {
    purchasePrice: researchSheet.getRange(RESEARCH_MAIN_INFO.DATA_ROW, RESEARCH_MAIN_INFO.COLUMNS.PURCHASE_PRICE_JPY.col).getValue(),
    sellingPrice: researchSheet.getRange(RESEARCH_MAIN_INFO.DATA_ROW, RESEARCH_MAIN_INFO.COLUMNS.SELLING_PRICE_USD.col).getValue(),
    bestOffer: researchSheet.getRange(RESEARCH_MAIN_INFO.DATA_ROW, RESEARCH_MAIN_INFO.COLUMNS.BEST_OFFER.col).getValue(),
    actualWeight: researchSheet.getRange(RESEARCH_MAIN_INFO.DATA_ROW, RESEARCH_MAIN_INFO.COLUMNS.ACTUAL_WEIGHT_G.col).getValue(),
    depth: researchSheet.getRange(RESEARCH_MAIN_INFO.DATA_ROW, RESEARCH_MAIN_INFO.COLUMNS.DEPTH_CM.col).getValue(),
    width: researchSheet.getRange(RESEARCH_MAIN_INFO.DATA_ROW, RESEARCH_MAIN_INFO.COLUMNS.WIDTH_CM.col).getValue(),
    height: researchSheet.getRange(RESEARCH_MAIN_INFO.DATA_ROW, RESEARCH_MAIN_INFO.COLUMNS.HEIGHT_CM.col).getValue(),
    volumetricWeight: researchSheet.getRange(RESEARCH_MAIN_INFO.DATA_ROW, RESEARCH_MAIN_INFO.COLUMNS.VOLUMETRIC_WEIGHT_G.col).getValue()
  };

  const priceInfo = {
    purchaseKeyword: researchSheet.getRange(RESEARCH_PRICE_INFO.DATA_ROW, RESEARCH_PRICE_INFO.COLUMNS.PURCHASE_KEYWORD.col).getValue(),
    purchaseUrl1: researchSheet.getRange(RESEARCH_PRICE_INFO.DATA_ROW, RESEARCH_PRICE_INFO.COLUMNS.PURCHASE_URL_1.col).getValue(),
    purchaseUrl2: researchSheet.getRange(RESEARCH_PRICE_INFO.DATA_ROW, RESEARCH_PRICE_INFO.COLUMNS.PURCHASE_URL_2.col).getValue(),
    purchaseUrl3: researchSheet.getRange(RESEARCH_PRICE_INFO.DATA_ROW, RESEARCH_PRICE_INFO.COLUMNS.PURCHASE_URL_3.col).getValue(),
    memo: researchSheet.getRange(RESEARCH_PRICE_INFO.DATA_ROW, RESEARCH_PRICE_INFO.COLUMNS.MEMO.col).getValue(),
    imageUrl: researchSheet.getRange(RESEARCH_PRICE_INFO.DATA_ROW, RESEARCH_PRICE_INFO.COLUMNS.IMAGE_URL.col).getValue()
  };

  const itemList = {
    itemUrl: researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.ITEM_URL.col).getValue(),
    lowestPriceUrl: researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.LOWEST_PRICE_URL.col).getValue(),
    specUrl: researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.SPEC_URL.col).getValue(),
    condition: researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.CONDITION.col).getValue()
  };

  // カテゴリIDの整合性チェック: Item URLとスペックURLのカテゴリIDが異なる場合は警告して中止
  Logger.log('カテゴリID整合性チェック開始...');
  if (itemInfo && itemInfo.category && specInfo && specInfo.category) {
    const itemCategoryId = itemInfo.category.categoryId;
    const specCategoryId = specInfo.category.categoryId;

    Logger.log('  - Item URLカテゴリID: ' + itemCategoryId);
    Logger.log('  - スペックURLカテゴリID: ' + specCategoryId);

    if (itemCategoryId && specCategoryId && itemCategoryId !== specCategoryId) {
      const confirmMsg = '⚠️ カテゴリIDが一致しません。\n\n' +
                         '【Item URL】\n' +
                         '  ID: ' + itemCategoryId + '  ' + (itemInfo.category.categoryName || '') + '\n\n' +
                         '【スペックURL】\n' +
                         '  ID: ' + specCategoryId + '  ' + (specInfo.category.categoryName || '') + '\n\n' +
                         'スペックURLのカテゴリ（' + specCategoryId + '）を採用して出品しますか？\n' +
                         'キャンセルすると転記を中止します。';

      Logger.log('⚠️ カテゴリID不一致: Item=' + itemCategoryId + ' / Spec=' + specCategoryId);
      const uiForCategory = SpreadsheetApp.getUi();
      const categoryResponse = uiForCategory.alert('カテゴリID確認', confirmMsg, uiForCategory.ButtonSet.OK_CANCEL);
      if (categoryResponse !== uiForCategory.Button.OK) {
        Logger.log('カテゴリID不一致: ユーザーがキャンセルしたため転記を中止');
        throw new Error('カテゴリID不一致のため転記を中止しました');
      }
      Logger.log('✅ スペックURLのカテゴリIDを採用して続行: ' + specCategoryId);
    }

    Logger.log('✅ カテゴリIDが一致しています: ' + itemCategoryId);
  } else {
    Logger.log('⚠️ カテゴリ情報が不完全なため、整合性チェックをスキップします');
  }

  // headerMappingから最大列数を決定
  Logger.log('headerMapping values: ' + JSON.stringify(Object.values(headerMapping).slice(0, 10)));
  const maxCol = Math.max.apply(null, Object.values(headerMapping));
  Logger.log('maxCol: ' + maxCol + ', type: ' + typeof maxCol);

  if (!maxCol || isNaN(maxCol) || maxCol < 1) {
    throw new Error('⚠️ maxColが無効です: ' + maxCol);
  }

  const transferData = new Array(maxCol).fill('');
  Logger.log('transferData配列作成完了: length=' + transferData.length);

  // ヘッダー名で値を設定するヘルパー関数
  // optional = true の場合、列が見つからなくてもエラーにせず警告ログのみ出力
  const setValueByHeader = function(headerName, value, optional) {
    const col = getColumnByHeader(headerMapping, headerName);
    if (!col || col === null || col === undefined) {
      if (optional === true) {
        // オプショナル列：列が見つからない場合はスキップ（警告ログのみ）
        Logger.log('⚠️ オプショナル列「' + headerName + '」が出品シートに存在しないためスキップします');
        return;
      }
      // 必須列：列が見つからない場合はエラー
      const errorMsg = '出品シートのヘッダー行（3行目）に「' + headerName + '」という列名が見つかりませんでした。\n\n' +
                       '出品シートを開いて、3行目に「' + headerName + '」列があるか確認してください。\n' +
                       '※列名の前後に余計なスペースやタブがないかも確認してください。';
      Logger.log(errorMsg);
      throw new Error(errorMsg);
    }
    transferData[col - 1] = value;
  };

  // 出品URL（空）
  Logger.log('setValueByHeader開始: LISTING_URL');
  setValueByHeader(LISTING_COLUMNS.LISTING_URL.header, '');

  // ステータス（空）
  Logger.log('setValueByHeader: STATUS');
  setValueByHeader(LISTING_COLUMNS.STATUS.header, '');

  // SKU
  setValueByHeader(LISTING_COLUMNS.SKU.header, sku || '');

  // 仕入れキーワード
  setValueByHeader(LISTING_COLUMNS.KEYWORD.header, priceInfo.purchaseKeyword);

  // メモ
  setValueByHeader(LISTING_COLUMNS.MEMO.header, priceInfo.memo);

  // 仕入元①とURL① - URLからサイト名を自動取得
  const purchaseSourceName1 = priceInfo.purchaseUrl1 ? getPurchaseSourceNameFromUrl(priceInfo.purchaseUrl1) : '';
  setValueByHeader(LISTING_COLUMNS.PURCHASE_SOURCE_1.header, purchaseSourceName1);
  setValueByHeader(LISTING_COLUMNS.PURCHASE_URL_1.header, priceInfo.purchaseUrl1);

  // 仕入元②とURL② - URLからサイト名を自動取得
  const purchaseSourceName2 = priceInfo.purchaseUrl2 ? getPurchaseSourceNameFromUrl(priceInfo.purchaseUrl2) : '';
  setValueByHeader(LISTING_COLUMNS.PURCHASE_SOURCE_2.header, purchaseSourceName2);
  setValueByHeader(LISTING_COLUMNS.PURCHASE_URL_2.header, priceInfo.purchaseUrl2);

  // 仕入元③とURL③ - URLからサイト名を自動取得
  const purchaseSourceName3 = priceInfo.purchaseUrl3 ? getPurchaseSourceNameFromUrl(priceInfo.purchaseUrl3) : '';
  setValueByHeader(LISTING_COLUMNS.PURCHASE_SOURCE_3.header, purchaseSourceName3);
  setValueByHeader(LISTING_COLUMNS.PURCHASE_URL_3.header, priceInfo.purchaseUrl3);

  // リサーチ担当（必須）
  setValueByHeader(LISTING_COLUMNS.RESEARCH_STAFF.header, topInfo.staff);

  // 出品担当（オプショナル）
  setValueByHeader(LISTING_COLUMNS.LISTING_STAFF.header, '', true);

  // ピックアップ担当（オプショナル）
  setValueByHeader(LISTING_COLUMNS.PICKUP_STAFF.header, '', true);

  // 仕入れ検索担当（オプショナル）
  setValueByHeader(LISTING_COLUMNS.PURCHASE_SEARCH_STAFF.header, '', true);

  // 利益計算担当（オプショナル）
  setValueByHeader(LISTING_COLUMNS.PROFIT_CALC_STAFF.header, '', true);

  // 業務6担当（オプショナル）
  setValueByHeader(LISTING_COLUMNS.TASK6_STAFF.header, '', true);

  // タイトル（英語） - Item URLから取得
  const title = itemInfo.title || '';
  setValueByHeader(LISTING_COLUMNS.TITLE.header, title);

  // ワード判定（VERO/禁止ワード）
  const wordCheckResult = checkVeroAndProhibitedWords(title, listingSheet.getParent());
  setValueByHeader(LISTING_COLUMNS.WORD_CHECK.header, wordCheckResult, true);

  // 文字数（タイトル文字数）
  setValueByHeader(LISTING_COLUMNS.CHAR_COUNT_1.header, title.length);

  // 状態
  setValueByHeader(LISTING_COLUMNS.CONDITION.header, itemList.condition);

  // 状態説明（空）
  setValueByHeader(LISTING_COLUMNS.CONDITION_DESC_TEMPLATE.header, '');
  setValueByHeader(LISTING_COLUMNS.CONDITION_DESC_2.header, '');
  setValueByHeader(LISTING_COLUMNS.DESCRIPTION.header, '');

  // ItemURL
  setValueByHeader(LISTING_COLUMNS.ITEM_URL.header, itemList.itemUrl);

  // スペックURL
  setValueByHeader(LISTING_COLUMNS.SPEC_URL.header, itemList.specUrl);

  // カテゴリID - スペックURLから取得（Item URLとの整合性チェック済み）
  setValueByHeader(LISTING_COLUMNS.CATEGORY_ID.header, specInfo.category.categoryId);

  // カテゴリ - スペックURLから取得（Item URLとの整合性チェック済み）
  setValueByHeader(LISTING_COLUMNS.CATEGORY_NAME.header, specInfo.category.categoryName);

  // Brand - スペックURLから取得、取得できなかった場合は"Does not apply"
  setValueByHeader(LISTING_COLUMNS.BRAND.header, specInfo.specifics['Brand'] || 'Does not apply');

  // UPC - スペックURLから取得、取得できなかった場合は"Does not apply"
  setValueByHeader(LISTING_COLUMNS.UPC.header, specInfo.specifics['UPC'] || 'Does not apply');

  // EAN - スペックURLから取得、取得できなかった場合は"Does not apply"
  setValueByHeader(LISTING_COLUMNS.EAN.header, specInfo.specifics['EAN'] || 'Does not apply');

  // MPN - スペックURLから取得、取得できなかった場合は"Does not apply"
  setValueByHeader(LISTING_COLUMNS.MPN.header, specInfo.specifics['MPN'] || 'Does not apply');

  // Item Specifics（項目名1～30、内容1～30）= 60列
  // スペックURLから取得、優先度順にソート（必須 > 推奨 > その他、かつ値あり > 値なし）
  const sortedSpecs = sortItemSpecificsByPriority(specInfo.specifics, specInfo.category.categoryId);

  // Item Specificsの色情報を保存（転記後に色を設定するため）
  const specColors = [];

  for (let i = 0; i < 30; i++) {
    const nameKey = 'SPEC_NAME_' + (i + 1);
    const valueKey = 'SPEC_VALUE_' + (i + 1);

    if (!LISTING_COLUMNS[nameKey] || !LISTING_COLUMNS[valueKey]) {
      Logger.log('⚠️ 警告: ' + nameKey + ' または ' + valueKey + ' がLISTING_COLUMNSに未定義');
      continue;
    }

    const nameHeader = LISTING_COLUMNS[nameKey].header;
    const valueHeader = LISTING_COLUMNS[valueKey].header;

    const nameCol = getColumnByHeader(headerMapping, nameHeader);
    const valueCol = getColumnByHeader(headerMapping, valueHeader);

    if (i < sortedSpecs.length) {
      const spec = sortedSpecs[i];
      if (nameCol) transferData[nameCol - 1] = spec.name;
      if (valueCol) transferData[valueCol - 1] = spec.value;

      // 色情報を保存（項目名列のみ）
      if (nameCol) {
        specColors.push({
          colIndex: nameCol - 1,
          color: spec.color
        });
      }
    } else {
      if (nameCol) transferData[nameCol - 1] = '';
      if (valueCol) transferData[valueCol - 1] = '';
    }
  }

  // 重量・サイズ情報
  setValueByHeader(LISTING_COLUMNS.ACTUAL_WEIGHT.header, mainInfo.actualWeight);
  setValueByHeader(LISTING_COLUMNS.DEPTH.header, mainInfo.depth);
  setValueByHeader(LISTING_COLUMNS.WIDTH.header, mainInfo.width);
  setValueByHeader(LISTING_COLUMNS.HEIGHT.header, mainInfo.height);
  setValueByHeader(LISTING_COLUMNS.VOLUMETRIC_WEIGHT.header, mainInfo.volumetricWeight);

  // 適用重量(g)を計算
  // 発送業者が「日本郵便」の場合は実重量、それ以外は容積重量と実重量の大きい方
  const shippingCarrier = policyData && policyData.shippingCarrier ? policyData.shippingCarrier : '';
  let appliedWeight = '';
  if (mainInfo.actualWeight !== '' && mainInfo.actualWeight !== null && mainInfo.actualWeight !== undefined) {
    if (shippingCarrier === '日本郵便') {
      appliedWeight = mainInfo.actualWeight;
    } else {
      const actualWeight = Number(mainInfo.actualWeight) || 0;
      const volumetricWeight = Number(mainInfo.volumetricWeight) || 0;
      appliedWeight = Math.max(actualWeight, volumetricWeight);
    }
  }
  setValueByHeader(LISTING_COLUMNS.APPLIED_WEIGHT.header, appliedWeight);

  // 発送・ポリシー情報（ポリシーデータから取得）
  setValueByHeader(LISTING_COLUMNS.SHIPPING_CARRIER.header, shippingCarrier);
  setValueByHeader(LISTING_COLUMNS.SHIPPING_METHOD.header, policyData && policyData.shippingMethod ? policyData.shippingMethod : '');

  // 個数（1固定）
  setValueByHeader(LISTING_COLUMNS.QUANTITY.header, 1);

  // 価格情報
  setValueByHeader(LISTING_COLUMNS.PURCHASE_PRICE.header, mainInfo.purchasePrice);
  setValueByHeader(LISTING_COLUMNS.SELLING_PRICE.header, mainInfo.sellingPrice);
  setValueByHeader(LISTING_COLUMNS.BEST_OFFER.header, mainInfo.bestOffer);

  // 検索URL
  setValueByHeader(LISTING_COLUMNS.LOWEST_PRICE_URL.header, itemList.lowestPriceUrl);

  // 利益情報（ポリシーデータから取得）
  setValueByHeader(LISTING_COLUMNS.PROFIT_RATE_BEFORE_REFUND.header, policyData && policyData.profitRateBeforeRefund ? policyData.profitRateBeforeRefund : '');  // 還付抜き利益率
  setValueByHeader(LISTING_COLUMNS.PROFIT_AMOUNT_BEFORE_REFUND.header, policyData && policyData.profitAmountBeforeRefund ? policyData.profitAmountBeforeRefund : '');  // 還付抜き利益額
  setValueByHeader(LISTING_COLUMNS.PROFIT_AMOUNT_AFTER_REFUND.header, policyData && policyData.profitAmountAfterRefund ? policyData.profitAmountAfterRefund : '');  // 還付込み利益額
  setValueByHeader(LISTING_COLUMNS.PROFIT_RATE_AFTER_REFUND.header, policyData && policyData.profitRateAfterRefund ? policyData.profitRateAfterRefund : '');  // 還付込み利益率

  // 画像URL - リサーチシートから取得
  setValueByHeader(LISTING_COLUMNS.IMAGE_URL.header, priceInfo.imageUrl);

  // 画像1～23（空）
  for (let i = 1; i <= 23; i++) {
    setValueByHeader(LISTING_COLUMNS['IMAGE_' + i].header, '');
  }

  // ストア画像 - ツール設定から取得
  const config = getEbayConfig();
  setValueByHeader(LISTING_COLUMNS.STORE_IMAGE.header, config.storeImageUrl || '');

  // 出品タイムスタンプ（記録不要のため空）
  setValueByHeader(LISTING_COLUMNS.LISTING_TIMESTAMP.header, '');

  // 管理年月（空）
  setValueByHeader(LISTING_COLUMNS.MGMT_YEAR_MONTH.header, '');

  return {
    data: transferData,
    specColors: specColors
  };
}

/**
 * 出品ボタン（Expedited用）のクリックハンドラ
 * ポリシー1（14行目）のデータでSKUを生成して出品
 */
function onListingButtonPolicy1() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '出品確認',
    'Expedited shippingで出品しますか？',
    ui.ButtonSet.OK_CANCEL
  );

  if (response === ui.Button.OK) {
    transferListingDataWithPolicy(RESEARCH_POLICY.POLICY_1_ROW, 'Expedited');
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast('出品をキャンセルしました', 'eBay 出品', 3);
  }
}

/**
 * 出品ボタン（Economy用）のクリックハンドラ
 * ポリシー2（15行目）のデータでSKUを生成して出品
 */
function onListingButtonPolicy2() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '出品確認',
    'Economy shippingで出品しますか？',
    ui.ButtonSet.OK_CANCEL
  );

  if (response === ui.Button.OK) {
    transferListingDataWithPolicy(RESEARCH_POLICY.POLICY_2_ROW, 'Economy');
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast('出品をキャンセルしました', 'eBay 出品', 3);
  }
}

/**
 * 出品ボタン（書状用）のクリックハンドラ
 * ポリシー3（16行目）のデータでSKUを生成して出品
 */
function onListingButtonPolicy3() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '出品確認',
    '書状で出品しますか？',
    ui.ButtonSet.OK_CANCEL
  );

  if (response === ui.Button.OK) {
    transferListingDataWithPolicy(RESEARCH_POLICY.POLICY_3_ROW, '書状');
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast('出品をキャンセルしました', 'eBay 出品', 3);
  }
}

/**
 * 出品データを転記（ポリシー指定版）
 * リサーチシートのデータを出品シートに転記
 * SKUを先行出力して行を予約してから画像ダウンロードを実行
 *
 * @param {number} policyRow ポリシー行番号（14, 15, 16のいずれか）
 * @param {string} policyLabel ポリシー名（表示用：Expedited, Economy, 書状）
 */
function transferListingDataWithPolicy(policyRow, policyLabel) {
  // エラー時のクリーンアップ用の変数
  let reservedRow = null;
  let reservedSheet = null;
  let reservedSkuCol = null;

  try {
    Logger.log('===== 転記開始 =====');
    Logger.log('ステップ1: リサーチシート取得');
    const researchSheet = ss.getSheetByName(SHEET_NAMES.RESEARCH);

    if (!researchSheet) {
      throw new Error('「' + SHEET_NAMES.RESEARCH + '」シートが見つかりません');
    }

    Logger.log('ステップ2: 担当者取得');
    // 担当者のバリデーション（B2セル）
    const staffName = researchSheet.getRange(RESEARCH_TOP_INFO.DATA_ROW, RESEARCH_TOP_INFO.COLUMNS.STAFF.col).getValue();
    if (!staffName || staffName.toString().trim() === '') {
      SpreadsheetApp.getUi().alert('エラー: 担当者が入力されていません\n\nリサーチシートのB2セル（担当者）を入力してください。');
      return;
    }

    // リサーチ方法を取得（C2セル）
    const researchMethod = researchSheet.getRange(RESEARCH_TOP_INFO.DATA_ROW, RESEARCH_TOP_INFO.COLUMNS.RESEARCH_METHOD.col).getValue();

    // ポリシーデータを取得（利益額、利益率、発送方法、発送業者）
    const policyData = getPolicyData(policyRow);

    // SKUを生成（還付抜き利益額・利益率を使用）
    const sku = generateSKU(researchMethod, staffName, policyData.profitAmountBeforeRefund, policyData.profitRateBeforeRefund);
    Logger.log('生成されたSKU: ' + sku + ' （ポリシー: ' + policyLabel + '）');

    // E7セルからItem URLを取得
    const itemUrl = researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.ITEM_URL.col).getValue();

    // E8セルからスペックURLを取得
    let specUrl = researchSheet.getRange(RESEARCH_ITEM_LIST.DATA_ROW, RESEARCH_ITEM_LIST.COLUMNS.SPEC_URL.col).getValue();

    if (!itemUrl || itemUrl.toString().trim() === '') {
      SpreadsheetApp.getUi().alert('Item URLが入力されていません。\n\nリサーチシートのItem URL欄を入力してください。');
      return;
    }

    // スペックURLが空白の場合、Item URLを使用
    if (!specUrl || specUrl.toString().trim() === '') {
      Logger.log('📋 スペックURLが空白のため、Item URLを使用します');
      specUrl = itemUrl;
    }

    // eBay APIから商品情報を取得
    SpreadsheetApp.getActiveSpreadsheet().toast('商品情報を取得中...', 'eBay API (' + policyLabel + ')', 10);

    // Item URLから基本情報を取得（タイトル用、カテゴリは整合性チェック用）
    const itemInfo = getProductInfoFromUrl(itemUrl.toString());

    // スペックURLからスペック情報を取得（カテゴリ、Brand, UPC, EAN, MPN, Item Specifics）
    const specInfo = getProductInfoFromUrl(specUrl.toString());

    // 転記先スプレッドシートを開く
    const config = getEbayConfig();
    const listingSpreadsheetId = config.listingSpreadsheetId;

    if (!listingSpreadsheetId) {
      throw new Error('「ツール設定」シートの「出品シート」が設定されていません');
    }

    const listingSpreadsheet = SpreadsheetApp.openById(listingSpreadsheetId);
    const listingSheet = listingSpreadsheet.getSheetByName(SHEET_NAMES.LISTING);

    if (!listingSheet) {
      throw new Error('転記先に「' + SHEET_NAMES.LISTING + '」シートが見つかりません');
    }

    // ヘッダーマッピングを構築
    const headerMapping = buildHeaderMapping(listingSheet);

    // SKU列を確認
    const skuCol = getColumnByHeader(headerMapping, LISTING_COLUMNS.SKU.header);
    if (!skuCol) {
      throw new Error('出品シートに「SKU」列が見つかりません');
    }

    // 転記先行を判定: SKU列が空白の最初の行を探す
    const newRow = findEmptyRowInColumn(listingSheet, skuCol);
    Logger.log('転記先行: ' + newRow);

    // SKUを先行出力（行を予約）
    listingSheet.getRange(newRow, skuCol).setValue(sku);
    SpreadsheetApp.flush(); // 即座に反映

    // エラー時のクリーンアップ用に保存
    reservedRow = newRow;
    reservedSheet = listingSheet;
    reservedSkuCol = skuCol;

    Logger.log('SKUを先行出力して行を予約しました: ' + sku);
    SpreadsheetApp.getActiveSpreadsheet().toast('行を予約しました（SKU: ' + sku + '）', 'eBay 出品', 3);

    Logger.log('ステップ10: prepareTransferDataWithMapping呼び出し開始');
    // 転記データを準備（Item情報、スペック情報、ポリシーデータ、SKUを渡す）
    const preparedData = prepareTransferDataWithMapping(itemInfo, specInfo, listingSheet, headerMapping, policyData, sku);
    Logger.log('ステップ11: prepareTransferDataWithMapping完了');
    const transferData = preparedData.data;
    const specColors = preparedData.specColors;

    // 数式列の数式を保存（転記前）
    const formulaHeaders = [
      LISTING_COLUMNS.VOLUMETRIC_WEIGHT.header  // 容積重量(g)
      // 適用重量(g)は計算値として設定するため数式保存対象外
    ];

    const savedFormulas = [];
    formulaHeaders.forEach(function(header) {
      const col = getColumnByHeader(headerMapping, header);
      if (col) {
        const formula = listingSheet.getRange(newRow, col).getFormula();
        savedFormulas.push({ col: col, formula: formula });
      }
    });

    // データを転記
    listingSheet.getRange(newRow, 1, 1, transferData.length).setValues([transferData]);

    // 出品シートのコンディション列にプルダウンを設定（選択済み値はsetValuesで転記済み）
    const conditionColNum = getColumnByHeader(headerMapping, LISTING_COLUMNS.CONDITION.header);
    if (conditionColNum) {
      try {
        const conditionRule = buildConditionValidationRule(String(specInfo.category.categoryId || ''));
        if (conditionRule) {
          listingSheet.getRange(newRow, conditionColNum).setDataValidation(conditionRule);
          Logger.log('✅ 出品シートのコンディション列にプルダウン設定完了: カテゴリID=' + specInfo.category.categoryId);
        }
      } catch (dropdownErr) {
        Logger.log('⚠️ コンディションプルダウン設定失敗（無視）: ' + dropdownErr.toString());
      }
    }

    // Item Specificsの項目名に色を設定
    Logger.log('色設定開始: ' + specColors.length + '個');
    specColors.forEach(function(colorInfo, index) {
      const colNum = colorInfo.colIndex + 1;
      Logger.log('[' + index + '] 色設定: colIndex=' + colorInfo.colIndex + ', colNum=' + colNum + ', color=' + colorInfo.color);

      if (!colNum || colNum === null || colNum === undefined || isNaN(colNum) || colNum < 1) {
        const errorMsg = 'Item Specificsの設定中にエラーが発生しました。\n出品シートのItem Specifics列（項目名列）が正しく設定されているか確認してください。';
        Logger.log(errorMsg);
        throw new Error(errorMsg);
      }

      const cell = listingSheet.getRange(newRow, colNum);
      cell.setFontColor(colorInfo.color);
    });

    // 商品ページURLから画像をスクレイピング取得してGoogleドライブに保存
    let productPageUrl = researchSheet.getRange(RESEARCH_PRICE_INFO.DATA_ROW, RESEARCH_PRICE_INFO.COLUMNS.IMAGE_URL.col).getValue();

    // 画像URLが空白の場合、仕入元URL①を使用
    if (!productPageUrl || productPageUrl.toString().trim() === '') {
      const purchaseUrl1 = researchSheet.getRange(RESEARCH_PRICE_INFO.DATA_ROW, RESEARCH_PRICE_INFO.COLUMNS.PURCHASE_URL_1.col).getValue();
      if (purchaseUrl1 && purchaseUrl1.toString().trim() !== '') {
        Logger.log('📋 画像URLが空白のため、仕入元URL①を使用します: ' + purchaseUrl1);
        productPageUrl = purchaseUrl1;
      }
    }

    if (productPageUrl && productPageUrl.toString().trim() !== '') {
      SpreadsheetApp.getActiveSpreadsheet().toast('商品ページから画像を取得中...', 'eBay 出品', 5);

      const imageFolderUrl = config.imageFolderUrl;
      Logger.log('📁 画像フォルダURL: ' + imageFolderUrl);

      if (imageFolderUrl) {
        // 商品ページURLから画像URLを抽出（スクレイピング）
        Logger.log('商品ページから画像URLを抽出中: ' + productPageUrl);
        const imageUrls = extractImageUrlsFromProductPage(productPageUrl.toString());
        Logger.log('抽出した画像数: ' + imageUrls.length + '枚');

        if (imageUrls.length > 0) {
          // 共通情報を生成
          const now = new Date();
          const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HHmmss');
          const siteName = getSiteNameFromImageUrl(productPageUrl.toString()); // 商品ページURLからサイト名を判定

          // 各画像をダウンロード
          const savedCount = Math.min(imageUrls.length, 23); // 最大23枚
          SpreadsheetApp.getActiveSpreadsheet().toast(savedCount + '枚の画像をダウンロード中...', 'eBay 出品', 5);

          for (let i = 0; i < savedCount; i++) {
            const imageUrl = imageUrls[i];
            const imageNumber = String(i + 1).padStart(2, '0'); // 01, 02, 03...
            const baseFileName = dateStr + '_' + timeStr + '_' + siteName + '_' + staffName + '_' + imageNumber;

            Logger.log('画像' + (i + 1) + '/' + savedCount + 'をダウンロード中: ' + imageUrl);

            const imageResult = downloadAndSaveImage(imageUrl, imageFolderUrl, baseFileName);

            if (imageResult.success) {
              // 画像1～23列に保存したURLを出力
              const imageColumnKey = 'IMAGE_' + (i + 1);
              const imageHeaderName = LISTING_COLUMNS[imageColumnKey] ? LISTING_COLUMNS[imageColumnKey].header : null;

              if (!imageHeaderName) {
                Logger.log('⚠️ 警告: ' + imageColumnKey + ' がLISTING_COLUMNSに存在しません');
              } else {
                const imageCol = getColumnByHeader(headerMapping, imageHeaderName);
                Logger.log('画像' + (i + 1) + ': imageCol=' + imageCol + ', imageHeaderName=' + imageHeaderName);

                if (!imageCol || imageCol === null || imageCol === undefined) {
                  Logger.log('⚠️ 警告: 出品シートのヘッダー行（3行目）に「' + imageHeaderName + '」列が見つかりません。この画像の保存をスキップします。');
                } else {
                  listingSheet.getRange(newRow, imageCol).setValue(imageResult.driveUrl);
                  Logger.log('✅ 画像' + (i + 1) + 'を' + imageCol + '列目(' + imageHeaderName + ')に保存: ' + imageResult.driveUrl);
                }
              }
            } else {
              Logger.log('❌ 画像' + (i + 1) + 'のダウンロードに失敗: ' + imageResult.message);
            }

            // レート制限対策
            if (i < savedCount - 1) {
              Utilities.sleep(500);
            }
          }

          SpreadsheetApp.getActiveSpreadsheet().toast(savedCount + '枚の画像を保存しました', 'eBay 出品', 3);
        } else {
          Logger.log('警告: 商品ページから画像を抽出できませんでした');
          SpreadsheetApp.getActiveSpreadsheet().toast('画像が見つかりませんでした', 'eBay 出品', 3);
        }
      } else {
        Logger.log('警告: 画像フォルダが設定されていないため、画像をスキップしました');
      }
    }

    // 数式を復元（転記後）
    savedFormulas.forEach(function(item) {
      if (item.col && item.formula && item.formula !== '') {
        listingSheet.getRange(newRow, item.col).setFormula(item.formula);
      } else {
        Logger.log('数式復元スキップ: col=' + item.col + ', formula=' + item.formula);
      }
    });

    Logger.log('出品データを転記しました（行: ' + newRow + '、SKU: ' + sku + '、Item Specifics色設定: ' + specColors.length + '件）');

    // 完了メッセージを表示
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '転記完了 (' + policyLabel + ')',
      'SKU: ' + sku + '\n出品シートの' + newRow + '行目に転記しました。',
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log('transferListingDataWithPolicyエラー: ' + error.toString());

    // エラー発生時: SKUで予約した行をクリア
    if (reservedRow && reservedSheet && reservedSkuCol) {
      try {
        Logger.log('エラー発生のため、予約した行をクリアします（行: ' + reservedRow + '）');
        reservedSheet.getRange(reservedRow, reservedSkuCol).clearContent();
        SpreadsheetApp.flush();
        Logger.log('予約行のクリア完了');
      } catch (clearError) {
        Logger.log('予約行のクリアに失敗: ' + clearError.toString());
      }
    }

    SpreadsheetApp.getUi().alert('転記エラー:\n\n' + error.toString());
  }
}

