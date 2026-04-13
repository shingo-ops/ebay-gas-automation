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

  // buildHeaderMapping()はConfig.gsで定義済み（1行目をヘッダーとして読み取り）
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
 * @param {number} rowNumber 行番号（5行目以降）
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
  // ポリシーシートを1回だけ読み込んで3件を一括検索
  const policySheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.POLICY_SETTINGS);
  if (!policySheet) {
    throw new Error('"' + SHEET_NAMES.POLICY_SETTINGS + '"シートが見つかりません。先に「ポリシー取得」を実行してください。');
  }
  const columnMap   = getPolicySheetColumnMap(policySheet);
  const policyData  = policySheet.getDataRange().getValues();
  const typeCol     = columnMap.POLICY_TYPE - 1;
  const nameCol     = columnMap.POLICY_NAME - 1;
  const idCol       = columnMap.POLICY_ID   - 1;

  function lookupPolicy(targetName, targetType) {
    for (var i = 1; i < policyData.length; i++) {
      if (policyData[i][typeCol] === targetType && policyData[i][nameCol] === targetName) {
        Logger.log('ポリシーID検索: ' + targetName + ' → ' + policyData[i][idCol]);
        return policyData[i][idCol];
      }
    }
    Logger.log('⚠️ ポリシーが見つかりません: ' + targetType + ' - ' + targetName);
    return null;
  }

  const shippingPolicyId = lookupPolicy(data.shippingPolicy, 'Fulfillment Policy');
  const returnPolicyId   = lookupPolicy(data.returnPolicy,   'Return Policy');
  const paymentPolicyId  = lookupPolicy(data.paymentPolicy,  'Payment Policy');

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
/**
 * ja_display から condition_id を解決（カテゴリマスタの ja_map_json を逆引き）
 *
 * @param {string} conditionStr 状態列の値（ja_display）
 * @param {Object} config getEbayConfig() の戻り値
 * @returns {string} eBay ConditionID
 */
/**
 * ja_display → condition_id を4ステップで解決（フォールバックなし）
 *
 * 1. config.categoryMasterSpreadsheetId を取得
 * 2. category_master_EBAY_US から categoryId の condition_group を取得
 * 3. condition_ja_map から condition_group の ja_map_json を取得
 * 4. ja_map_json を value→key で逆引きして condition_id を返す
 *
 * 解決できない場合は例外を throw（誤った condition_id での出品を防止）
 *
 * @param {string} conditionStr 状態列の値（ja_display）
 * @param {Object} config       getEbayConfig() の戻り値
 * @param {string} categoryId   出品カテゴリID
 * @returns {string} eBay ConditionID
 * @throws {Error} 解決できない場合
 */
function resolveConditionIdFromMaster(conditionStr, config, categoryId) {
  if (!conditionStr || String(conditionStr).trim() === '') {
    throw new Error('状態（コンディション）が入力されていません。');
  }
  const str = String(conditionStr).trim();

  // Step 0: 前提チェック
  const masterSpreadsheetId = config.categoryMasterSpreadsheetId;
  if (!masterSpreadsheetId) {
    throw new Error('カテゴリマスタが設定されていません（ツール設定 > カテゴリマスタ）');
  }
  if (!categoryId || String(categoryId).trim() === '') {
    throw new Error('カテゴリIDが設定されていません。');
  }

  // CacheService で結果をキャッシュ（TTL: 6時間）
  const cache = CacheService.getScriptCache();
  const cacheKey = 'condId_' + String(categoryId) + '_' + str;
  const cached = cache.get(cacheKey);
  if (cached) {
    Logger.log('condition_id キャッシュヒット: "' + str + '" → ' + cached + ' (category=' + categoryId + ')');
    return cached;
  }

  const masterSs = SpreadsheetApp.openById(masterSpreadsheetId);

  // Step 1: category_master_EBAY_US から condition_group を取得
  const catSheet = masterSs.getSheetByName('category_master_EBAY_US');
  if (!catSheet) throw new Error('category_master_EBAY_US シートが見つかりません');

  const catData    = catSheet.getDataRange().getValues();
  const catHeaders = catData[0];
  const catIdIdx   = catHeaders.indexOf('category_id');
  const groupIdx   = catHeaders.indexOf('condition_group');

  if (catIdIdx === -1 || groupIdx === -1) {
    throw new Error('category_master_EBAY_US に category_id / condition_group 列がありません');
  }

  let conditionGroup = null;
  for (let i = 1; i < catData.length; i++) {
    if (String(catData[i][catIdIdx]) === String(categoryId)) {
      conditionGroup = String(catData[i][groupIdx] || '').trim();
      break;
    }
  }
  if (!conditionGroup) {
    throw new Error('カテゴリID ' + categoryId + ' が category_master_EBAY_US に見つかりません');
  }

  // Step 2: condition_ja_map から ja_map_json を取得
  const jaSheet = masterSs.getSheetByName('condition_ja_map');
  if (!jaSheet) throw new Error('condition_ja_map シートが見つかりません');

  const jaData     = jaSheet.getDataRange().getValues();
  const jaHeaders  = jaData[0];
  const jaGroupIdx = jaHeaders.indexOf('condition_group');
  const jaMapIdx   = jaHeaders.indexOf('ja_map_json');

  if (jaGroupIdx === -1 || jaMapIdx === -1) {
    throw new Error('condition_ja_map に condition_group / ja_map_json 列がありません');
  }

  let jaMap = null;
  for (let i = 1; i < jaData.length; i++) {
    if (String(jaData[i][jaGroupIdx]) === conditionGroup) {
      try {
        jaMap = JSON.parse(String(jaData[i][jaMapIdx] || '{}'));
      } catch (e) {
        throw new Error('ja_map_json のパースに失敗: ' + e.toString());
      }
      break;
    }
  }
  if (!jaMap) {
    throw new Error('condition_group "' + conditionGroup + '" が condition_ja_map に見つかりません');
  }

  // Step 3: ja_map_json を value→key で逆引き
  for (const id in jaMap) {
    if (String(jaMap[id]) === str) {
      const resolvedId = String(id);
      Logger.log('condition_id 解決: "' + str + '" → ' + resolvedId + ' (category=' + categoryId + ', group=' + conditionGroup + ')');
      cache.put(cacheKey, resolvedId, 21600); // 6時間キャッシュ
      return resolvedId;
    }
  }

  throw new Error(
    '状態 "' + str + '" が condition_group "' + conditionGroup + '" の ja_map_json に見つかりません。\n' +
    '利用可能な状態: ' + Object.values(jaMap).filter(Boolean).join('、')
  );
}

/**
 * XMLエスケープ
 *
 * @param {string} str エスケープする文字列
 * @returns {string} エスケープ済み文字列
 */
/**
 * 郵便番号を取得
 * 優先順: ツール設定シート → PropertiesService
 *
 * @param {Object} config getEbayConfig() の戻り値
 * @returns {string}
 */
function _getPostalCode(config) {
  // 1. ツール設定シートの値を優先
  if (config.postalCode && String(config.postalCode).trim() !== '') {
    return String(config.postalCode).trim();
  }
  // 2. PropertiesService にフォールバック
  const saved = PropertiesService.getScriptProperties().getProperty('POSTAL_CODE');
  if (saved) return saved;
  Logger.log('⚠️ 郵便番号が設定されていません。ツール設定シートの「郵便番号」に値を入力してください。');
  return '';
}

/**
 * 出品者情報（PostalCode・Location）を PropertiesService に保存
 * ツール設定シートから読み込み、フォーマット検証後に保存する
 * authorizeScript から呼び出す
 *
 * @param {string} spreadsheetId
 * @returns {{ success: boolean, postalCode: string, location: string, message: string }}
 */
function setupSellerInfo(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const config     = getEbayConfig();
    const postalCode = String(config.postalCode || '').trim();
    const location   = String(config.itemLocation || 'Japan').trim();

    if (postalCode === '') {
      return {
        success: false,
        postalCode: '',
        location: location,
        message: '⚠️ ツール設定シートの「郵便番号」が未入力です。⚙️ → アカウント情報取得 を先に実行してください。'
      };
    }

    // ハイフンなし7桁（例: 4442141）→ 自動フォーマット（444-2141）
    const digitsOnly     = postalCode.replace(/-/g, '');
    const normalizedCode = digitsOnly.length === 7
      ? digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3)
      : postalCode;

    // 日本の郵便番号フォーマット検証（XXX-XXXX）
    if (!/^\d{3}-\d{4}$/.test(normalizedCode)) {
      return {
        success: false,
        postalCode: postalCode,
        location: location,
        message: '⚠️ 郵便番号のフォーマットが不正です（' + postalCode + '）。XXX-XXXX 形式（7桁）で入力してください。'
      };
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty('POSTAL_CODE',   normalizedCode);
    props.setProperty('ITEM_LOCATION', location);

    Logger.log('✅ setupSellerInfo: PostalCode=' + normalizedCode + ' Location=' + location);
    return {
      success: true,
      postalCode: normalizedCode,
      location: location,
      message: '✅ 出品者情報を保存しました\n郵便番号: ' + normalizedCode + '\n出品所在地: ' + location
    };
  } catch (e) {
    Logger.log('❌ setupSellerInfo エラー: ' + e.toString());
    return { success: false, postalCode: '', location: '', message: '❌ ' + e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * Trading API: EndFixedPriceItem（出品取り下げ）
 * AddItem で出品された場合は EndFixedPriceItem が 'Input data is invalid' を返すため、
 * そのときは EndItem にフォールバックする。
 *
 * @param {string} spreadsheetId
 * @param {string} itemId  eBay Item ID
 * @returns {{ success: boolean, message?: string }}
 */
function endFixedPriceItem(spreadsheetId, itemId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    autoRefreshTokenIfNeeded(spreadsheetId);
    // autoRefreshTokenIfNeeded 内の finally で CURRENT_SPREADSHEET_ID がリセットされるため再セット
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const token  = getUserToken();
    const config = getEbayConfig();
    const apiUrl = getTradingApiUrl();

    // --- EndFixedPriceItem を試行 ---
    const xmlBodyFPI =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
        '<RequesterCredentials>' +
          '<eBayAuthToken>' + escapeXml(token) + '</eBayAuthToken>' +
        '</RequesterCredentials>' +
        '<ItemID>' + escapeXml(String(itemId)) + '</ItemID>' +
        '<EndingReason>NotAvailable</EndingReason>' +
      '</EndFixedPriceItemRequest>';

    const buildHeaders = function(callName) {
      return {
        'X-EBAY-API-SITEID':              '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_API_VERSION,
        'X-EBAY-API-CALL-NAME':           callName,
        'X-EBAY-API-APP-NAME':            config.appId,
        'X-EBAY-API-DEV-NAME':            config.devId,
        'X-EBAY-API-CERT-NAME':           config.certId,
        'Content-Type':                   'text/xml;charset=utf-8'
      };
    };

    const responseFPI = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      headers: buildHeaders('EndFixedPriceItem'),
      payload: xmlBodyFPI,
      muteHttpExceptions: true
    });

    const statusFPI  = responseFPI.getResponseCode();
    const textFPI    = responseFPI.getContentText();
    Logger.log('EndFixedPriceItem Response Code: ' + statusFPI);

    if (statusFPI === 200) {
      const rootFPI  = XmlService.parse(textFPI).getRootElement();
      const ns       = XmlService.getNamespace('urn:ebay:apis:eBLBaseComponents');
      const ackFPI   = (rootFPI.getChild('Ack', ns) || { getText: function() { return ''; } }).getText();

      if (ackFPI === 'Success' || ackFPI === 'Warning') {
        Logger.log('✅ EndFixedPriceItem 成功: Item ID=' + itemId);
        return { success: true };
      }

      // 'Input data is invalid' → AddItem 出品なので EndItem にフォールバック
      const errElFPI  = rootFPI.getChild('Errors', ns);
      const shortMsg  = errElFPI
        ? (errElFPI.getChild('ShortMessage', ns) || { getText: function() { return ''; } }).getText()
        : '';
      Logger.log('EndFixedPriceItem 失敗: ' + shortMsg + ' → EndItem にフォールバック');

      if (shortMsg.indexOf('Input data is invalid') === -1 && shortMsg !== '') {
        // Input data is invalid 以外のエラーはフォールバックせずそのままエラーにする
        throw new Error('APIエラー: ' + shortMsg);
      }
    } else {
      Logger.log('EndFixedPriceItem HTTPエラー(' + statusFPI + ') → EndItem にフォールバック');
    }

    // --- EndItem にフォールバック ---
    Logger.log('=== EndItem フォールバック ===');
    const xmlBodyEI =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
        '<RequesterCredentials>' +
          '<eBayAuthToken>' + escapeXml(token) + '</eBayAuthToken>' +
        '</RequesterCredentials>' +
        '<ItemID>' + escapeXml(String(itemId)) + '</ItemID>' +
        '<EndingReason>NotAvailable</EndingReason>' +
      '</EndItemRequest>';

    const responseEI   = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      headers: buildHeaders('EndItem'),
      payload: xmlBodyEI,
      muteHttpExceptions: true
    });

    const statusEI  = responseEI.getResponseCode();
    const textEI    = responseEI.getContentText();
    Logger.log('EndItem Response Code: ' + statusEI);

    if (statusEI !== 200) {
      throw new Error('EndItem HTTPエラー(' + statusEI + ')');
    }

    const rootEI = XmlService.parse(textEI).getRootElement();
    const nsEI   = XmlService.getNamespace('urn:ebay:apis:eBLBaseComponents');
    const ackEI  = (rootEI.getChild('Ack', nsEI) || { getText: function() { return ''; } }).getText();

    if (ackEI === 'Success' || ackEI === 'Warning') {
      Logger.log('✅ EndItem 成功: Item ID=' + itemId);
      return { success: true };
    }

    const errElEI = rootEI.getChild('Errors', nsEI);
    const errMsgEI = errElEI
      ? (errElEI.getChild('ShortMessage', nsEI) || { getText: function() { return ''; } }).getText()
      : textEI;
    throw new Error('EndItem APIエラー: ' + errMsgEI);

  } catch (e) {
    Logger.log('❌ endFixedPriceItem エラー: ' + e.toString());
    return { success: false, message: e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * Trading API: ReviseFixedPriceItem（出品更新）
 *
 * シートの現在の値で全フィールドを一括更新する。
 *
 * @param {string} spreadsheetId スプレッドシートID
 * @param {number} rowNumber 出品シートの行番号
 * @returns {{ success: boolean, message: string }}
 */
function reviseFixedPriceItem(spreadsheetId, rowNumber) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    // Item ID をシートから取得
    const listingSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.LISTING);
    if (!listingSheet) throw new Error('"出品"シートが見つかりません');

    const headerMapping = buildHeaderMapping();
    const itemIdCol = headerMapping['Item ID'];
    if (!itemIdCol) throw new Error('「Item ID」列が見つかりません');

    const itemId = String(listingSheet.getRange(rowNumber, itemIdCol).getValue() || '').trim();
    if (!itemId) throw new Error('Item ID が空です。先に出品を実行してください。');

    Logger.log('=== ReviseFixedPriceItem 開始: Item ID=' + itemId + ' 行=' + rowNumber + ' ===');

    // トークン自動更新 → 内部 finally で CURRENT_SPREADSHEET_ID がリセットされるため再セット
    autoRefreshTokenIfNeeded(spreadsheetId);
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const token  = getUserToken();
    const config = getEbayConfig();
    const apiUrl = getTradingApiUrl();

    // シートから出品データを読み込み
    const listingData = readListingDataFromSheet(spreadsheetId, rowNumber);
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId; // 再セット（readListingDataFromSheet内でリセットされる可能性）

    // ConditionID を解決
    const conditionId = resolveConditionIdFromMaster(listingData.condition, config, listingData.categoryId);

    // XMLリクエスト構築
    let xmlBody =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
        '<RequesterCredentials>' +
          '<eBayAuthToken>' + escapeXml(token) + '</eBayAuthToken>' +
        '</RequesterCredentials>' +
        '<Item>' +
          '<ItemID>' + escapeXml(itemId) + '</ItemID>' +
          '<Title>' + escapeXml(listingData.title) + '</Title>' +
          '<Description><![CDATA[' + (listingData.description || '') + ']]></Description>' +
          '<StartPrice currencyID="USD">' + listingData.price + '</StartPrice>' +
          '<Quantity>' + parseInt(listingData.quantity) + '</Quantity>' +
          '<ConditionID>' + conditionId + '</ConditionID>';

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

    xmlBody += '</Item></ReviseFixedPriceItemRequest>';

    // API呼び出し
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      headers: {
        'X-EBAY-API-SITEID':              '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_API_VERSION,
        'X-EBAY-API-CALL-NAME':           'ReviseFixedPriceItem',
        'X-EBAY-API-APP-NAME':            config.appId,
        'X-EBAY-API-DEV-NAME':            config.devId,
        'X-EBAY-API-CERT-NAME':           config.certId,
        'Content-Type':                   'text/xml;charset=utf-8'
      },
      payload: xmlBody,
      muteHttpExceptions: true
    });

    const statusCode   = response.getResponseCode();
    const responseText = response.getContentText();
    Logger.log('ReviseFixedPriceItem Response: ' + statusCode);

    if (statusCode !== 200) {
      throw new Error('HTTPエラー(' + statusCode + '): ' + responseText);
    }

    const root = XmlService.parse(responseText).getRootElement();
    const ns   = XmlService.getNamespace('urn:ebay:apis:eBLBaseComponents');
    const ack  = (root.getChild('Ack', ns) || { getText: function() { return ''; } }).getText();

    if (ack === 'Success' || ack === 'Warning') {
      Logger.log('✅ 更新成功: Item ID=' + itemId);
      if (ack === 'Warning') {
        const errEl = root.getChild('Errors', ns);
        if (errEl) Logger.log('⚠️ Warning: ' + (errEl.getChild('ShortMessage', ns) || { getText: function() { return ''; } }).getText());
      }
      return {
        success: true,
        message: '✅ 更新が完了しました\n\nItem ID: ' + itemId + '\n商品名: ' + listingData.title
      };
    }

    const errEl  = root.getChild('Errors', ns);
    const errMsg = errEl
      ? (errEl.getChild('ShortMessage', ns) || { getText: function() { return responseText; } }).getText()
      : responseText;
    throw new Error('APIエラー: ' + errMsg);

  } catch (e) {
    Logger.log('❌ ReviseFixedPriceItem エラー: ' + e.toString());
    return { success: false, message: '❌ 更新エラー:\n\n' + e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 出品DBのスプレッドシートIDを返す
 *
 * @param {string} spreadsheetId 出品元スプレッドシートID
 * @returns {string|null}
 */
function getOutputDbSpreadsheetId(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    const config = getEbayConfig();
    return config.outputDbSpreadsheetId || null;
  } catch (e) {
    return null;
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

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
 * Trading API: AddFixedPriceItem（出品作成）
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
    '<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
    '<RequesterCredentials>' +
    '<eBayAuthToken>' + escapeXml(token) + '</eBayAuthToken>' +
    '</RequesterCredentials>' +
    '<Item>' +
    '<Title>' + escapeXml(listingData.title) + '</Title>' +
    '<Description><![CDATA[' + (listingData.description || '') + ']]></Description>' +
    '<PrimaryCategory><CategoryID>' + listingData.categoryId + '</CategoryID></PrimaryCategory>' +
    '<StartPrice>' + listingData.price + '</StartPrice>' +
    '<ConditionID>' + resolveConditionIdFromMaster(listingData.condition, config, listingData.categoryId) + '</ConditionID>' +
    '<Country>JP</Country>' +
    '<Currency>USD</Currency>' +
    '<DispatchTimeMax>3</DispatchTimeMax>' +
    '<ListingDuration>GTC</ListingDuration>' +
    '<ListingType>FixedPriceItem</ListingType>' +
    '<Location>' + escapeXml(config.itemLocation) + '</Location>' +
    '<PostalCode>' + escapeXml(_getPostalCode(config)) + '</PostalCode>' +
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
    '</AddFixedPriceItemRequest>';

  // HTTPリクエスト
  const options = {
    method: 'post',
    headers: {
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_API_VERSION,
      'X-EBAY-API-CALL-NAME': 'AddFixedPriceItem',
      'X-EBAY-API-APP-NAME': config.appId,
      'X-EBAY-API-DEV-NAME': config.devId,
      'X-EBAY-API-CERT-NAME': config.certId,
      'Content-Type': 'text/xml;charset=utf-8'
    },
    payload: xmlBody,
    muteHttpExceptions: true
  };

  Logger.log('=== Trading API: AddFixedPriceItem ===');
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
      return { success: false, error: '「ツール設定」シートの「出品DB」にスプレッドシートURLが設定されていません。' };
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

    // ヘッダー行が存在しない場合は作成（1行目: ヘッダー）
    const lastRow = outputSheet.getLastRow();
    if (lastRow < 1) {
      // 元の"出品"シートからヘッダーをコピー
      const sourceSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
      const sourceHeaders = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues();

      outputSheet.getRange(1, 1, 1, sourceHeaders[0].length).setValues(sourceHeaders);
      Logger.log('✅ ヘッダー行をコピーしました');
    }

    // 出品元シートのデータとヘッダーマッピングを取得
    const sourceSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
    const srcLastCol = sourceSheet.getLastColumn();
    const sourceValues = sourceSheet.getRange(rowNumber, 1, 1, srcLastCol).getValues()[0];
    const sourceDisplayValues = sourceSheet.getRange(rowNumber, 1, 1, srcLastCol).getDisplayValues()[0];
    const sourceHeaderMapping = buildHeaderMapping(); // 出品シート: 列名 → 1-based index

    // 出品DBのヘッダー行（1行目）を取得し、不可視文字を除去
    const outputHeaderRowRaw = outputSheet.getRange(1, 1, 1, outputSheet.getLastColumn()).getValues()[0];
    const outputHeaderRow = outputHeaderRowRaw.map(function(h) { return String(h || '').trim(); });

    // 出品DB列名 → 0-based index のマップ
    const outputColMap = {};
    outputHeaderRow.forEach(function(h, i) {
      if (h) outputColMap[h] = i;
    });

    // 出品DBの列構造に合わせて書き込み配列を生成（列名ベースのマッピング）
    const skipCols = ['容積重量(g)', '適用重量(g)'];
    const outputRow = new Array(outputHeaderRow.length).fill('');
    outputHeaderRow.forEach(function(h, i) {
      if (!h) return;
      if (skipCols.indexOf(h) !== -1) return;
      const srcIdx = sourceHeaderMapping[h];
      if (srcIdx) {
        const rawVal = sourceValues[srcIdx - 1];
        outputRow[i] = (rawVal instanceof Date) ? sourceDisplayValues[srcIdx - 1] : rawVal;
      }
    });

    // --- 出品後に確定する特殊フィールドを上書き設定 ---

    // Item ID
    if ('Item ID' in outputColMap) {
      outputRow[outputColMap['Item ID']] = result.itemId;
      Logger.log('Item IDを設定: ' + result.itemId);
    } else {
      Logger.log('⚠️ 出品DBに "Item ID" 列が見つかりません');
    }

    // 出品URL
    const listingUrl = 'https://www.ebay.com/itm/' + result.itemId;
    if ('出品URL' in outputColMap) {
      outputRow[outputColMap['出品URL']] = listingUrl;
      Logger.log('出品URLを設定: ' + listingUrl);
    } else {
      Logger.log('⚠️ 出品DBに "出品URL" 列が見つかりません');
    }

    // 出品ステータス（列名ゆれに対応）
    const statusKey = ('出品ステータス' in outputColMap) ? '出品ステータス' : 'ステータス';
    if (statusKey in outputColMap) {
      outputRow[outputColMap[statusKey]] = 'Active';
      Logger.log('ステータスを設定: Active');
    } else {
      Logger.log('⚠️ 出品DBに "出品ステータス"/"ステータス" 列が見つかりません');
    }

    // タイムスタンプ関連
    const now = new Date();
    const year   = now.getFullYear();
    const month  = String(now.getMonth() + 1).padStart(2, '0');
    const day    = String(now.getDate()).padStart(2, '0');
    const hour   = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const timestamp       = year + '/' + month + '/' + day + '/' + hour + ':' + minute + ':' + second;
    const managementMonth = parseInt(year + month);

    if ('出品タイムスタンプ' in outputColMap) {
      outputRow[outputColMap['出品タイムスタンプ']] = timestamp;
      Logger.log('出品タイムスタンプを設定: ' + timestamp);
    } else {
      Logger.log('⚠️ 出品DBに "出品タイムスタンプ" 列が見つかりません');
    }

    if ('管理年月' in outputColMap) {
      outputRow[outputColMap['管理年月']] = managementMonth;
      Logger.log('管理年月を設定: ' + managementMonth);
    } else {
      Logger.log('⚠️ 出品DBに "管理年月" 列が見つかりません');
    }

    // 対応状況をまとめてログ出力
    Logger.log('=== 転記列マッピング（出品DB列名 → 値の元） ===');
    outputHeaderRow.forEach(function(h, i) {
      const colName = String(h || '').trim();
      if (!colName) return;
      const specialFields = ['Item ID', '出品URL', '出品ステータス', 'ステータス', '出品タイムスタンプ', '管理年月'];
      if (specialFields.indexOf(colName) !== -1) {
        Logger.log('  [' + (i + 1) + '] ' + colName + ' ← （出品後に設定）');
      } else if (sourceHeaderMapping[colName]) {
        Logger.log('  [' + (i + 1) + '] ' + colName + ' ← 出品シート[' + sourceHeaderMapping[colName] + ']');
      } else {
        Logger.log('  [' + (i + 1) + '] ' + colName + ' ← ⚠️ 出品シートに列なし（空白）');
      }
    });

    // 実データが入っている最終行を特定（出品URL列で判定）
    const urlColInOutput = outputHeaderRow.indexOf('出品URL');
    let newRow = 5;
    if (urlColInOutput !== -1) {
      const colValues = outputSheet.getRange(1, urlColInOutput + 1, outputSheet.getLastRow(), 1).getValues();
      for (let i = colValues.length - 1; i >= 0; i--) {
        if (colValues[i][0] !== '') { newRow = i + 2; break; }
      }
      if (newRow < 5) newRow = 5;
    } else {
      newRow = outputSheet.getLastRow() + 1;
    }
    Logger.log('出品DB書き込み行: ' + newRow + '行目');
    outputSheet.getRange(newRow, 1, 1, outputRow.length).setValues([outputRow]);

    Logger.log('✅ 出品DB転記完了: ' + newRow + '行目に追加');

    const missingCols = [];
    outputHeaderRow.forEach(function(h) {
      if (!h) return;
      const specialFields = ['Item ID', '出品URL', '出品ステータス', 'ステータス', '出品タイムスタンプ', '管理年月'];
      if (specialFields.indexOf(h) === -1 && !sourceHeaderMapping[h]) {
        missingCols.push(h);
      }
    });
    if (missingCols.length > 0) {
      Logger.log('⚠️ 転記できなかった列: ' + missingCols.join(', '));
    }
    return { success: true, missingCols: missingCols };

  } catch (error) {
    Logger.log('❌ 出品DB転記エラー: ' + error.toString());
    // 転記エラーは致命的ではないので、エラーをログに記録して続行
    return { success: false, error: error.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 出品シートと出品DBのヘッダー一覧を Logger に出力するデバッグ関数
 * GASエディタから直接実行して確認する
 *
 * @param {string} spreadsheetId 出品スプレッドシートID
 */
function debugTransferHeaders(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;

    // 出品シートヘッダー
    const sourceSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.LISTING);
    const sourceHeaders = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];

    Logger.log('=== 出品シート ヘッダー一覧（1行目）===');
    sourceHeaders.forEach(function(h, i) {
      if (h) Logger.log('  ' + (i + 1) + '列: ' + h);
    });
    Logger.log('合計: ' + sourceHeaders.filter(Boolean).length + '列');

    if (!outputDbId) {
      Logger.log('⚠️ 出品DBが設定されていません');
      return;
    }

    // 出品DBヘッダー
    const outputSheet = SpreadsheetApp.openById(outputDbId).getSheetByName('出品');
    if (!outputSheet) {
      Logger.log('⚠️ 出品DBに「出品」シートが見つかりません');
      return;
    }
    const outputHeaders = outputSheet.getRange(1, 1, 1, outputSheet.getLastColumn()).getValues()[0];

    Logger.log('=== 出品DB ヘッダー一覧（1行目）===');
    outputHeaders.forEach(function(h, i) {
      if (h) Logger.log('  ' + (i + 1) + '列: ' + h);
    });
    Logger.log('合計: ' + outputHeaders.filter(Boolean).length + '列');

    // 対応関係チェック
    Logger.log('=== 転記対応チェック ===');
    outputHeaders.forEach(function(h, i) {
      if (!h) return;
      const srcCol = sourceHeaders.indexOf(h);
      if (srcCol !== -1) {
        Logger.log('  ✅ 出品DB[' + (i + 1) + '] "' + h + '" ← 出品シート[' + (srcCol + 1) + ']');
      } else {
        Logger.log('  ❌ 出品DB[' + (i + 1) + '] "' + h + '" ← 出品シートに列なし（転記不可）');
      }
    });

  } catch (e) {
    Logger.log('❌ debugTransferHeaders エラー: ' + e.toString());
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * clasp run 用: 出品DBの1行目(ヘッダー)と指定行(データ)を読み取り、空欄列を報告する
 *
 * @param {string} dbSpreadsheetId 出品DBスプレッドシートID
 * @param {number} dataRow データ行番号（省略時は5）
 */
function inspectOutputDbRow(dbSpreadsheetId, dataRow) {
  try {
    const row = dataRow || 5;
    const ss = SpreadsheetApp.openById(dbSpreadsheetId);
    const sheet = ss.getSheetByName('出品');
    if (!sheet) return '⚠️ 出品DBに「出品」シートが見つかりません';

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const values  = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    const lines = [];
    const emptyList = [];
    const filledList = [];

    lines.push('=== 出品DB「出品」シート 行' + row + ' 内容 ===');
    lines.push('');

    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').trim();
      var v = values[i];
      var vStr = (v === null || v === undefined || v === '') ? '（空）' : String(v);
      lines.push('  [' + (i + 1) + '] ' + (h || '（ヘッダーなし）') + ': ' + vStr);
      if (v === null || v === undefined || v === '') {
        emptyList.push('  [' + (i + 1) + '] ' + (h || '（ヘッダーなし）'));
      } else {
        filledList.push('  [' + (i + 1) + '] ' + h);
      }
    }

    lines.push('');
    lines.push('=== 値あり列（' + filledList.length + '列）===');
    filledList.forEach(function(l) { lines.push(l); });

    lines.push('');
    lines.push('=== 空欄列（' + emptyList.length + '列）===');
    if (emptyList.length === 0) {
      lines.push('  なし（全列に値あり）');
    } else {
      emptyList.forEach(function(l) { lines.push(l); });
    }

    return lines.join('\n');
  } catch (e) {
    return 'エラー: ' + e.toString() + '\n' + e.stack;
  }
}

/**
 * clasp run 用: debugTransferHeaders の結果を文字列で返す
 * Logger.log ではなく return value として clasp run に出力する
 *
 * @param {string} spreadsheetId 出品スプレッドシートID
 */
function getTransferHeadersResult(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;
    const lines = [];

    const sourceSheet = getTargetSpreadsheet().getSheetByName(SHEET_NAMES.LISTING);
    const sourceHeaders = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0].filter(Boolean);
    lines.push('=== 出品シート ヘッダー（' + sourceHeaders.length + '列）===');
    sourceHeaders.forEach(function(h, i) { lines.push('  ' + (i + 1) + ': ' + h); });

    if (!outputDbId) {
      lines.push('⚠️ 出品DBが設定されていません');
      return lines.join('\n');
    }

    const outputSheet = SpreadsheetApp.openById(outputDbId).getSheetByName('出品');
    if (!outputSheet) {
      lines.push('⚠️ 出品DBに「出品」シートが見つかりません');
      return lines.join('\n');
    }
    const outputHeadersRaw = outputSheet.getRange(1, 1, 1, outputSheet.getLastColumn()).getValues()[0];
    const outputHeaders = outputHeadersRaw.filter(Boolean);
    lines.push('');
    lines.push('=== 出品DB ヘッダー（' + outputHeaders.length + '列）===');
    outputHeadersRaw.forEach(function(h, i) { if (h) lines.push('  ' + (i + 1) + ': ' + h); });

    lines.push('');
    lines.push('=== 転記対応チェック ===');
    const missing = [];
    outputHeadersRaw.forEach(function(h, i) {
      if (!h) return;
      const srcIdx = sourceHeaders.indexOf(h);
      if (srcIdx !== -1) {
        lines.push('  ✅ DB[' + (i + 1) + '] "' + h + '" ← 出品シート[' + (srcIdx + 1) + ']');
      } else {
        lines.push('  ❌ DB[' + (i + 1) + '] "' + h + '" ← 転記不可');
        missing.push(h);
      }
    });

    lines.push('');
    lines.push('=== 転記不可列（出品DB側にあるが出品シートにない） ===');
    if (missing.length === 0) {
      lines.push('  なし（全列転記可能）');
    } else {
      missing.forEach(function(h) { lines.push('  - ' + h); });
    }

    return lines.join('\n');
  } catch (e) {
    return 'エラー: ' + e.toString() + '\n' + e.stack;
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 出品シートの指定行データをクリア（書式は維持）
 * - セル値をクリア（clearContent）
 * - データ入力規則（プルダウン等）も全列クリア（clearDataValidations）
 *
 * @param {string} spreadsheetId スプレッドシートID
 * @param {number} rowNumber クリアする行番号
 */
function clearAndMoveListingRow(spreadsheetId, rowNumber) {
  try {
    Logger.log('=== 出品シート行クリア開始 ===');

    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const listingSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
    if (!listingSheet) throw new Error('"出品"シートが見つかりません');

    if (rowNumber < 5) throw new Error('ヘッダー行（1-4行目）は処理できません');

    const lastCol = listingSheet.getLastColumn();

    // データをクリア（書式は維持）
    listingSheet.getRange(rowNumber, 1, 1, lastCol).clearContent();

    // 状態列のデータ入力規則（プルダウン）のみ消去
    const headerMapping = buildHeaderMapping();
    const conditionCol = headerMapping['状態'];
    if (conditionCol) {
      listingSheet.getRange(rowNumber, conditionCol).clearDataValidations();
    }

    Logger.log('✅ データクリア完了: ' + rowNumber + '行目');

  } catch (error) {
    Logger.log('⚠️ 行クリアエラー（出品は成功済み）: ' + error.toString());
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
 * @param {number} rowNumber 出品する行番号（5行目以降）
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

    // 7. DB転記結果を判定して行クリアまたはエラー返却
    const dbSuccess = transferred && transferred.success === true;
    const dbError   = transferred ? transferred.error : null;
    const dbMissing = (transferred && transferred.missingCols) ? transferred.missingCols : [];

    if (dbSuccess) {
      clearAndMoveListingRow(spreadsheetId, rowNumber);
      return {
        success: true,
        transferred: true,
        missingCols: dbMissing,
        sku: listingData.sku || '',
        itemId: result.itemId || '',
        promotedListing: promotedListingResult || null,
        rowCleared: true
      };
    } else {
      Logger.log('❌ DB転記失敗: ' + (dbError || '不明なエラー'));
      return {
        success: false,
        transferred: false,
        message: '⚠️ 出品は完了しましたが、DB転記に失敗しました。\n\n理由: ' + (dbError || '不明なエラー'),
        sku: listingData.sku || '',
        itemId: result.itemId || '',
        promotedListing: promotedListingResult || null,
        rowCleared: false
      };
    }

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

    // ヘッダー行（1-4行目）は処理しない
    if (row <= 4) {
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

/**
 * transferToOutputDb() の単体テスト
 * eBay出品なしで転記処理だけを確認する
 * GASエディタから直接実行する
 *
 * Item IDが入っている最初の行（5行目以降）を自動検索して転記テストを実行する
 */
function testTransferToOutputDb() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('DEFAULT_SPREADSHEET_ID');
  if (!spreadsheetId) {
    Logger.log('❌ スクリプトプロパティに DEFAULT_SPREADSHEET_ID が未設定です');
    return;
  }

  // 実際の出品シートからそのままデータを読む
  const sourceSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
  const srcLastCol = sourceSheet.getLastColumn();

  // Item ID列を特定
  const headerMapping = buildHeaderMapping();
  const itemIdCol = headerMapping['Item ID'];
  if (!itemIdCol) {
    Logger.log('❌ "Item ID"列がヘッダー行に見つかりません');
    return;
  }

  // 5行目以降でItem IDが入っている最初の行を自動検索
  const lastRow = sourceSheet.getLastRow();
  const itemIdValues = sourceSheet.getRange(5, itemIdCol, Math.max(lastRow - 4, 1), 1).getValues();
  let testRow = null;
  for (let i = 0; i < itemIdValues.length; i++) {
    if (String(itemIdValues[i][0] || '').trim() !== '') {
      testRow = i + 5; // 5行目始まり
      break;
    }
  }

  if (!testRow) {
    Logger.log('❌ Item IDが入っている行が見つかりません（5行目以降を検索しました）');
    return;
  }

  const listingData = sourceSheet.getRange(testRow, 1, 1, srcLastCol).getValues()[0];
  const realItemId = String(sourceSheet.getRange(testRow, itemIdCol).getDisplayValue()).trim();

  // 実際のItem IDで転記実行
  const realResult = {
    itemId: realItemId,
    success: true
  };

  Logger.log('=== 転記テスト開始 ===');
  Logger.log('対象行: ' + testRow + ' / Item ID: ' + realItemId);

  const transferred = transferToOutputDb(spreadsheetId, testRow, listingData, realResult);

  Logger.log('=== テスト結果 ===');
  Logger.log(JSON.stringify(transferred));

  if (transferred && transferred.success) {
    Logger.log('✅ 転記成功');
    if (transferred.missingCols && transferred.missingCols.length > 0) {
      Logger.log('⚠️ 不一致列: ' + transferred.missingCols.join(', '));
    } else {
      Logger.log('✅ 全列マッチ');
    }
  } else {
    Logger.log('❌ 転記失敗: ' + (transferred ? transferred.error : '不明'));
  }
}

