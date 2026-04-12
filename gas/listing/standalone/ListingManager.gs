/**
 * eBay出品管理 - 出品機能（Trading API）
 *
 * "出品"シートからデータを読み取り、eBay Trading APIを使用して新規リスティングを作成
 */

/**
 * 出品シートのヘッダーマッピングを取得
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Object} ヘッダー名→列番号のマッピング
 */
function getListingSheetHeaderMapping(spreadsheetId) {
  if (spreadsheetId) {
    CURRENT_SPREADSHEET_ID = spreadsheetId;
  }

  const listingSheet = getTargetSpreadsheet()
    .getSheetByName(SHEET_NAMES.LISTING);

  if (!listingSheet) {
    throw new Error('"出品"シートが見つかりません');
  }

  // buildHeaderMapping()はConfig.gsで定義済み（3行目をヘッダーとして読み取り）
  return buildHeaderMapping();
}

/**
 * ヘッダーマッピングから値を取得
 *
 * @param {Array} rowData 行データ配列
 * @param {Object} headerMapping ヘッダーマッピング
 * @param {string} headerName ヘッダー名
 * @returns {*} セルの値（見つからない場合はnull）
 */
function getValueByHeader(rowData, headerMapping, headerName) {
  const colIndex = headerMapping[headerName];
  if (!colIndex) return null;
  return rowData[colIndex - 1]; // 1-based → 0-based
}

/**
 * Item Specifics（項目名1～20、内容1～20）を抽出
 *
 * @param {Array} rowData 行データ配列
 * @param {Object} headerMapping ヘッダーマッピング
 * @returns {Array} [{ name: '...', value: '...' }, ...]
 */
function extractItemSpecifics(rowData, headerMapping) {
  const specifics = [];

  for (let i = 1; i <= 20; i++) {
    const nameHeader = '項目名（' + i + '）';
    const valueHeader = '内容（' + i + '）';

    const name = getValueByHeader(rowData, headerMapping, nameHeader);
    const value = getValueByHeader(rowData, headerMapping, valueHeader);

    if (name && value) {
      specifics.push({
        name: String(name).trim(),
        value: String(value).trim()
      });
    }
  }

  return specifics;
}

/**
 * Descriptionテンプレートから完成版を生成
 *
 * Description_テンプレシートから指定されたテンプレート名のテンプレートを取得し、
 * {説明文}プレースホルダーを状態説明で置換します。
 *
 * @param {string} templateName テンプレート名（出品シートのDescription列の値）
 * @param {string} conditionDescription 状態説明（置換する文章）
 * @param {string} spreadsheetId スプレッドシートID
 * @returns {string} 生成されたDescription（テンプレートが見つからない場合はtemplateName をそのまま返す）
 */
function generateDescriptionFromTemplate(templateName, conditionDescription, spreadsheetId) {
  try {
    Logger.log('=== Description生成開始 ===');
    Logger.log('テンプレート名: "' + templateName + '"');
    Logger.log('状態説明: "' + (conditionDescription ? String(conditionDescription).substring(0, 50) + '...' : '(空)') + '"');

    // テンプレート名が空の場合はそのまま返す
    if (!templateName || String(templateName).trim() === '') {
      Logger.log('⚠️ テンプレート名が空です。変換せずに返します。');
      return templateName;
    }

    // Description_テンプレシートを取得
    const ss = spreadsheetId
      ? SpreadsheetApp.openById(spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();

    const templateSheet = ss.getSheetByName('Description_テンプレ');

    if (!templateSheet) {
      Logger.log('❌ "Description_テンプレ"シートが見つかりません。テンプレート名をそのまま返します。');
      return templateName;
    }

    Logger.log('✅ Description_テンプレシートが見つかりました');

    // ヘッダー行を取得（1行目）
    const lastRow = templateSheet.getLastRow();
    const lastCol = templateSheet.getLastColumn();

    if (lastRow < 2) {
      Logger.log('⚠️ Description_テンプレシートにデータがありません');
      return templateName;
    }

    const headers = templateSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    Logger.log('ヘッダー: ' + JSON.stringify(headers));

    // ヘッダーマッピングを作成
    const headerMapping = {};
    for (let i = 0; i < headers.length; i++) {
      const headerName = headers[i];
      if (headerName) {
        headerMapping[headerName] = i + 1;
      }
    }

    const templateNameCol = headerMapping['テンプレート名'];
    const templateCol = headerMapping['テンプレート'];

    if (!templateNameCol) {
      Logger.log('❌ "テンプレート名"列が見つかりません');
      return templateName;
    }

    if (!templateCol) {
      Logger.log('❌ "テンプレート"列が見つかりません');
      return templateName;
    }

    Logger.log('「テンプレート名」列: ' + templateNameCol);
    Logger.log('「テンプレート」列: ' + templateCol);

    // データを取得（2行目以降）
    const data = templateSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    // テンプレート名で検索
    let foundTemplate = null;
    for (let i = 0; i < data.length; i++) {
      const name = data[i][templateNameCol - 1]; // 0-based
      const template = data[i][templateCol - 1]; // 0-based

      if (name && String(name).trim() === String(templateName).trim()) {
        foundTemplate = template;
        Logger.log('✅ テンプレート発見: 行' + (i + 2));
        break;
      }
    }

    if (!foundTemplate) {
      Logger.log('⚠️ テンプレート名"' + templateName + '"に該当するテンプレートが見つかりません');
      Logger.log('利用可能なテンプレート名:');
      for (let i = 0; i < data.length; i++) {
        const name = data[i][templateNameCol - 1];
        if (name) {
          Logger.log('  - "' + name + '"');
        }
      }
      return templateName;
    }

    // {説明文}を置換
    let description = String(foundTemplate);

    if (conditionDescription && String(conditionDescription).trim() !== '') {
      description = description.replace(/\{説明文\}/g, String(conditionDescription));
      Logger.log('✅ {説明文}を置換しました');
    } else {
      Logger.log('⚠️ 状態説明が空です。{説明文}はそのまま残ります');
    }

    Logger.log('生成されたDescription（最初の100文字）: ' + description.substring(0, 100) + '...');
    Logger.log('=== Description生成完了 ===');

    return description;

  } catch (error) {
    Logger.log('❌ Description生成エラー: ' + error.toString());
    if (error.stack) {
      Logger.log('スタックトレース: ' + error.stack);
    }
    // エラーが発生した場合はテンプレート名をそのまま返す
    return templateName;
  }
}

/**
 * 画像URL（画像1～23 + ストア画像）を抽出
 *
 * ストア画像は商品画像の最後尾に自動追加:
 * - 商品画像2枚 → 3枚目にストア画像
 * - 商品画像20枚 → 21枚目にストア画像
 * - 商品画像0枚 → 1枚目にストア画像
 *
 * @param {Array} rowData 行データ配列
 * @param {Object} headerMapping ヘッダーマッピング
 * @returns {Array} 画像URLの配列
 */
function extractImageUrls(rowData, headerMapping) {
  const urls = [];

  // 1. 商品画像（画像1～23）を取得
  for (let i = 1; i <= 23; i++) {
    const imageHeader = '画像' + i;
    const url = getValueByHeader(rowData, headerMapping, imageHeader);

    if (url && String(url).trim() !== '') {
      urls.push(String(url).trim());
    }
  }

  Logger.log('商品画像数: ' + urls.length + '枚');

  // 2. ストア画像を最後尾に追加
  const storeImageUrl = getValueByHeader(rowData, headerMapping, 'ストア画像');

  if (storeImageUrl && String(storeImageUrl).trim() !== '') {
    urls.push(String(storeImageUrl).trim());
    Logger.log('✅ ストア画像を' + urls.length + '枚目に追加: ' + String(storeImageUrl).substring(0, 50) + '...');
  } else {
    Logger.log('⚠️ ストア画像が設定されていません');
  }

  Logger.log('最終画像数: ' + urls.length + '枚（商品画像 + ストア画像）');

  return urls;
}

/**
 * 指定行のワード判定値を返す
 *
 * @param {string} spreadsheetId
 * @param {number} rowNumber
 * @returns {string} ワード判定の値（例: "VERO", "禁止ワード", "" など）
 */
function getWordCheckValue(spreadsheetId, rowNumber) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    const sheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.LISTING);
    if (!sheet) return '';
    const headerMapping = getListingSheetHeaderMapping(spreadsheetId);
    const col = headerMapping['ワード判定'];
    if (!col) return '';
    return String(sheet.getRange(rowNumber, col).getValue() || '').trim();
  } catch (e) {
    Logger.log('getWordCheckValue エラー: ' + e.toString());
    return '';
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * "出品"シートから指定行のデータを読み取り
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @param {number} rowNumber 行番号（4行目以降）
 * @returns {Object} 出品データ
 */
function readListingDataFromSheet(spreadsheetId, rowNumber) {
  if (spreadsheetId) {
    CURRENT_SPREADSHEET_ID = spreadsheetId;
  }

  const listingSheet = getTargetSpreadsheet()
    .getSheetByName(SHEET_NAMES.LISTING);

  if (!listingSheet) {
    throw new Error('"出品"シートが見つかりません');
  }

  const headerMapping = getListingSheetHeaderMapping(spreadsheetId);
  const lastCol = listingSheet.getLastColumn();
  const rowData = listingSheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];

  // ヘッダーマッピングを使用してフィールドを抽出
  const data = {
    sku: getValueByHeader(rowData, headerMapping, 'SKU'),
    title: getValueByHeader(rowData, headerMapping, 'タイトル'),
    condition: getValueByHeader(rowData, headerMapping, '状態'),
    conditionDescription: getValueByHeader(rowData, headerMapping, '状態説明'),
    description: getValueByHeader(rowData, headerMapping, 'Description'),
    categoryId: getValueByHeader(rowData, headerMapping, 'カテゴリID'),
    brand: getValueByHeader(rowData, headerMapping, 'Brand'),
    upc: getValueByHeader(rowData, headerMapping, 'UPC'),
    ean: getValueByHeader(rowData, headerMapping, 'EAN'),
    mpn: getValueByHeader(rowData, headerMapping, 'MPN(型番可)'),

    // ポリシー
    shippingPolicy: getValueByHeader(rowData, headerMapping, 'Shipping Policy'),
    returnPolicy: getValueByHeader(rowData, headerMapping, 'Return Policy'),
    paymentPolicy: getValueByHeader(rowData, headerMapping, 'Payment Policy'),

    // 価格・数量
    quantity: getValueByHeader(rowData, headerMapping, '個数'),
    price: getValueByHeader(rowData, headerMapping, '売値($)'),
    bestOfferEnabled: String(getValueByHeader(rowData, headerMapping, 'Best Offer') || '').trim().toUpperCase() === 'ON',
    autoAcceptPrice:  getValueByHeader(rowData, headerMapping, '承認価格'),
    autoDeclinePrice: getValueByHeader(rowData, headerMapping, '拒否価格'),
    promotedListing:  getValueByHeader(rowData, headerMapping, 'Promoted Listing'),

    // ワード判定
    wordCheck: getValueByHeader(rowData, headerMapping, 'ワード判定'),

    // Item Specifics（動的に1-20まで取得）
    itemSpecifics: extractItemSpecifics(rowData, headerMapping),

    // 画像（1-23 + ストア画像を最後尾に自動追加）
    images: extractImageUrls(rowData, headerMapping)
  };

  // Descriptionをテンプレートから生成
  // Description列に入力されている値をテンプレート名として扱う
  if (data.description && String(data.description).trim() !== '') {
    Logger.log('Descriptionテンプレート生成を試行中...');
    data.description = generateDescriptionFromTemplate(
      data.description,
      data.conditionDescription,
      spreadsheetId
    );
  }

  Logger.log('データ読み取り完了: SKU=' + data.sku);

  return data;
}

/**
 * 出品データのバリデーション
 *
 * @param {Object} data 出品データ
 * @returns {Array<string>} エラーメッセージの配列（エラーなしの場合は空配列）
 */
function validateListingData(data) {
  const errors = [];

  // ワード判定チェック（最優先）
  const wordCheckResult = data.wordCheck ? String(data.wordCheck).trim() : '';
  if (wordCheckResult === '禁止ワード') {
    errors.push('⛔ 禁止ワードが検出されました。この商品は出品できません。');
    // 禁止ワードの場合は即座にエラーを返す
    return errors;
  }
  // VERO は警告のみ（ブロックしない）

  // 必須フィールド
  if (!data.sku || String(data.sku).trim() === '') {
    errors.push('SKUが入力されていません');
  }
  if (!data.title || String(data.title).trim() === '') {
    errors.push('タイトルが入力されていません');
  }
  if (!data.categoryId) {
    errors.push('カテゴリIDが入力されていません');
  }
  if (!data.quantity || data.quantity <= 0) {
    errors.push('個数が正しく入力されていません');
  }
  if (!data.price || data.price <= 0) {
    errors.push('売値($)が正しく入力されていません');
  }
  if (!data.shippingPolicy || String(data.shippingPolicy).trim() === '') {
    errors.push('Shipping Policyが選択されていません');
  }
  if (!data.returnPolicy || String(data.returnPolicy).trim() === '') {
    errors.push('Return Policyが選択されていません');
  }
  if (!data.paymentPolicy || String(data.paymentPolicy).trim() === '') {
    errors.push('Payment Policyが選択されていません');
  }
  if (!data.description || String(data.description).trim() === '') {
    errors.push('⚠️ Descriptionテンプレートが選択されていません。プルダウンからテンプレートを選択してください。');
  }

  // タイトル文字数制限（80文字）
  if (data.title && data.title.length > 80) {
    errors.push('タイトルは80文字以内にしてください（現在: ' + data.title.length + '文字）');
  }

  // SKU文字数制限（50文字）
  if (data.sku && data.sku.length > 50) {
    errors.push('SKUは50文字以内にしてください');
  }

  // Best Offer バリデーション
  if (data.bestOfferEnabled) {
    const price       = parseFloat(data.price);
    const autoAccept  = data.autoAcceptPrice  !== '' && data.autoAcceptPrice  !== null ? parseFloat(data.autoAcceptPrice)  : null;
    const autoDecline = data.autoDeclinePrice !== '' && data.autoDeclinePrice !== null ? parseFloat(data.autoDeclinePrice) : null;

    if (autoDecline !== null && autoDecline < 0) {
      errors.push('拒否価格 は 0 以上の値を入力してください');
    }
    if (autoAccept !== null && autoDecline !== null && autoAccept <= autoDecline) {
      errors.push('承認価格 は 拒否価格 より大きい値を入力してください');
    }
    if (autoAccept !== null && !isNaN(price) && autoAccept > price) {
      errors.push('承認価格 は即決価格（' + price + '$）以下にしてください');
    }
  }

  return errors;
}

/**
 * ポリシー名をポリシーIDに変換
 *
 * @param {Object} data 出品データ
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @returns {Object} { shippingPolicyId, returnPolicyId, paymentPolicyId }
 */
function convertPolicyNamesToIds(data, spreadsheetId) {
  // PolicyManager.gsで定義されているgetPolicyIdByName()を使用
  const shippingPolicyId = getPolicyIdByName(data.shippingPolicy, 'Fulfillment Policy');
  const returnPolicyId = getPolicyIdByName(data.returnPolicy, 'Return Policy');
  const paymentPolicyId = getPolicyIdByName(data.paymentPolicy, 'Payment Policy');

  if (!shippingPolicyId) {
    throw new Error('Shipping Policy "' + data.shippingPolicy + '" が見つかりません。先に「ポリシー取得（タイプ別）」を実行してください。');
  }
  if (!returnPolicyId) {
    throw new Error('Return Policy "' + data.returnPolicy + '" が見つかりません。先に「ポリシー取得（タイプ別）」を実行してください。');
  }
  if (!paymentPolicyId) {
    throw new Error('Payment Policy "' + data.paymentPolicy + '" が見つかりません。先に「ポリシー取得（タイプ別）」を実行してください。');
  }

  Logger.log('ポリシーID変換完了:');
  Logger.log('- Shipping: ' + data.shippingPolicy + ' → ' + shippingPolicyId);
  Logger.log('- Return: ' + data.returnPolicy + ' → ' + returnPolicyId);
  Logger.log('- Payment: ' + data.paymentPolicy + ' → ' + paymentPolicyId);

  return {
    shippingPolicyId: shippingPolicyId,
    returnPolicyId: returnPolicyId,
    paymentPolicyId: paymentPolicyId
  };
}

/**
 * 状態値をeBay ConditionIDにマッピング
 *
 * @param {string} conditionStr "状態"列の値
 * @returns {string} eBay ConditionID
 */
function mapConditionId(conditionStr) {
  const mapping = {
    'New': '1000',
    'Used': '3000',
    'Like New': '1500',
    'Very Good': '4000',
    'Good': '5000',
    'Acceptable': '6000'
  };

  const mapped = mapping[conditionStr];

  if (!mapped) {
    Logger.log('⚠️ 状態値が不明です（' + conditionStr + '）。デフォルト値3000(Used)を使用します。');
    return '3000'; // デフォルト: Used
  }

  return mapped;
}

/**
 * XMLエスケープ
 *
 * @param {string} str エスケープする文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Trading API: AddItem（出品作成）
 *
 * @param {Object} listingData 出品データ
 * @param {Object} policyIds ポリシーID
 * @returns {Object} { itemId: string, success: boolean }
 */
function addItemWithTradingApi(listingData, policyIds) {
  const token = getUserToken();
  const config = getEbayConfig();
  const apiUrl = getTradingApiUrl();

  // XMLリクエストボディ構築
  let xmlBody = '<?xml version="1.0" encoding="utf-8"?>' +
    '<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
    '<RequesterCredentials>' +
    '<eBayAuthToken>' + escapeXml(token) + '</eBayAuthToken>' +
    '</RequesterCredentials>' +
    '<Item>' +
    '<Title>' + escapeXml(listingData.title) + '</Title>' +
    '<Description><![CDATA[' + (listingData.description || '') + ']]></Description>' +
    '<PrimaryCategory><CategoryID>' + listingData.categoryId + '</CategoryID></PrimaryCategory>' +
    '<StartPrice>' + listingData.price + '</StartPrice>' +
    '<ConditionID>' + mapConditionId(listingData.condition) + '</ConditionID>' +
    '<Country>US</Country>' +
    '<Currency>USD</Currency>' +
    '<DispatchTimeMax>3</DispatchTimeMax>' +
    '<ListingDuration>GTC</ListingDuration>' +
    '<ListingType>FixedPriceItem</ListingType>' +
    '<Location>' + escapeXml(config.itemLocation) + '</Location>' +
    (config.postalCode ? '<PostalCode>' + escapeXml(config.postalCode) + '</PostalCode>' : '') +
    '<PaymentMethods>PayPal</PaymentMethods>' +
    '<Quantity>' + parseInt(listingData.quantity) + '</Quantity>' +
    '<Site>US</Site>';

  // SKU
  if (listingData.sku) {
    xmlBody += '<SKU>' + escapeXml(listingData.sku) + '</SKU>';
  }

  // ConditionDescription
  if (listingData.conditionDescription) {
    xmlBody += '<ConditionDescription>' + escapeXml(listingData.conditionDescription) + '</ConditionDescription>';
  }

  // 画像
  if (listingData.images && listingData.images.length > 0) {
    xmlBody += '<PictureDetails>';
    listingData.images.forEach(function(url) {
      xmlBody += '<PictureURL>' + escapeXml(url) + '</PictureURL>';
    });
    xmlBody += '</PictureDetails>';
  }

  // Seller Profiles（ポリシー）
  // Best Offer ON の場合は支払いポリシーを除外（ポリシー側の即時支払い設定が Error 23015 を引き起こすため）
  const hasBestOffer = listingData.bestOfferEnabled === true;
  xmlBody += '<SellerProfiles>' +
    '<SellerShippingProfile>' +
    '<ShippingProfileID>' + policyIds.shippingPolicyId + '</ShippingProfileID>' +
    '</SellerShippingProfile>' +
    '<SellerReturnProfile>' +
    '<ReturnProfileID>' + policyIds.returnPolicyId + '</ReturnProfileID>' +
    '</SellerReturnProfile>' +
    (hasBestOffer ? '' :
      '<SellerPaymentProfile>' +
      '<PaymentProfileID>' + policyIds.paymentPolicyId + '</PaymentProfileID>' +
      '</SellerPaymentProfile>'
    ) +
    '</SellerProfiles>';

  // Item Specifics
  if (listingData.itemSpecifics && listingData.itemSpecifics.length > 0) {
    xmlBody += '<ItemSpecifics>';
    listingData.itemSpecifics.forEach(function(spec) {
      xmlBody += '<NameValueList>' +
        '<Name>' + escapeXml(spec.name) + '</Name>' +
        '<Value>' + escapeXml(spec.value) + '</Value>' +
        '</NameValueList>';
    });
    xmlBody += '</ItemSpecifics>';
  }

  // Product Identifiers (UPC, EAN, MPN, Brand)
  if (listingData.upc || listingData.ean || listingData.mpn || listingData.brand) {
    xmlBody += '<ProductListingDetails>';
    if (listingData.upc) {
      xmlBody += '<UPC>' + escapeXml(listingData.upc) + '</UPC>';
    }
    if (listingData.ean) {
      xmlBody += '<EAN>' + escapeXml(listingData.ean) + '</EAN>';
    }
    if (listingData.brand) {
      xmlBody += '<BrandMPN>' +
        '<Brand>' + escapeXml(listingData.brand) + '</Brand>';
      if (listingData.mpn) {
        xmlBody += '<MPN>' + escapeXml(listingData.mpn) + '</MPN>';
      }
      xmlBody += '</BrandMPN>';
    }
    xmlBody += '</ProductListingDetails>';
  }

  // Best Offer
  if (hasBestOffer) {
    xmlBody += '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>';

    const autoAccept  = listingData.autoAcceptPrice  !== '' && listingData.autoAcceptPrice  !== null ? parseFloat(listingData.autoAcceptPrice)  : null;
    const autoDecline = listingData.autoDeclinePrice !== '' && listingData.autoDeclinePrice !== null ? parseFloat(listingData.autoDeclinePrice) : null;

    if (autoAccept !== null || autoDecline !== null) {
      let listingDetails = '';
      if (autoDecline !== null && !isNaN(autoDecline)) {
        listingDetails += '<MinimumBestOfferPrice currencyID="USD">' + autoDecline + '</MinimumBestOfferPrice>';
      }
      if (autoAccept !== null && !isNaN(autoAccept)) {
        listingDetails += '<BestOfferAutoAcceptPrice currencyID="USD">' + autoAccept + '</BestOfferAutoAcceptPrice>';
      }
      xmlBody += '<ListingDetails>' + listingDetails + '</ListingDetails>';
    }

    xmlBody += '<AutoPay>false</AutoPay>';
  } else {
    xmlBody += '<AutoPay>true</AutoPay>';
  }

  xmlBody += '</Item>' +
    '</AddItemRequest>';

  // HTTPリクエスト
  const options = {
    method: 'post',
    headers: {
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_API_VERSION,
      'X-EBAY-API-CALL-NAME': 'AddItem',
      'X-EBAY-API-APP-NAME': config.appId,
      'X-EBAY-API-DEV-NAME': config.devId,
      'X-EBAY-API-CERT-NAME': config.certId,
      'Content-Type': 'text/xml;charset=utf-8'
    },
    payload: xmlBody,
    muteHttpExceptions: true
  };

  Logger.log('=== Trading API: AddItem ===');
  Logger.log('API URL: ' + apiUrl);
  Logger.log('SKU: ' + listingData.sku);

  const response = UrlFetchApp.fetch(apiUrl, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  Logger.log('Response Code: ' + statusCode);

  if (statusCode !== 200) {
    Logger.log('❌ HTTP Error: ' + statusCode);
    Logger.log(responseText);
    throw new Error('Trading API HTTPエラー(' + statusCode + '): ' + responseText);
  }

  // XMLレスポンスをパース
  const xmlResponse = XmlService.parse(responseText);
  const root = xmlResponse.getRootElement();
  const ns = XmlService.getNamespace('urn:ebay:apis:eBLBaseComponents');

  // Ackをチェック
  const ackElement = root.getChild('Ack', ns);
  const ack = ackElement ? ackElement.getText() : '';

  if (ack === 'Success' || ack === 'Warning') {
    const itemIdElement = root.getChild('ItemID', ns);
    const itemId = itemIdElement ? itemIdElement.getText() : '';

    Logger.log('✅ 出品成功: Item ID = ' + itemId);

    // Warningがある場合はログ出力
    if (ack === 'Warning') {
      const errorsElement = root.getChild('Errors', ns);
      if (errorsElement) {
        const shortMsg = errorsElement.getChild('ShortMessage', ns);
        const longMsg = errorsElement.getChild('LongMessage', ns);
        Logger.log('⚠️ Warning: ' + (shortMsg ? shortMsg.getText() : ''));
        Logger.log('詳細: ' + (longMsg ? longMsg.getText() : ''));
      }
    }

    return {
      success: true,
      itemId: itemId
    };
  } else {
    // エラー処理
    const errorsElement = root.getChild('Errors', ns);
    let errorMessage = 'Unknown error';

    if (errorsElement) {
      const errorCode = errorsElement.getChild('ErrorCode', ns);
      const shortMsg = errorsElement.getChild('ShortMessage', ns);
      const longMsg = errorsElement.getChild('LongMessage', ns);

      errorMessage = 'ErrorCode: ' + (errorCode ? errorCode.getText() : '') + '\n' +
        'Message: ' + (shortMsg ? shortMsg.getText() : '') + '\n' +
        'Details: ' + (longMsg ? longMsg.getText() : '');
    }

    Logger.log('❌ 出品失敗: ' + errorMessage);
    Logger.log('Full Response: ' + responseText);

    throw new Error('Trading API出品エラー:\n' + errorMessage);
  }
}

/**
 * Promoted Listing設定（Marketing API）
 *
 * @param {string} itemId Item ID
 * @param {number} adRate 広告料率（パーセント）例: 5 → 5%
 * @returns {Object} { success: boolean, adId?: string, error?: string }
 */
function createPromotedListing(itemId, adRate) {
  try {
    const token = getUserToken();
    const apiUrl = getMarketingApiUrl() + '/ad_campaign';

    // 1. デフォルトキャンペーンを検索または作成
    // 既存のアクティブなキャンペーンを取得
    const getCampaignsUrl = apiUrl + '?campaign_status=RUNNING&limit=1';
    const getCampaignsOptions = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    const campaignsResponse = UrlFetchApp.fetch(getCampaignsUrl, getCampaignsOptions);
    const campaignsData = JSON.parse(campaignsResponse.getContentText());

    let campaignId;

    if (campaignsData.campaigns && campaignsData.campaigns.length > 0) {
      // 既存のキャンペーンを使用
      campaignId = campaignsData.campaigns[0].campaignId;
      Logger.log('既存キャンペーン使用: ' + campaignId);
    } else {
      // 新規キャンペーン作成
      const createCampaignPayload = {
        campaignName: 'Auto Promoted Listings',
        startDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        fundingStrategy: {
          fundingModel: 'COST_PER_SALE'
        },
        marketplaceId: 'EBAY_US'
      };

      const createCampaignOptions = {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(createCampaignPayload),
        muteHttpExceptions: true
      };

      const createCampaignResponse = UrlFetchApp.fetch(apiUrl, createCampaignOptions);
      const createCampaignData = JSON.parse(createCampaignResponse.getContentText());

      if (createCampaignResponse.getResponseCode() !== 201) {
        throw new Error('キャンペーン作成失敗: ' + createCampaignResponse.getContentText());
      }

      campaignId = createCampaignData.campaignId;
      Logger.log('新規キャンペーン作成: ' + campaignId);
    }

    // 2. Adを作成（Item IDと広告料率を設定）
    const createAdUrl = apiUrl + '/' + campaignId + '/ad';
    const createAdPayload = {
      bidPercentage: String(adRate),
      listingId: itemId
    };

    const createAdOptions = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(createAdPayload),
      muteHttpExceptions: true
    };

    Logger.log('=== Promoted Listing設定 ===');
    Logger.log('Item ID: ' + itemId);
    Logger.log('Ad Rate: ' + adRate + '%');
    Logger.log('Campaign ID: ' + campaignId);

    const adResponse = UrlFetchApp.fetch(createAdUrl, createAdOptions);
    const adResponseCode = adResponse.getResponseCode();
    const adResponseText = adResponse.getContentText();

    if (adResponseCode !== 201 && adResponseCode !== 200) {
      Logger.log('❌ Ad作成エラー: ' + adResponseCode);
      Logger.log(adResponseText);
      return {
        success: false,
        error: 'Ad作成失敗(' + adResponseCode + '): ' + adResponseText
      };
    }

    const adData = JSON.parse(adResponseText);
    Logger.log('✅ Promoted Listing設定完了: Ad ID = ' + (adData.adId || adData.ads[0].adId));

    return {
      success: true,
      adId: adData.adId || (adData.ads && adData.ads[0] ? adData.ads[0].adId : null)
    };

  } catch (error) {
    Logger.log('❌ Promoted Listing設定エラー: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 出品データを"出品DB"スプレッドシートに転記
 *
 * @param {string} spreadsheetId 出品元スプレッドシートID
 * @param {number} rowNumber 出品した行番号
 * @param {Object} listingData 出品データ
 * @param {Object} result 出品結果 { itemId: string }
 * @returns {boolean} 転記成功
 */
function transferToOutputDb(spreadsheetId, rowNumber, listingData, result) {
  try {
    Logger.log('=== 出品DB転記開始 ===');

    // "ツール設定"から"出品DB" URLを取得
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;

    if (!outputDbId || outputDbId === '') {
      Logger.log('⚠️ "出品DB"が設定されていません。転記をスキップします。');
      return false;
    }

    Logger.log('出品DB ID: ' + outputDbId);

    // 出品DBスプレッドシートを開く
    const outputSpreadsheet = SpreadsheetApp.openById(outputDbId);
    let outputSheet = outputSpreadsheet.getSheetByName('出品');

    // シートが存在しない場合は作成
    if (!outputSheet) {
      outputSheet = outputSpreadsheet.insertSheet('出品');
      Logger.log('✅ "出品"シートを作成しました');
    }

    // ヘッダー行が存在しない場合は作成（1行目: タイトル、2行目: 補足、3行目: ヘッダー）
    const lastRow = outputSheet.getLastRow();
    if (lastRow < 3) {
      // 元の"出品"シートからヘッダーをコピー
      const sourceSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
      const sourceHeaders = sourceSheet.getRange(1, 1, 3, sourceSheet.getLastColumn()).getValues();

      outputSheet.getRange(1, 1, 3, sourceHeaders[0].length).setValues(sourceHeaders);
      Logger.log('✅ ヘッダー行をコピーしました');
    }

    // 出品元シートから行データを取得
    const sourceSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
    const lastCol = sourceSheet.getLastColumn();
    const rowData = sourceSheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];

    // ヘッダーマッピングを取得
    const headerMapping = buildHeaderMapping();

    // Item IDを追加
    const itemIdCol = headerMapping['Item ID'];
    if (itemIdCol) {
      rowData[itemIdCol - 1] = result.itemId;
      Logger.log('Item IDを設定: ' + result.itemId);
    }

    // 出品URLを生成して追加
    const listingUrl = 'https://www.ebay.com/itm/' + result.itemId;
    const listingUrlCol = headerMapping['出品URL'];
    if (listingUrlCol) {
      rowData[listingUrlCol - 1] = listingUrl;
      Logger.log('出品URLを設定: ' + listingUrl);
    } else {
      Logger.log('⚠️ "出品URL"列が見つかりません');
    }

    // 出品ステータスを"出品中"に設定
    const statusCol = headerMapping['ステータス'];
    if (statusCol) {
      rowData[statusCol - 1] = '出品中';
      Logger.log('ステータスを設定: 出品中');
    } else {
      Logger.log('⚠️ "ステータス"列が見つかりません');
    }

    // 現在日時を取得
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    // タイムスタンプフォーマット: yyyy/mm/dd/hh:mm:ss
    const timestamp = year + '/' + month + '/' + day + '/' + hour + ':' + minute + ':' + second;

    // 管理年月フォーマット: yyyymm (数値)
    const managementMonth = parseInt(year + month);

    // 出品タイムスタンプを設定
    const timestampCol = headerMapping['出品タイムスタンプ'];
    if (timestampCol) {
      rowData[timestampCol - 1] = timestamp;
      Logger.log('出品タイムスタンプを設定: ' + timestamp);
    } else {
      Logger.log('⚠️ "出品タイムスタンプ"列が見つかりません');
    }

    // 管理年月を設定
    const managementMonthCol = headerMapping['管理年月'];
    if (managementMonthCol) {
      rowData[managementMonthCol - 1] = managementMonth;
      Logger.log('管理年月を設定: ' + managementMonth);
    } else {
      Logger.log('⚠️ "管理年月"列が見つかりません');
    }

    // 出品DB末尾に追加
    const newRow = outputSheet.getLastRow() + 1;
    outputSheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);

    Logger.log('✅ 出品DB転記完了: ' + newRow + '行目に追加');

    return true;

  } catch (error) {
    Logger.log('❌ 出品DB転記エラー: ' + error.toString());
    // 転記エラーは致命的ではないので、エラーをログに記録して続行
    return false;
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 出品シートからデータをクリアして行を最下部に移動
 *
 * データをクリアして、SKUが入力されている最後尾の下に移動させる
 * これにより数式・入力規則・非表示設定を維持したまま、
 * データ行が上に集まり、空白行が下に集まる
 *
 * @param {string} spreadsheetId スプレッドシートID
 * @param {number} rowNumber クリアする行番号
 */
function clearAndMoveListingRow(spreadsheetId, rowNumber) {
  try {
    Logger.log('=== 出品シート行クリア・移動開始 ===');

    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    const listingSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);

    if (!listingSheet) {
      throw new Error('"出品"シートが見つかりません');
    }

    // 4行目以降のみ処理可能（ヘッダー保護）
    if (rowNumber < 4) {
      throw new Error('ヘッダー行（1-3行目）は処理できません');
    }

    // ヘッダーマッピングを取得してSKU列を特定
    const headerMapping = buildHeaderMapping();
    const skuCol = headerMapping['SKU'];

    if (!skuCol) {
      throw new Error('SKU列が見つかりません');
    }

    // データをクリア（数式・入力規則・書式は維持）
    const lastCol = listingSheet.getLastColumn();
    listingSheet.getRange(rowNumber, 1, 1, lastCol).clearContent();

    Logger.log('✅ データクリア完了: ' + rowNumber + '行目');

    // SKUが入力されている最後尾の行を検索
    const lastRow = listingSheet.getLastRow();
    let lastDataRow = 3; // 最低でも3行目（ヘッダー行）

    for (let i = lastRow; i >= 4; i--) {
      const skuValue = listingSheet.getRange(i, skuCol).getValue();
      if (skuValue && String(skuValue).trim() !== '') {
        lastDataRow = i;
        break;
      }
    }

    Logger.log('SKU最終データ行: ' + lastDataRow + '行目');

    // クリアした行が最終データ行より上にある場合のみ移動
    if (rowNumber <= lastDataRow) {
      // 行を移動（最終データ行の直下に移動）
      const targetRow = lastDataRow + 1;

      Logger.log('行を移動: ' + rowNumber + '行目 → ' + targetRow + '行目');

      // moveRowsを使用して行を移動
      listingSheet.moveRows(
        listingSheet.getRange(rowNumber + ':' + rowNumber),
        targetRow
      );

      Logger.log('✅ 行移動完了');
    } else {
      Logger.log('✅ すでに最下部にあるため移動不要');
    }

  } catch (error) {
    Logger.log('❌ 行クリア・移動エラー: ' + error.toString());
    throw error;
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 出品シートから行を削除（旧関数・互換性のため残す）
 *
 * @deprecated clearAndMoveListingRow() を使用してください
 * @param {string} spreadsheetId スプレッドシートID
 * @param {number} rowNumber 削除する行番号
 */
function deleteListingRow(spreadsheetId, rowNumber) {
  // 新しい関数に委譲
  clearAndMoveListingRow(spreadsheetId, rowNumber);
}

/**
 * 出品実行（メイン関数）
 *
 * @param {string} spreadsheetId スプレッドシートID（省略時はデフォルト使用）
 * @param {number} rowNumber 出品する行番号（4行目以降）
 * @returns {Object} { success: boolean, sku: string, itemId: string, promotedListing?: Object, transferred: boolean, rowCleared: boolean }
 */
function createListing(spreadsheetId, rowNumber) {
  try {
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    Logger.log('=== 出品処理開始: 行' + rowNumber + ' ===');

    // 1. データ読み取り
    const listingData = readListingDataFromSheet(spreadsheetId, rowNumber);

    // 2. バリデーション
    const errors = validateListingData(listingData);
    if (errors.length > 0) {
      throw new Error('入力エラー:\n' + errors.join('\n'));
    }

    // 3. ポリシーID変換
    const policyIds = convertPolicyNamesToIds(listingData, spreadsheetId);

    // 4. Trading API: AddItem実行
    const result = addItemWithTradingApi(listingData, policyIds);

    Logger.log('✅ 出品完了');

    // 5. Promoted Listing設定（値が入力されている場合のみ）
    let promotedListingResult = null;
    if (listingData.promotedListing && !isNaN(parseFloat(listingData.promotedListing))) {
      const adRate = parseFloat(listingData.promotedListing);
      promotedListingResult = createPromotedListing(result.itemId, adRate);

      if (!promotedListingResult.success) {
        Logger.log('⚠️ Promoted Listing設定に失敗しましたが、出品は成功しています');
        Logger.log('エラー: ' + promotedListingResult.error);
      }
    }

    // 6. 出品DBに転記
    const transferred = transferToOutputDb(spreadsheetId, rowNumber, listingData, result);

    // 7. 出品シートからデータをクリアして行を最下部に移動（転記成功時のみ）
    let rowCleared = false;
    if (transferred) {
      clearAndMoveListingRow(spreadsheetId, rowNumber);
      rowCleared = true;
    } else {
      Logger.log('⚠️ 転記がスキップされたため、行クリア・移動も省略します');
    }

    return {
      success: true,
      sku: listingData.sku,
      itemId: result.itemId,
      promotedListing: promotedListingResult,
      transferred: transferred,
      rowCleared: rowCleared,
      veroWarning: String(listingData.wordCheck || '').trim() === 'VERO'
    };

  } catch (error) {
    Logger.log('❌ 出品エラー: ' + error.toString());
    throw error;
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * onEdit処理: タイトル編集時に文字数を自動更新
 *
 * @param {Object} e onEditイベントオブジェクト
 * @param {string} spreadsheetId スプレッドシートID（省略時は現在のスプレッドシート）
 */
function processOnEdit(e, spreadsheetId) {
  try {
    Logger.log('=== processOnEdit開始 ===');

    // イベントオブジェクトが無い場合は何もしない
    if (!e || !e.range) {
      Logger.log('⚠️ イベントオブジェクトが無効です');
      return;
    }

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();
    const col = e.range.getColumn();
    const value = e.value || '';

    Logger.log('シート名: ' + sheetName);
    Logger.log('行: ' + row + ', 列: ' + col);
    Logger.log('値: ' + value);

    // "出品"シート以外は処理しない
    if (sheetName !== SHEET_NAMES.LISTING) {
      Logger.log('⚠️ "出品"シート以外なのでスキップ');
      return;
    }

    // ヘッダー行（1-3行目）は処理しない
    if (row <= 3) {
      Logger.log('⚠️ ヘッダー行なのでスキップ');
      return;
    }

    // スプレッドシートIDを設定
    if (spreadsheetId) {
      CURRENT_SPREADSHEET_ID = spreadsheetId;
    }

    // ヘッダーマッピングを取得
    Logger.log('ヘッダーマッピング取得中...');
    const headerMapping = getListingSheetHeaderMapping(spreadsheetId);
    Logger.log('ヘッダーマッピング: ' + JSON.stringify(headerMapping));

    // 編集された列が「タイトル」列かチェック
    const titleCol = headerMapping['タイトル'];
    Logger.log('タイトル列: ' + titleCol + ', 編集列: ' + col);

    if (!titleCol || col !== titleCol) {
      Logger.log('⚠️ タイトル列以外なのでスキップ');
      return; // タイトル列以外の編集は無視
    }

    // 「文字数」列の位置を取得
    const charCountCol = headerMapping['文字数'];
    Logger.log('文字数列: ' + charCountCol);

    if (!charCountCol) {
      Logger.log('❌ "文字数"列が見つかりません');
      return;
    }

    // タイトルの文字数を計算（スペースも1文字としてカウント）
    const charCount = value.length;
    Logger.log('文字数: ' + charCount);

    // 「文字数」列に書き込み
    sheet.getRange(row, charCountCol).setValue(charCount);

    Logger.log('✅ 文字数更新完了: 行' + row + ' = ' + charCount + '文字');

  } catch (error) {
    Logger.log('❌ onEdit処理エラー: ' + error.toString());
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * デバッグ用: ヘッダーマッピングを確認
 *
 * 「出品」シートのヘッダー行（3行目）を読み取り、
 * 各ヘッダー名と列番号のマッピングをログ出力します
 */
function debugHeaderMapping() {
  try {
    const spreadsheetId = null; // 現在のスプレッドシート使用
    const headerMapping = getListingSheetHeaderMapping(spreadsheetId);

    Logger.log('=== ヘッダーマッピング ===');
    Logger.log(JSON.stringify(headerMapping, null, 2));

    // タイトル列と文字数列を確認
    const titleCol = headerMapping['タイトル'];
    const charCountCol = headerMapping['文字数'];

    Logger.log('');
    Logger.log('タイトル列: ' + (titleCol || '見つかりません'));
    Logger.log('文字数列: ' + (charCountCol || '見つかりません'));

    if (!titleCol) {
      Logger.log('⚠️ "タイトル"列がヘッダー行（3行目）に存在しません');
    }
    if (!charCountCol) {
      Logger.log('⚠️ "文字数"列がヘッダー行（3行目）に存在しません');
    }

    return headerMapping;

  } catch (error) {
    Logger.log('❌ デバッグエラー: ' + error.toString());
    return null;
  }
}
