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
 * 出品シート（任意）のヘッダー名→列番号マップを返す
 * container側の _buildListingHeaderMapping(sheet) の置き換え用
 *
 * @param {string} spreadsheetId スプレッドシートID
 * @param {string} [sheetName='出品'] シート名
 * @returns {{ [headerName: string]: number }} ヘッダー名→列番号（1-based）
 */
function buildListingHeaderMapping(spreadsheetId, sheetName) {
  if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
  const ss = getTargetSpreadsheet(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName || SHEET_NAMES.LISTING);
  if (!sheet) return {};
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim();
    if (h) map[h] = i + 1;
  }
  return map;
}

/**
 * Vero/禁止ワードシートとタイトルを照合してワード判定列に結果を書き込む
 * 優先度: 禁止ワード > VERO > 該当なし
 *
 * @param {Sheet} sheet 出品シート
 * @param {number} rowNumber 対象行番号
 * @param {string} title タイトル文字列
 * @param {Object} headerMapping ヘッダーマッピング {列名: 列番号(1-based)}
 * @param {string} spreadsheetId スプレッドシートID
 */
function checkAndWriteWordJudgement(sheet, rowNumber, title, headerMapping, spreadsheetId) {
  try {
    if (!title || !title.trim()) return;
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    // ワード判定列を特定
    const wordCheckCol = headerMapping['ワード判定'];
    if (!wordCheckCol) {
      Logger.log('⚠️ ワード判定列が見つかりません');
      return;
    }

    // Vero/禁止ワードシートを取得
    const ss = getTargetSpreadsheet(spreadsheetId);
    const veroSheet = ss.getSheetByName('Vero/禁止ワード');
    if (!veroSheet) {
      Logger.log('⚠️ Vero/禁止ワードシートが見つかりません');
      return;
    }

    // ヘッダー行からVERO列・禁止ワード列を特定
    const veroLastCol = veroSheet.getLastColumn();
    const veroLastRow = veroSheet.getLastRow();
    if (veroLastRow < 2) return;

    const veroHeaders = veroSheet.getRange(1, 1, 1, veroLastCol).getValues()[0];
    const veroColIdx = veroHeaders.findIndex(function(h) {
      return String(h || '').trim() === 'VERO';
    });
    const kinshiColIdx = veroHeaders.findIndex(function(h) {
      return String(h || '').trim() === '禁止ワード';
    });

    if (veroColIdx === -1 && kinshiColIdx === -1) {
      Logger.log('⚠️ VERO列・禁止ワード列が見つかりません');
      return;
    }

    // ワードリストを取得
    const veroData = veroSheet.getRange(2, 1, veroLastRow - 1, veroLastCol).getValues();
    const veroWords = [];
    const kinshiWords = [];

    veroData.forEach(function(row) {
      if (veroColIdx !== -1) {
        const w = String(row[veroColIdx] || '').trim();
        if (w) veroWords.push(w);
      }
      if (kinshiColIdx !== -1) {
        const w = String(row[kinshiColIdx] || '').trim();
        if (w) kinshiWords.push(w);
      }
    });

    // タイトルと照合（大文字小文字無視）
    const titleLower = title.toLowerCase();

    const hitKinshi = kinshiWords.filter(function(w) {
      return titleLower.indexOf(w.toLowerCase()) !== -1;
    });
    const hitVero = veroWords.filter(function(w) {
      return titleLower.indexOf(w.toLowerCase()) !== -1;
    });

    // 判定結果（禁止ワード > 文字数オーバー > VERO > 該当なし）
    const isTitleOver = title.length > 80;
    let result = '該当なし';
    if (hitKinshi.length > 0) {
      result = '禁止: ' + hitKinshi.join(', ');
    } else if (isTitleOver) {
      result = '文字数オーバー';
    } else if (hitVero.length > 0) {
      result = 'VERO: ' + hitVero.join(', ');
    }

    // ワード判定列に書き込む
    sheet.getRange(rowNumber, wordCheckCol).setValue(result);
    Logger.log('ワード判定: 行' + rowNumber + ' → ' + result);

  } catch(e) {
    Logger.log('⚠️ ワード判定エラー（処理継続）: ' + e.toString());
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
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

  for (let i = 1; i <= 30; i++) {
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
      description = description.replace(/\{説明文\}/g, '');
      Logger.log('状態説明が空のため{説明文}を除去します');
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
      const convertedUrl = convertDriveUrlForEbay(String(url).trim()) || String(url).trim();
      urls.push(convertedUrl);
    }
  }

  Logger.log('商品画像数: ' + urls.length + '枚');

  // 2. ストア画像を最後尾に追加
  const storeImageUrl = getValueByHeader(rowData, headerMapping, 'ストア画像');

  if (storeImageUrl && String(storeImageUrl).trim() !== '') {
    const convertedUrl = convertDriveUrlForEbay(String(storeImageUrl).trim()) || String(storeImageUrl).trim();
    urls.push(convertedUrl);
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

  // データ読み取り時にワード判定を実行
  if (data.title) {
    checkAndWriteWordJudgement(listingSheet, rowNumber, data.title, buildHeaderMapping(), spreadsheetId);
  }

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

  // Brand必須チェック（カテゴリ依存）
  // ※ validateListingDataにspreadsheetIdが渡っていない場合は
  //   CURRENT_SPREADSHEET_IDを使用
  try {
    var catData = getCategoryMasterDataForListing(CURRENT_SPREADSHEET_ID, String(data.categoryId));
    if (catData && catData.requiredSpecs && catData.requiredSpecs.indexOf('Brand') !== -1) {
      if (!data.brand || String(data.brand).trim() === '') {
        errors.push('Brand（ブランド）が未入力です → Brand列に入力してください');
      }
    }
  } catch(brandCheckErr) {
    Logger.log('Brand必須チェックエラー（続行）: ' + brandCheckErr.toString());
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
 * 出品者情報をeBay APIから取得してツール設定シートに書き込む
 * 取得対象: 出品所在地・郵便番号・eBayユーザーID・ストアプラン
 *
 * @param {string} spreadsheetId
 * @returns {{ success: boolean, message: string }}
 */
function setupSellerInfo(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    autoRefreshTokenIfNeeded(spreadsheetId);
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const config = getEbayConfig();
    const token  = config.userToken;
    const apiUrl = 'https://api.ebay.com/ws/api.dll';

    // GetUser APIで出品者情報を取得
    const xmlRequest =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
      '<RequesterCredentials>' +
      '<eBayAuthToken>' + token + '</eBayAuthToken>' +
      '</RequesterCredentials>' +
      '<DetailLevel>ReturnAll</DetailLevel>' +
      '</GetUserRequest>';

    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-CALL-NAME':          'GetUser',
        'X-EBAY-API-SITEID':             '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL':'967',
        'X-EBAY-API-APP-NAME':           config.appId,
        'X-EBAY-API-DEV-NAME':           config.devId,
        'X-EBAY-API-CERT-NAME':          config.certId,
        'Content-Type':                  'text/xml'
      },
      payload: xmlRequest,
      muteHttpExceptions: true
    });

    const ns   = XmlService.getNamespace('urn:ebay:apis:eBLBaseComponents');
    const root = XmlService.parse(response.getContentText()).getRootElement();
    const ack  = root.getChildText('Ack', ns);

    if (ack !== 'Success' && ack !== 'Warning') {
      const errEl  = root.getChild('Errors', ns);
      const errMsg = errEl ? errEl.getChildText('ShortMessage', ns) : '不明なエラー';
      Logger.log('❌ setupSellerInfo 失敗: eBay APIエラー: ' + errMsg);
      return { success: false, message: 'eBay APIエラー: ' + errMsg };
    }

    // ユーザー情報を取得
    const userEl                = root.getChild('User', ns);
    const userId                = userEl ? userEl.getChildText('UserID', ns) || '' : '';
    const registrationAddressEl = userEl ? userEl.getChild('RegistrationAddress', ns) : null;
    const city                  = registrationAddressEl ? registrationAddressEl.getChildText('CityName', ns)       || '' : '';
    const stateOrProvince       = registrationAddressEl ? registrationAddressEl.getChildText('StateOrProvince', ns) || '' : '';
    const postalCode            = registrationAddressEl ? registrationAddressEl.getChildText('PostalCode', ns)      || '' : '';

    // 出品所在地を組み立て（City + State/Province）
    const itemLocation = [city, stateOrProvince].filter(Boolean).join(' ');

    // ストアプランを取得（GetStoreで確認）
    let storePlan = '（なし）';
    try {
      const storeXml =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<GetStoreRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
        '<RequesterCredentials>' +
        '<eBayAuthToken>' + token + '</eBayAuthToken>' +
        '</RequesterCredentials>' +
        '</GetStoreRequest>';

      const storeResponse = UrlFetchApp.fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-EBAY-API-CALL-NAME':          'GetStore',
          'X-EBAY-API-SITEID':             '0',
          'X-EBAY-API-COMPATIBILITY-LEVEL':'967',
          'X-EBAY-API-APP-NAME':           config.appId,
          'X-EBAY-API-DEV-NAME':           config.devId,
          'X-EBAY-API-CERT-NAME':          config.certId,
          'Content-Type':                  'text/xml'
        },
        payload: storeXml,
        muteHttpExceptions: true
      });

      const storeRoot = XmlService.parse(storeResponse.getContentText()).getRootElement();
      const storeAck  = storeRoot.getChildText('Ack', ns);
      if (storeAck === 'Success' || storeAck === 'Warning') {
        const storeEl        = storeRoot.getChild('Store', ns);
        const subscriptionEl = storeEl ? storeEl.getChild('Subscription', ns) : null;
        const level          = subscriptionEl ? subscriptionEl.getChildText('Level', ns) || '' : '';
        if (level) storePlan = level;
      }
    } catch(storeErr) {
      Logger.log('GetStore エラー（続行）: ' + storeErr.toString());
    }

    Logger.log('取得結果: ユーザーID=' + userId + ' 所在地=' + itemLocation +
               ' 郵便番号=' + postalCode + ' ストアプラン=' + storePlan);

    // ツール設定シートに書き込む
    const ss            = getTargetSpreadsheet(spreadsheetId);
    const settingsSheet = ss.getSheetByName('ツール設定');
    if (!settingsSheet) {
      Logger.log('❌ setupSellerInfo 失敗: ツール設定シートが見つかりません');
      return { success: false, message: 'ツール設定シートが見つかりません。' };
    }

    const data     = settingsSheet.getDataRange().getValues();
    const headers  = data[0];
    const itemIdx  = headers.findIndex(function(h) { return String(h || '').trim() === '項目'; });
    const valueIdx = headers.findIndex(function(h) { return String(h || '').trim() === '値'; });

    if (itemIdx === -1 || valueIdx === -1) {
      Logger.log('❌ setupSellerInfo 失敗: ツール設定シートに「項目」「値」列が見つかりません');
      return { success: false, message: 'ツール設定シートに「項目」「値」列が見つかりません。' };
    }

    // 書き込みマップ（項目名 → 値）
    const writeMap = {};
    if (itemLocation) writeMap['出品所在地']    = itemLocation;
    if (postalCode)   writeMap['郵便番号']       = postalCode.replace(/-/g, '');
    if (userId)       writeMap['eBayユーザーID'] = userId;
    if (storePlan)    writeMap['ストアプラン']   = storePlan;

    const updatedKeys = [];
    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][itemIdx] || '').trim();
      if (writeMap.hasOwnProperty(key)) {
        settingsSheet.getRange(i + 1, valueIdx + 1).setValue(writeMap[key]);
        updatedKeys.push(key + ': ' + writeMap[key]);
        Logger.log('✅ 書き込み: ' + key + ' = ' + writeMap[key]);
      }
    }

    if (updatedKeys.length === 0) {
      return {
        success: false,
        message: 'ツール設定シートに以下の項目が見つかりません:\n' +
                 Object.keys(writeMap).join('\n') +
                 '\n\nツール設定シートに項目を追加してください。'
      };
    }

    return {
      success: true,
      message: '✅ 出品者情報を更新しました。\n\n' + updatedKeys.join('\n')
    };

  } catch(e) {
    Logger.log('❌ setupSellerInfo エラー: ' + e.toString());
    return { success: false, message: 'エラー: ' + e.toString() };
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

    Logger.log('endFixedPriceItem 開始: itemId=' + itemId + ' (type=' + typeof itemId + ')');

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
      const errCode   = errElFPI
        ? (errElFPI.getChild('ErrorCode', ns) || { getText: function() { return ''; } }).getText()
        : '';
      const longMsg   = errElFPI
        ? (errElFPI.getChild('LongMessage', ns) || { getText: function() { return ''; } }).getText()
        : '';
      Logger.log('EndFixedPriceItem 失敗: ErrorCode=' + errCode + ' ShortMessage=' + shortMsg + ' LongMessage=' + longMsg);

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

    const errElEI    = rootEI.getChild('Errors', nsEI);
    const errCodeEI  = errElEI
      ? (errElEI.getChild('ErrorCode', nsEI) || { getText: function() { return ''; } }).getText()
      : '';
    const errMsgEI   = errElEI
      ? (errElEI.getChild('ShortMessage', nsEI) || { getText: function() { return ''; } }).getText()
      : textEI;
    const longMsgEI  = errElEI
      ? (errElEI.getChild('LongMessage', nsEI) || { getText: function() { return ''; } }).getText()
      : '';
    Logger.log('EndItem 失敗: ErrorCode=' + errCodeEI + ' ShortMessage=' + errMsgEI + ' LongMessage=' + longMsgEI);
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

    // ISBN を項目名①～30 から検出して ProductListingDetails 経由で送信
    const isbnSpec = (listingData.itemSpecifics || []).find(function(spec) {
      return spec.name && spec.name.trim() === 'ISBN';
    });
    if (isbnSpec && isbnSpec.value) {
      xmlBody += '<ProductListingDetails>' +
        '<ISBN>' + escapeXml(String(isbnSpec.value).trim()) + '</ISBN>' +
        '</ProductListingDetails>';
    }

    // Item Specifics（AddFixedPriceItem と同じ構造: 専用列 + 項目名/内容列）
    // ISBN は ProductListingDetails 経由で送信済みのため除外
    const reviseExclude = ['Brand', 'MPN', 'UPC', 'EAN', 'ISBN'];
    const filteredSpecifics = (listingData.itemSpecifics || []).filter(function(spec) {
      return spec.name && spec.name.trim() !== 'ISBN';
    });
    const hasSpecifics = listingData.brand || listingData.mpn ||
                         listingData.upc   || listingData.ean ||
                         filteredSpecifics.length > 0;

    if (hasSpecifics) {
      xmlBody += '<ItemSpecifics>';

      // Brand専用列（AddFixedPriceItemと同じ処理）
      if (listingData.brand && String(listingData.brand).trim() !== '') {
        xmlBody += '<NameValueList><Name>Brand</Name>' +
          '<Value>' + escapeXml(String(listingData.brand).trim()) + '</Value></NameValueList>';
      }
      // MPN専用列
      if (listingData.mpn && String(listingData.mpn).trim() !== '') {
        xmlBody += '<NameValueList><Name>MPN</Name>' +
          '<Value>' + escapeXml(String(listingData.mpn).trim()) + '</Value></NameValueList>';
      }
      // UPC専用列
      if (listingData.upc && String(listingData.upc).trim() !== '') {
        xmlBody += '<NameValueList><Name>UPC</Name>' +
          '<Value>' + escapeXml(String(listingData.upc).trim()) + '</Value></NameValueList>';
      }
      // EAN専用列
      if (listingData.ean && String(listingData.ean).trim() !== '') {
        xmlBody += '<NameValueList><Name>EAN</Name>' +
          '<Value>' + escapeXml(String(listingData.ean).trim()) + '</Value></NameValueList>';
      }
      // 項目名①～30（専用列と重複する名前は除外、ISBN は除外済み）
      filteredSpecifics.forEach(function(spec) {
        if (reviseExclude.indexOf(spec.name) !== -1) return;
        xmlBody += '<NameValueList>' +
          '<Name>'  + escapeXml(spec.name)  + '</Name>' +
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
      // 更新タイムスタンプを同じスプレッドシート（出品DB）の同じ行に書き込む
      try {
        const now = new Date();
        const tsStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd/HH:mm:ss');

        // 現在のスプレッドシート（出品DB）の出品シートを取得
        const currentSS = getTargetSpreadsheet(spreadsheetId);
        const currentSheet = currentSS.getSheetByName(SHEET_NAMES.LISTING);
        if (currentSheet) {
          const currentHeaders = currentSheet.getRange(1, 1, 1, currentSheet.getLastColumn()).getValues()[0];
          const currentMap = {};
          currentHeaders.forEach(function(h, i) { if (h) currentMap[String(h).trim()] = i + 1; });

          const tsCol = currentMap['更新タイムスタンプ'];
          if (tsCol) {
            currentSheet.getRange(rowNumber, tsCol).setValue(tsStr);
            Logger.log('✅ 更新タイムスタンプ書き込み: ' + tsStr + ' / 行' + rowNumber);
          } else {
            Logger.log('⚠️ 更新タイムスタンプ列が見つかりません');
          }
        }
      } catch(tsErr) {
        Logger.log('⚠️ 更新タイムスタンプ書き込みエラー（更新処理は完了）: ' + tsErr.toString());
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
 * eBayの数量を0に更新する（在庫切れ処理）
 */
function reviseQuantityToZero(spreadsheetId, rowNumber, itemId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    autoRefreshTokenIfNeeded(spreadsheetId);
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const config = getEbayConfig();
    const token = config.userToken;
    const apiUrl = 'https://api.ebay.com/ws/api.dll';

    const xmlRequest = '<?xml version="1.0" encoding="utf-8"?>' +
      '<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
      '<RequesterCredentials>' +
      '<eBayAuthToken>' + token + '</eBayAuthToken>' +
      '</RequesterCredentials>' +
      '<Item>' +
      '<ItemID>' + itemId + '</ItemID>' +
      '<Quantity>0</Quantity>' +
      '</Item>' +
      '</ReviseFixedPriceItemRequest>';

    const options = {
      method: 'POST',
      headers: {
        'X-EBAY-API-CALL-NAME': 'ReviseFixedPriceItem',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-APP-NAME': config.appId,
        'X-EBAY-API-DEV-NAME': config.devId,
        'X-EBAY-API-CERT-NAME': config.certId,
        'Content-Type': 'text/xml'
      },
      payload: xmlRequest,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const ns = XmlService.getNamespace('urn:ebay:apis:eBLBaseComponents');
    const root = XmlService.parse(response.getContentText()).getRootElement();
    const ack = root.getChildText('Ack', ns);

    if (ack === 'Success' || ack === 'Warning') {
      Logger.log('✅ 数量0更新成功: Item ID=' + itemId);
      return { success: true, message: '✅ 数量を0にしました。' };
    }

    const errEl = root.getChild('Errors', ns);
    const errMsg = errEl
      ? (errEl.getChildText('ShortMessage', ns) || '不明なエラー')
      : '不明なエラー';
    return { success: false, message: errMsg };

  } catch(e) {
    Logger.log('❌ reviseQuantityToZero エラー: ' + e.toString());
    return { success: false, message: e.toString() };
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

  // ConditionIDを事前解決（インライン呼び出しをやめてエラーを分かりやすくする）
  let conditionId;
  try {
    conditionId = resolveConditionIdFromMaster(listingData.condition, config, listingData.categoryId);
  } catch (condErr) {
    return { success: false, message: '状態（コンディション）の解決に失敗しました。\n状態列の値を確認してください。\n詳細: ' + condErr.toString() };
  }

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
    '<ConditionID>' + conditionId + '</ConditionID>' +
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

  // ISBN を項目名①～30 から検出して ProductListingDetails 経由で送信
  var isbnSpec = (listingData.itemSpecifics || []).find(function(spec) {
    return spec.name && spec.name.trim() === 'ISBN';
  });
  if (isbnSpec && isbnSpec.value) {
    xmlBody += '<ProductListingDetails>' +
      '<ISBN>' + escapeXml(String(isbnSpec.value).trim()) + '</ISBN>' +
      '</ProductListingDetails>';
  }

  // ItemSpecifics構築（専用列のBrand/UPC/EAN/MPNも含める）
  // ISBN は ProductListingDetails 経由で送信済みのため除外
  var excludeFromSpecifics = ['Brand', 'MPN', 'UPC', 'EAN', 'ISBN'];
  var filteredSpecifics = (listingData.itemSpecifics || []).filter(function(spec) {
    return spec.name && spec.name.trim() !== 'ISBN';
  });

  xmlBody += '<ItemSpecifics>';

  // Brand専用列から追加
  if (listingData.brand && String(listingData.brand).trim() !== '') {
    xmlBody += '<NameValueList>' +
      '<Name>Brand</Name>' +
      '<Value>' + escapeXml(String(listingData.brand).trim()) + '</Value>' +
      '</NameValueList>';
  }

  // MPN専用列から追加
  if (listingData.mpn && String(listingData.mpn).trim() !== '') {
    xmlBody += '<NameValueList>' +
      '<Name>MPN</Name>' +
      '<Value>' + escapeXml(String(listingData.mpn).trim()) + '</Value>' +
      '</NameValueList>';
  }

  // UPC専用列から追加
  if (listingData.upc && String(listingData.upc).trim() !== '') {
    xmlBody += '<NameValueList>' +
      '<Name>UPC</Name>' +
      '<Value>' + escapeXml(String(listingData.upc).trim()) + '</Value>' +
      '</NameValueList>';
  }

  // EAN専用列から追加
  if (listingData.ean && String(listingData.ean).trim() !== '') {
    xmlBody += '<NameValueList>' +
      '<Name>EAN</Name>' +
      '<Value>' + escapeXml(String(listingData.ean).trim()) + '</Value>' +
      '</NameValueList>';
  }

  // 項目名/内容列のItem Specifics（専用列・ISBNで除外済みのものを除外）
  filteredSpecifics.forEach(function(spec) {
    if (excludeFromSpecifics.indexOf(spec.name) !== -1) return;
    xmlBody += '<NameValueList>' +
      '<Name>' + escapeXml(spec.name) + '</Name>' +
      '<Value>' + escapeXml(spec.value) + '</Value>' +
      '</NameValueList>';
  });

  xmlBody += '</ItemSpecifics>';

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

  // エラー・警告を全件収集（eBayは複数の <Errors> を返す場合がある）
  const errorsElements = root.getChildren('Errors', ns);
  const allErrors = [];
  const allWarnings = [];
  for (var i = 0; i < errorsElements.length; i++) {
    var err = errorsElements[i];
    var severity = err.getChildText('SeverityCode', ns);
    var errorCode = err.getChildText('ErrorCode', ns) || '';
    var longMsg = err.getChildText('LongMessage', ns) || '';
    if (severity === 'Error') {
      Logger.log('❌ eBayエラー: ' + errorCode + ' / ' + longMsg);
      allErrors.push('ErrorCode: ' + errorCode + ' / ' + longMsg);
    } else {
      allWarnings.push('ErrorCode: ' + errorCode + ' / ' + longMsg);
    }
  }

  if (ack === 'Success' || ack === 'Warning') {
    const itemIdElement = root.getChild('ItemID', ns);
    const itemId = itemIdElement ? itemIdElement.getText() : '';
    Logger.log('✅ 出品成功: Item ID = ' + itemId);
    if (allWarnings.length > 0) {
      Logger.log('⚠️ Warning: ' + allWarnings.join(' | '));
    }
    return {
      success: true,
      itemId: itemId,
      warning: allWarnings.length > 0 ? allWarnings.join('\n') : ''
    };
  } else {
    const errorMessage = allErrors.length > 0 ? allErrors.join('\n') : 'Unknown error';
    Logger.log('❌ 出品失敗: ' + errorMessage);
    Logger.log('Full Response: ' + responseText);
    return { success: false, message: errorMessage };
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
      outputRow[outputColMap[statusKey]] = '出品中';
      Logger.log('ステータスを設定: 出品中');
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
 * 出品DB転記 Phase1: 商品データのみ転記（特殊フィールドは空欄）
 * 出品前に実行し、書き込み行番号を返す
 *
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @param {number} rowNumber 出品行番号
 * @param {Object} listingData 出品データ
 * @param {string} outputDbId 出品DBスプレッドシートID
 * @returns {{ success: boolean, dbRow?: number, error?: string }}
 */
function transferToOutputDb_phase1(spreadsheetId, rowNumber, listingData, outputDbId) {
  try {
    Logger.log('=== 出品DB転記 Phase1開始 ===');

    if (!outputDbId || outputDbId === '') {
      return { success: false, error: '「ツール設定」シートの「出品DB」にスプレッドシートURLが設定されていません。' };
    }

    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const outputSpreadsheet = SpreadsheetApp.openById(outputDbId);
    let outputSheet = outputSpreadsheet.getSheetByName('出品');
    if (!outputSheet) {
      outputSheet = outputSpreadsheet.insertSheet('出品');
      Logger.log('✅ "出品"シートを作成しました');
    }

    // ヘッダー行が存在しない場合はコピー
    if (outputSheet.getLastRow() < 1) {
      const sourceSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
      const sourceHeaders = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues();
      outputSheet.getRange(1, 1, 1, sourceHeaders[0].length).setValues(sourceHeaders);
      Logger.log('✅ ヘッダー行をコピーしました');
    }

    const sourceSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
    const srcLastCol = sourceSheet.getLastColumn();
    const sourceValues = sourceSheet.getRange(rowNumber, 1, 1, srcLastCol).getValues()[0];
    const sourceDisplayValues = sourceSheet.getRange(rowNumber, 1, 1, srcLastCol).getDisplayValues()[0];
    const sourceHeaderMapping = buildHeaderMapping();

    const outputHeaderRowRaw = outputSheet.getRange(1, 1, 1, outputSheet.getLastColumn()).getValues()[0];
    const outputHeaderRow = outputHeaderRowRaw.map(function(h) { return String(h || '').trim(); });
    const outputColMap = {};
    outputHeaderRow.forEach(function(h, i) { if (h) outputColMap[h] = i; });

    const specialFields = ['Item ID', '出品URL', '出品ステータス', 'ステータス', '出品タイムスタンプ', '管理年月'];
    const skipCols = ['容積重量(g)', '適用重量(g)'];
    const outputRow = new Array(outputHeaderRow.length).fill('');
    outputHeaderRow.forEach(function(h, i) {
      if (!h) return;
      if (skipCols.indexOf(h) !== -1) return;
      if (specialFields.indexOf(h) !== -1) return; // Phase2で書き込む
      const srcIdx = sourceHeaderMapping[h];
      if (srcIdx) {
        const rawVal = sourceValues[srcIdx - 1];
        outputRow[i] = (rawVal instanceof Date) ? sourceDisplayValues[srcIdx - 1] : rawVal;
      }
    });

    // --- SKU予約：書き込み行を特定してSKUだけ先に書き込む ---
    // SKU・Item ID・出品タイムスタンプ列のインデックスを取得
    const skuColInOutput    = outputHeaderRow.indexOf('SKU');
    const itemIdColInOutput = outputHeaderRow.indexOf('Item ID');
    const tsColInOutput     = outputHeaderRow.indexOf('出品タイムスタンプ');

    let newRow = null;

    // Step1: 既存行に同じSKUがあれば再利用（冪等性確保）
    if (skuColInOutput !== -1 && listingData.sku) {
      const lastRow = outputSheet.getLastRow();
      if (lastRow >= 5) {
        const skuValues = outputSheet.getRange(5, skuColInOutput + 1, lastRow - 4, 1).getValues();
        for (let i = 0; i < skuValues.length; i++) {
          if (String(skuValues[i][0]).trim() === String(listingData.sku).trim()) {
            newRow = i + 5;
            Logger.log('既存SKU行を再利用: ' + newRow + '行目 / SKU: ' + listingData.sku);
            break;
          }
        }
      }
    }

    // Step2: SKU一致行がなければ「完全な空行」を探す
    // 判定基準：SKU・Item ID・出品タイムスタンプ が全て空
    if (!newRow) {
      const lastRow = outputSheet.getLastRow();
      if (lastRow >= 5) {
        const checkRange = outputSheet.getRange(5, 1, lastRow - 4, outputHeaderRow.length);
        const allValues = checkRange.getValues(); // raw値で取得（日付誤認識なし）

        for (let i = 0; i < allValues.length; i++) {
          const rowData = allValues[i];

          const skuVal = skuColInOutput    !== -1 ? String(rowData[skuColInOutput]    || '').trim() : '';
          const idVal  = itemIdColInOutput !== -1 ? String(rowData[itemIdColInOutput]  || '').trim() : '';
          const tsVal  = tsColInOutput     !== -1 ? String(rowData[tsColInOutput]      || '').trim() : '';

          // 3列すべて空の行のみ再利用可能
          if (skuVal === '' && idVal === '' && tsVal === '') {
            newRow = i + 5;
            Logger.log('完全空行を再利用: ' + newRow + '行目');
            break;
          }
        }
      }
      // 空行が見つからなければ最終行の次
      if (!newRow) {
        newRow = Math.max(outputSheet.getLastRow() + 1, 5);
        Logger.log('新規行に追加: ' + newRow + '行目');
      }
    }

    // SKUを先行予約書き込み
    if (skuColInOutput !== -1 && listingData.sku) {
      outputSheet.getRange(newRow, skuColInOutput + 1).setValue(listingData.sku);
      Logger.log('SKU予約完了: ' + newRow + '行目 / SKU: ' + listingData.sku);
    }

    // Item ID列に出品中メモを書き込み（他の処理がこの行を再利用しないようにする）
    if (itemIdColInOutput !== -1) {
      outputSheet.getRange(newRow, itemIdColInOutput + 1).setValue('出品中: ' + listingData.sku);
      Logger.log('Item ID列に出品中メモを書き込み: ' + newRow + '行目');
    }

    // outputRowにSKUをセット
    if (skuColInOutput !== -1) {
      outputRow[skuColInOutput] = listingData.sku;
    }

    // 書き込み実行
    outputSheet.getRange(newRow, 1, 1, outputRow.length).setValues([outputRow]);
    Logger.log('✅ 出品DB Phase1転記完了: ' + newRow + '行目 / SKU: ' + listingData.sku);

    // 状態列のプルダウンを出品シートからDBシートにコピー
    const conditionColName = '状態';
    const srcConditionCol = sourceHeaderMapping[conditionColName];
    const dstConditionCol = outputColMap[conditionColName];

    if (srcConditionCol && dstConditionCol !== undefined) {
      try {
        const srcValidation = sourceSheet
          .getRange(rowNumber, srcConditionCol)
          .getDataValidation();

        if (srcValidation) {
          outputSheet
            .getRange(newRow, dstConditionCol + 1)
            .setDataValidation(srcValidation);
          Logger.log('✅ 状態プルダウンをDBにコピー完了');
        }
      } catch (e) {
        Logger.log('⚠️ 状態プルダウンコピーエラー（転記は継続）: ' + e.toString());
      }
    }

    return { success: true, dbRow: newRow, sku: listingData.sku };

  } catch (error) {
    Logger.log('❌ 出品DB Phase1転記エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * 出品DB転記 Phase2: 特殊フィールドのみ更新（Item ID・URL・ステータス等）
 *
 * @param {string} outputDbId 出品DBスプレッドシートID
 * @param {number} dbRow 更新対象行番号
 * @param {string} itemId eBay Item ID
 * @returns {{ success: boolean, error?: string }}
 */
function transferToOutputDb_phase2(outputDbId, dbRow, itemId, sku, epsImages) {
  try {
    Logger.log('=== 出品DB転記 Phase2開始 ===');

    const outputSpreadsheet = SpreadsheetApp.openById(outputDbId);
    const outputSheet = outputSpreadsheet.getSheetByName('出品');
    if (!outputSheet) {
      return { success: false, error: '出品DBに「出品」シートが見つかりません' };
    }

    const outputHeaderRowRaw = outputSheet.getRange(1, 1, 1, outputSheet.getLastColumn()).getValues()[0];
    const outputHeaderRow = outputHeaderRowRaw.map(function(h) { return String(h || '').trim(); });
    const outputColMap = {};
    outputHeaderRow.forEach(function(h, i) { if (h) outputColMap[h] = i; });

    // SKUで行を再検索（行番号ずれに備えて）
    if (sku) {
      const lastRow = outputSheet.getLastRow();
      const skuColInOutput = outputHeaderRow.indexOf('SKU');
      if (skuColInOutput !== -1 && lastRow >= 5) {
        const skuValues = outputSheet.getRange(5, skuColInOutput + 1, lastRow - 4, 1).getValues();
        for (let i = 0; i < skuValues.length; i++) {
          if (String(skuValues[i][0]).trim() === String(sku).trim()) {
            const foundRow = i + 5;
            if (foundRow !== dbRow) {
              Logger.log('⚠️ SKU検索で行番号を補正: ' + dbRow + ' → ' + foundRow);
              dbRow = foundRow;
            }
            break;
          }
        }
      }
    }

    const now = new Date();
    const year   = now.getFullYear();
    const month  = String(now.getMonth() + 1).padStart(2, '0');
    const day    = String(now.getDate()).padStart(2, '0');
    const hour   = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const timestamp       = year + '/' + month + '/' + day + '/' + hour + ':' + minute + ':' + second;
    const managementMonth = parseInt(year + month);
    const listingUrl      = 'https://www.ebay.com/itm/' + itemId;

    // 修正1: 各列の書き込みエラーで全体が止まらないようにする
    const skippedColumns = [];
    function safeSetValue(col, value, colName) {
      try {
        outputSheet.getRange(dbRow, col).setValue(value);
      } catch(e) {
        Logger.log('⚠️ DB書き込みスキップ: ' + colName + ' (列' + col + ') → ' + e.toString());
        skippedColumns.push(colName);
      }
    }

    if ('Item ID' in outputColMap) {
      safeSetValue(outputColMap['Item ID'] + 1, itemId, 'Item ID');
    }
    if ('出品URL' in outputColMap) {
      safeSetValue(outputColMap['出品URL'] + 1, listingUrl, '出品URL');
    }
    const statusKey = ('出品ステータス' in outputColMap) ? '出品ステータス' : 'ステータス';
    if (statusKey in outputColMap) {
      safeSetValue(outputColMap[statusKey] + 1, '出品中', statusKey);
    }
    if ('出品タイムスタンプ' in outputColMap) {
      safeSetValue(outputColMap['出品タイムスタンプ'] + 1, timestamp, '出品タイムスタンプ');
    }
    if ('管理年月' in outputColMap) {
      safeSetValue(outputColMap['管理年月'] + 1, managementMonth, '管理年月');
    }

    // EPS URLを画像列に書き戻す
    if (epsImages && epsImages.length > 0) {
      const imageColNames = [];
      for (let i = 1; i <= 23; i++) {
        imageColNames.push('画像' + i);
      }
      imageColNames.push('ストア画像');

      let epsIndex = 0;
      for (let i = 0; i < imageColNames.length; i++) {
        if (epsIndex >= epsImages.length) break;
        const colName = imageColNames[i];
        if (!(colName in outputColMap)) continue;
        // 修正2: Drive URLがある列のみEPS URLで上書き（epsIndexは常に進める）
        const currentVal = String(
          outputSheet.getRange(dbRow, outputColMap[colName] + 1).getValue() || ''
        ).trim();
        if (currentVal !== '' && epsIndex < epsImages.length) {
          safeSetValue(outputColMap[colName] + 1, epsImages[epsIndex], colName);
          Logger.log('DB EPS URL書き込み: ' + colName + ' → ' + epsImages[epsIndex].substring(0, 50));
        }
        epsIndex++; // 空欄でもインデックスを進めてズレを防ぐ
      }
      Logger.log('✅ DB EPS URL書き込み完了: ' + epsIndex + '列');
    }

    Logger.log('✅ 出品DB Phase2更新完了: ' + dbRow + '行目 / Item ID: ' + itemId);
    return { success: true, skippedColumns: skippedColumns };

  } catch (error) {
    Logger.log('❌ 出品DB Phase2更新エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 出品DBの指定行を削除（出品失敗時のロールバック用）
 *
 * @param {string} outputDbId 出品DBスプレッドシートID
 * @param {number} dbRow 削除対象行番号
 * @returns {{ success: boolean, error?: string }}
 */
function deleteDbRow(outputDbId, dbRow, sku) {
  try {
    Logger.log('=== 出品DB行クリア: ' + dbRow + '行目 ===');
    const outputSpreadsheet = SpreadsheetApp.openById(outputDbId);
    const outputSheet = outputSpreadsheet.getSheetByName('出品');
    if (!outputSheet) {
      return { success: false, error: '出品DBに「出品」シートが見つかりません' };
    }

    const lastCol = outputSheet.getLastColumn();

    // SKUで行を再検索
    if (sku) {
      const headerRow = outputSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const skuCol = headerRow.findIndex(function(h) {
        return String(h).trim() === 'SKU';
      });
      if (skuCol !== -1 && outputSheet.getLastRow() >= 5) {
        const skuValues = outputSheet.getRange(5, skuCol + 1, outputSheet.getLastRow() - 4, 1).getValues();
        for (let i = 0; i < skuValues.length; i++) {
          if (String(skuValues[i][0]).trim() === String(sku).trim()) {
            dbRow = i + 5;
            break;
          }
        }
      }
    }

    // 内容のみクリア（書式・プルダウンは維持）
    outputSheet.getRange(dbRow, 1, 1, lastCol).clearContent();

    // 状態列のプルダウンのみ削除（出品シートと同じルール）
    const headerRow = outputSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerMap = {};
    headerRow.forEach(function(h, i) {
      if (h) headerMap[String(h).trim()] = i + 1;
    });
    const conditionCol = headerMap['状態'];
    if (conditionCol) {
      outputSheet.getRange(dbRow, conditionCol).clearDataValidations();
    }

    Logger.log('✅ 出品DB行クリア完了: ' + dbRow + '行目');
    return { success: true };
  } catch (error) {
    Logger.log('❌ 出品DB行クリアエラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 出品シートにItem ID・タイムスタンプ・ステータスを書き戻す
 * （DB更新失敗時のフォールバック用）
 *
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @param {number} rowNumber 書き戻し対象行番号
 * @param {string} itemId eBay Item ID
 */
function writeBackToListingSheet(spreadsheetId, rowNumber, itemId) {
  try {
    Logger.log('=== 出品シート書き戻し開始 ===');
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const listingSheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
    if (!listingSheet) return;

    const headerMapping = buildHeaderMapping();

    const itemIdCol = headerMapping['Item ID'];
    if (itemIdCol) listingSheet.getRange(rowNumber, itemIdCol).setValue(itemId);

    const now = new Date();
    const year   = now.getFullYear();
    const month  = String(now.getMonth() + 1).padStart(2, '0');
    const day    = String(now.getDate()).padStart(2, '0');
    const hour   = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const timestamp = year + '/' + month + '/' + day + '/' + hour + ':' + minute + ':' + second;

    const tsCol = headerMapping['出品タイムスタンプ'];
    if (tsCol) listingSheet.getRange(rowNumber, tsCol).setValue(timestamp);

    const statusKey = headerMapping['出品ステータス'] ? '出品ステータス' : 'ステータス';
    const statusCol = headerMapping[statusKey];
    if (statusCol) listingSheet.getRange(rowNumber, statusCol).setValue('出品中');

    Logger.log('✅ 出品シート書き戻し完了: ' + rowNumber + '行目 / Item ID: ' + itemId);
  } catch (error) {
    Logger.log('❌ 出品シート書き戻しエラー: ' + error.toString());
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

/**
 * EPSアップロード済みURLを出品シートの画像列に書き戻す
 * 次回更新時にAPIを再度叩かずに済む
 *
 * @param {string} spreadsheetId 出品スプレッドシートID
 * @param {number} rowNumber 対象行番号
 * @param {Array} originalImages 元の画像URL配列（extractImageUrls()の出力順）
 * @param {Array} epsUrls EPS URL配列（uploadAllImagesToEPS()の出力順）
 * @param {Object} headerMapping ヘッダーマッピング
 */
function writeEpsUrlsToSheet(spreadsheetId, rowNumber, originalImages, epsUrls, headerMapping) {
  try {
    if (!epsUrls || epsUrls.length === 0) return;

    Logger.log('=== EPS URL書き戻し開始: ' + epsUrls.length + '件 ===');

    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    const sheet = getTargetSpreadsheet(spreadsheetId).getSheetByName(SHEET_NAMES.LISTING);
    if (!sheet) return;

    // extractImageUrls() と同じ順番で列を走査
    // 画像1〜23 → ストア画像 の順
    const imageColNames = [];
    for (let i = 1; i <= 23; i++) {
      imageColNames.push('画像' + i);
    }
    imageColNames.push('ストア画像');

    let epsIndex = 0;
    let writeCount = 0;

    for (let i = 0; i < imageColNames.length; i++) {
      const colName = imageColNames[i];
      const colNum = headerMapping[colName];
      if (!colNum) continue;

      // 元のURLが存在する列のみ書き戻す
      const originalUrl = sheet.getRange(rowNumber, colNum).getDisplayValue().trim();
      if (!originalUrl) continue;

      // 対応するEPS URLがあれば書き戻す
      if (epsIndex < epsUrls.length && epsUrls[epsIndex]) {
        sheet.getRange(rowNumber, colNum).setValue(epsUrls[epsIndex]);
        Logger.log('EPS URL書き戻し: ' + colName + ' → ' + epsUrls[epsIndex].substring(0, 50) + '...');
        writeCount++;
      }
      epsIndex++;
    }

    Logger.log('✅ EPS URL書き戻し完了: ' + writeCount + '列');

  } catch (e) {
    Logger.log('⚠️ EPS URL書き戻しエラー（出品は継続）: ' + e.toString());
    // 書き戻し失敗は致命的ではないため出品処理は継続
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
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

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

    // Phase1: 出品前にDB転記（商品データのみ・特殊フィールドは空欄）
    const config = getEbayConfig();
    const outputDbId = config.outputDbSpreadsheetId;
    let dbRow = null;
    if (outputDbId && outputDbId !== '') {
      const phase1Result = transferToOutputDb_phase1(spreadsheetId, rowNumber, listingData, outputDbId);
      if (!phase1Result.success) {
        return {
          success: false,
          message: '⚠️ DB転記に失敗したため出品を中止しました。\n\n理由: ' + phase1Result.error
        };
      }
      dbRow = phase1Result.dbRow;
      // phase1のfinally でCURRENT_SPREADSHEET_IDがリセットされるため再設定
      if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    } else {
      Logger.log('⚠️ 出品DBが未設定のため転記をスキップします');
    }

    // Phase1.5: 画像をEPSにアップロード
    const config2 = getEbayConfig();
    const accessToken = config2.userToken;
    let epsImages = null;
    if (listingData.images && listingData.images.length > 0) {
      Logger.log('=== 画像EPSアップロード開始: ' + listingData.images.length + '枚 ===');
      epsImages = uploadAllImagesToEPS(listingData.images, accessToken);
      if (epsImages.length === 0) {
        // 全画像のアップロード失敗 → DB行をロールバックして終了
        if (dbRow && outputDbId) deleteDbRow(outputDbId, dbRow, listingData.sku);
        return {
          success: false,
          message: '❌ 全ての画像のEPSアップロードに失敗しました。\nDrive共有設定を確認してください。'
        };
      }
      listingData.images = epsImages;
      Logger.log('✅ 画像EPSアップロード完了: ' + epsImages.length + '枚');
    }
    // CURRENT_SPREADSHEET_IDを再セット
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    // Phase2: eBay出品
    let result;
    try {
      result = addItemWithTradingApi(listingData, policyIds);
    } catch (ebayError) {
      // ネットワークエラー等、予期しない例外 → DB行をロールバック
      if (dbRow && outputDbId) {
        deleteDbRow(outputDbId, dbRow, listingData.sku);
        Logger.log('⚠️ 出品失敗のためDB転記データを削除しました');
      }
      return {
        success: false,
        message: '❌ 出品に失敗しました。' + (dbRow ? 'DB転記データを削除しました。' : '') + '\n\n理由: ' + ebayError.toString()
      };
    }
    // eBay APIエラー（Failure レスポンス）→ DB行をロールバック
    if (!result.success) {
      if (dbRow && outputDbId) {
        deleteDbRow(outputDbId, dbRow, listingData.sku);
        Logger.log('⚠️ 出品失敗のためDB転記データを削除しました');
      }
      return {
        success: false,
        message: '❌ 出品に失敗しました。' + (dbRow ? 'DB転記データを削除しました。' : '') + '\n\n' + result.message
      };
    }
    Logger.log('✅ 出品完了');

    // Phase3: Promoted Listing設定（任意）
    let promotedListingResult = null;
    if (listingData.promotedListing && !isNaN(parseFloat(listingData.promotedListing))) {
      const adRate = parseFloat(listingData.promotedListing);
      promotedListingResult = createPromotedListing(result.itemId, adRate);
      if (!promotedListingResult.success) {
        Logger.log('⚠️ Promoted Listing設定に失敗しましたが、出品は成功しています');
        Logger.log('エラー: ' + promotedListingResult.error);
      }
    }

    // Phase4: DB側に特殊フィールドを更新（Item ID・URL・ステータス等）
    let phase2SkippedColumns = [];
    if (dbRow && outputDbId) {
      const phase2Result = transferToOutputDb_phase2(outputDbId, dbRow, result.itemId, listingData.sku, epsImages);
      if (!phase2Result.success) {
        // DB更新失敗 → 出品シートに書き戻してユーザーに通知
        writeBackToListingSheet(spreadsheetId, rowNumber, result.itemId);
        return {
          success: true,
          transferred: false,
          warning: '⚠️ 出品は完了しましたが、DB更新に失敗しました。\n出品シートにItem IDを記録しました。\n\n理由: ' + phase2Result.error,
          itemId: result.itemId,
          sku: listingData.sku || '',
          promotedListing: promotedListingResult || null,
          rowCleared: false
        };
      }
      phase2SkippedColumns = phase2Result.skippedColumns || [];
    }

    // Phase5: 出品シートのデータクリア
    clearAndMoveListingRow(spreadsheetId, rowNumber);
    return {
      success: true,
      transferred: dbRow !== null,
      itemId: result.itemId,
      sku: listingData.sku || '',
      promotedListing: promotedListingResult || null,
      rowCleared: true,
      skippedColumns: phase2SkippedColumns,
      missingCols: []
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

    // ワード判定を実行
    const titleForCheck = sheet.getRange(row, titleCol).getDisplayValue();
    checkAndWriteWordJudgement(sheet, row, titleForCheck, buildHeaderMapping(), spreadsheetId);

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

// ─────────────────────────────────────────────────────────────────────────────
// eBay スペック取得・書き込みビジネスロジック（Steps 10-13）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * カテゴリマスタから 1 カテゴリ分のデータを取得
 * category_master_EBAY_US シートをヘッダーベースで読み込む
 *
 * @param {string} spreadsheetId
 * @param {string} categoryId
 * @returns {Object|null} {requiredSpecs, recommendedSpecs, optionalSpecs, aspectValues, conditionGroup}
 */
function getCategoryMasterDataForListing(spreadsheetId, categoryId) {
  try {
    const config        = getListingToolConfig(spreadsheetId);
    const masterIdOrUrl = String(config['カテゴリマスタ'] || '').trim();
    if (!masterIdOrUrl) {
      Logger.log('[getCategoryMasterDataForListing] カテゴリマスタが未設定（ツール設定 > カテゴリマスタ）');
      return null;
    }

    let masterId = masterIdOrUrl;
    const urlMatch = masterIdOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) masterId = urlMatch[1];

    const masterSs = SpreadsheetApp.openById(masterId);
    const sheet    = masterSs.getSheetByName('category_master_EBAY_US');
    if (!sheet) {
      Logger.log('[getCategoryMasterDataForListing] category_master_EBAY_US シートが見つかりません');
      return null;
    }

    const data    = sheet.getDataRange().getValues();
    const headers = data[0];

    const idx = {
      catId:   headers.indexOf('category_id'),
      catName: headers.indexOf('category_name'),
      req:     headers.indexOf('required_specs_json'),
      rec:     headers.indexOf('recommended_specs_json'),
      opt:     headers.indexOf('optional_specs_json'),
      aspVal:  headers.indexOf('aspect_values_json'),
      group:   headers.indexOf('condition_group')
    };

    if (idx.catId === -1) {
      Logger.log('[getCategoryMasterDataForListing] category_id 列が見つかりません');
      return null;
    }

    const parseArr = function(v) { try { return v ? JSON.parse(v) : []; } catch (e) { return []; } };
    const parseObj = function(v) { try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; } };

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.catId]) === String(categoryId)) {
        return {
          categoryId:       String(data[i][idx.catId]),
          categoryName:     idx.catName !== -1 ? String(data[i][idx.catName] || '') : '',
          requiredSpecs:    idx.req    !== -1 ? parseArr(data[i][idx.req])    : [],
          recommendedSpecs: idx.rec    !== -1 ? parseArr(data[i][idx.rec])    : [],
          optionalSpecs:    idx.opt    !== -1 ? parseArr(data[i][idx.opt])    : [],
          aspectValues:     idx.aspVal !== -1 ? parseObj(data[i][idx.aspVal]) : {},
          conditionGroup:   idx.group  !== -1 ? String(data[i][idx.group] || '') : ''
        };
      }
    }

    Logger.log('[getCategoryMasterDataForListing] カテゴリID ' + categoryId + ' が見つかりません');
    return null;

  } catch (e) {
    Logger.log('[getCategoryMasterDataForListing] エラー: ' + e.toString());
    return null;
  }
}

/**
 * Item Specifics を優先度順にソートして最大 30 件返す
 * Brand / UPC / EAN / MPN / Condition は除外（専用列に書き込む）
 * 30 件未満の場合、カテゴリマスタから不足分を充填
 *
 * @param {Object} specifics {name: value}
 * @param {Object|null} catData getCategoryMasterDataForListing の戻り値
 * @returns {Array<{name, value, priority, hasValue, color}>}
 */
function sortSpecsForListing(specifics, catData) {
  const EXCLUDE           = ['Brand', 'UPC', 'EAN', 'MPN', 'Condition'];
  const COLOR_REQUIRED    = '#CC0000';
  const COLOR_RECOMMENDED = '#1155CC';
  const COLOR_OPTIONAL    = '#666666';

  const requiredSpecs    = catData ? (catData.requiredSpecs    || []) : [];
  const recommendedSpecs = catData ? (catData.recommendedSpecs || []) : [];
  const optionalSpecs    = catData ? (catData.optionalSpecs    || []) : [];

  const specArray = [];
  const usedNames = [];

  Object.keys(specifics).forEach(function(key) {
    if (EXCLUDE.indexOf(key) !== -1) return;

    const value    = specifics[key];
    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';

    let priority = 3;
    let color    = COLOR_OPTIONAL;

    if (requiredSpecs.indexOf(key) !== -1) {
      priority = 1; color = COLOR_REQUIRED;
    } else if (recommendedSpecs.indexOf(key) !== -1) {
      priority = 2; color = COLOR_RECOMMENDED;
    }

    specArray.push({ name: key, value: value || '', priority: priority, hasValue: hasValue, color: color });
    usedNames.push(key);
  });

  specArray.sort(function(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.hasValue !== b.hasValue) return a.hasValue ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (specArray.length < 30) {
    const fillCandidates = [];

    requiredSpecs.forEach(function(name) {
      if (typeof name !== 'string') return;
      if (usedNames.indexOf(name) === -1 && EXCLUDE.indexOf(name) === -1) {
        fillCandidates.push({ name: name, value: '', priority: 1, hasValue: false, color: COLOR_REQUIRED });
      }
    });
    recommendedSpecs.forEach(function(name) {
      if (typeof name !== 'string') return;
      if (usedNames.indexOf(name) === -1 && EXCLUDE.indexOf(name) === -1) {
        fillCandidates.push({ name: name, value: '', priority: 2, hasValue: false, color: COLOR_RECOMMENDED });
      }
    });
    optionalSpecs.forEach(function(name) {
      if (typeof name !== 'string') return;
      if (usedNames.indexOf(name) === -1 && EXCLUDE.indexOf(name) === -1) {
        fillCandidates.push({ name: name, value: '', priority: 3, hasValue: false, color: COLOR_OPTIONAL });
      }
    });

    const remaining = 30 - specArray.length;
    for (let i = 0; i < remaining && i < fillCandidates.length; i++) {
      specArray.push(fillCandidates[i]);
    }
  }

  Logger.log('[sortSpecsForListing] 最終スペック数: ' + specArray.length + '件');
  return specArray;
}

/**
 * ソート済みスペックを出品シートの Item Specifics 列に書き込む
 *
 * @param {Sheet} sheet
 * @param {number} row
 * @param {Object} headerMapping
 * @param {Array} sortedSpecs
 * @param {Object|null} catData
 */
function writeSpecsToListingSheet(sheet, row, headerMapping, sortedSpecs, catData) {
  const aspectValues = catData ? (catData.aspectValues || {}) : {};
  const limit        = Math.min(sortedSpecs.length, 30);

  for (let i = 0; i < 30; i++) {
    const nameCol  = headerMapping['項目名（' + (i + 1) + '）'];
    const valueCol = headerMapping['内容（' + (i + 1) + '）'];

    if (!nameCol && !valueCol) continue;

    if (i >= limit) {
      if (nameCol)  sheet.getRange(row, nameCol).clearContent().clearDataValidations().setFontColor(null);
      if (valueCol) sheet.getRange(row, valueCol).clearContent().clearDataValidations();
      continue;
    }

    const spec = sortedSpecs[i];

    if (nameCol) {
      sheet.getRange(row, nameCol)
        .setValue(spec.name)
        .setFontColor(spec.color);
    }

    if (valueCol) {
      const valueCell = sheet.getRange(row, valueCol);

      const allowed = aspectValues[spec.name];
      if (Array.isArray(allowed) && allowed.length > 0) {
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(allowed.map(String), true)
          .setAllowInvalid(true)
          .build();
        valueCell.setDataValidation(rule);
      } else {
        valueCell.clearDataValidations();
      }

      if (spec.value !== null && spec.value !== undefined && String(spec.value).trim() !== '') {
        valueCell.setValue(spec.value);
      } else {
        valueCell.clearContent();
      }
    }
  }

  Logger.log('[writeSpecsToListingSheet] 書き込み完了: ' + limit + '件');
}

/**
 * スペックURLから商品情報を取得して出品シートに書き込む
 * UI呼び出しなし。結果をオブジェクトで返す。
 *
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {number} row
 * @param {string} specUrl
 * @param {boolean} [skipCategoryCheck=false] trueの場合カテゴリ不一致でも上書きして続行
 * @returns {{ success: boolean, message: string, filledCount: number,
 *             categoryMismatch?: boolean, currentCategoryId?: string,
 *             fetchedCategoryId?: string, fetchedCategoryName?: string }}
 */
function fetchAndWriteSpecForListing(spreadsheetId, sheetName, row, specUrl, skipCategoryCheck) {
  try {
    // 1. Item ID を抽出
    const itemId = extractItemIdForListing(specUrl);
    if (!itemId) {
      return { success: false, message: 'URLから商品IDを抽出できませんでした: ' + specUrl, filledCount: 0 };
    }
    Logger.log('[fetchAndWriteSpecForListing] itemId=' + itemId);

    // 2. シートとヘッダーマッピングを取得
    const ss    = getTargetSpreadsheet(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, message: 'シートが見つかりません: ' + sheetName, filledCount: 0 };
    }
    const headerMapping = buildListingHeaderMapping(spreadsheetId, sheetName);

    // 3. eBay API で商品情報を取得
    const item = getItemForListing(spreadsheetId, itemId);

    // 4. カテゴリ情報を抽出
    const fetchedCategoryId   = extractCategoryIdFromItem(item);
    const fetchedCategoryName = extractCategoryNameFromItem(item);
    Logger.log('[fetchAndWriteSpecForListing] fetched category: ' + fetchedCategoryId + ' / ' + fetchedCategoryName);

    // 5. カテゴリID不一致チェック
    const categoryIdCol   = headerMapping['カテゴリID'];
    const categoryNameCol = headerMapping['カテゴリ'];
    const currentCategoryId = categoryIdCol
      ? String(sheet.getRange(row, categoryIdCol).getValue() || '').trim()
      : '';

    if (currentCategoryId && fetchedCategoryId && currentCategoryId !== fetchedCategoryId) {
      if (!skipCategoryCheck) {
        Logger.log('[fetchAndWriteSpecForListing] カテゴリID不一致を検出: ' + currentCategoryId + ' → ' + fetchedCategoryId);
        return {
          success:           false,
          categoryMismatch:  true,
          currentCategoryId: currentCategoryId,
          fetchedCategoryId: fetchedCategoryId,
          fetchedCategoryName: fetchedCategoryName,
          message:           'カテゴリIDが一致しません',
          filledCount:       0
        };
      }
      Logger.log('[fetchAndWriteSpecForListing] カテゴリID不一致: ' + currentCategoryId +
                 ' → ' + fetchedCategoryId + ' (' + fetchedCategoryName + ') skipCategoryCheck=trueにより上書き');
    }

    // 6. カテゴリID / カテゴリ名を書き込み
    if (fetchedCategoryId && categoryIdCol) {
      sheet.getRange(row, categoryIdCol).setValue(fetchedCategoryId);
    }
    if (fetchedCategoryName && categoryNameCol) {
      sheet.getRange(row, categoryNameCol).setValue(fetchedCategoryName);
    }

    // 7. アイテムスペシフィックスを抽出
    const specifics = extractItemSpecificsFromItem(item);
    Logger.log('[fetchAndWriteSpecForListing] specifics count=' + Object.keys(specifics).length);

    // 8. カテゴリマスタデータを取得
    const targetCategoryId = fetchedCategoryId || currentCategoryId;
    const catData = targetCategoryId ? getCategoryMasterDataForListing(spreadsheetId, targetCategoryId) : null;

    // 9. スペックを優先度順にソート・充填
    const sortedSpecs = sortSpecsForListing(specifics, catData);

    // 10. シートに書き込み
    writeSpecsToListingSheet(sheet, row, headerMapping, sortedSpecs, catData);

    // 11. スペックURLをクリア（同一URL再入力でもトリガーが発火するよう）
    const specUrlColForClear = headerMapping['スペックURL'];
    if (specUrlColForClear) sheet.getRange(row, specUrlColForClear).clearContent();

    const filledCount = sortedSpecs.filter(function(s) { return s.value && String(s.value).trim() !== ''; }).length;
    Logger.log('[fetchAndWriteSpecForListing] 完了: ' + filledCount + '件');

    return { success: true, message: '', filledCount: filledCount };

  } catch (err) {
    Logger.log('[fetchAndWriteSpecForListing] エラー: ' + err.toString());
    return { success: false, message: err.toString(), filledCount: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// eBay Browse API 商品情報取得
// ─────────────────────────────────────────────────────────────────────────────

/**
 * eBay Browse API で商品情報を取得（バリエーション商品対応）
 * エラー 11006 の場合は get_items_by_item_group にフォールバック
 *
 * @param {string} spreadsheetId
 * @param {string} itemId
 * @returns {Object} eBay item オブジェクト
 */
function getItemForListing(spreadsheetId, itemId) {
  const token  = getOAuthTokenForListing(spreadsheetId);
  const apiUrl = 'https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id'
               + '?legacy_item_id=' + itemId + '&fieldgroups=PRODUCT';

  const response = UrlFetchApp.fetch(apiUrl, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    },
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const body       = response.getContentText();

  if (statusCode === 200) {
    Logger.log('[getItemForListing] 取得成功: itemId=' + itemId);
    return JSON.parse(body);
  }

  // エラー 11006: バリエーション商品 → item_group にフォールバック
  try {
    const errorData = JSON.parse(body);
    if (errorData.errors && errorData.errors.length > 0) {
      const firstError = errorData.errors[0];
      if (Number(firstError.errorId) === 11006) {
        Logger.log('[getItemForListing] バリエーション商品を検出。item_group API で再取得。');
        if (firstError.parameters && Array.isArray(firstError.parameters)) {
          const groupParam = firstError.parameters.find(function(p) { return p.name === 'itemGroupHref'; });
          if (groupParam && groupParam.value) {
            const m = groupParam.value.match(/item_group_id=(\d+)/);
            if (m && m[1]) return getItemGroupForListing(m[1], token);
          }
        }
      }
    }
  } catch (parseErr) {}

  if (statusCode === 404) throw new Error('商品が見つかりません。URLを確認してください。');
  if (statusCode === 401 || statusCode === 403) {
    throw new Error('eBay API認証に失敗しました。ツール設定の App ID / Cert ID / USER_TOKEN を確認してください。');
  }
  throw new Error('eBay API エラー (HTTP ' + statusCode + '): ' + body.substring(0, 200));
}

/**
 * アイテムグループAPIで最初のバリエーション商品を取得
 *
 * @param {string} itemGroupId
 * @param {string} token
 * @returns {Object} eBay item オブジェクト（最初のバリエーション）
 */
function getItemGroupForListing(itemGroupId, token) {
  const apiUrl = 'https://api.ebay.com/buy/browse/v1/item/get_items_by_item_group'
               + '?item_group_id=' + itemGroupId;

  const response = UrlFetchApp.fetch(apiUrl, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('アイテムグループAPI エラー (HTTP ' + response.getResponseCode() + ')');
  }

  const data = JSON.parse(response.getContentText());
  if (!data.items || data.items.length === 0) {
    throw new Error('アイテムグループにバリエーションが見つかりません: ' + itemGroupId);
  }

  const firstItem = data.items[0];
  firstItem._isItemGroup    = true;
  firstItem._itemGroupId    = itemGroupId;
  firstItem._variationCount = data.items.length;
  Logger.log('[getItemGroupForListing] バリエーション商品取得: ' + firstItem.title);
  return firstItem;
}

// ─────────────────────────────────────────────────────────────────────────────
// eBay アイテム情報抽出ユーティリティ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * eBay URLから商品IDを抽出
 * @param {string} url
 * @returns {string|null}
 */
function extractItemIdForListing(url) {
  if (!url || typeof url !== 'string') return null;
  const patterns = [
    /\/itm\/(\d+)/,
    /\/itm\/[^\/]+\/(\d+)/,
    /item=(\d+)/
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = url.match(patterns[i]);
    if (m && m[1]) return m[1];
  }
  Logger.log('[extractItemIdForListing] 商品ID抽出失敗: ' + url);
  return null;
}

/**
 * eBay item オブジェクトからカテゴリIDを取得
 * @param {Object} item
 * @returns {string}
 */
function extractCategoryIdFromItem(item) {
  return String(item.categoryId || '');
}

/**
 * eBay item オブジェクトからカテゴリ名（末尾セグメント）を取得
 * @param {Object} item
 * @returns {string}
 */
function extractCategoryNameFromItem(item) {
  if (!item.categoryPath) return '';
  const parts = item.categoryPath.split(' > ');
  return parts[parts.length - 1] || '';
}

/**
 * eBay item からアイテムスペシフィックスを抽出
 * localizedAspects + Brand / MPN / UPC / EAN / GTIN
 *
 * @param {Object} item
 * @returns {Object} {aspectName: value}
 */
function extractItemSpecificsFromItem(item) {
  const specifics = {};

  if (item.localizedAspects && Array.isArray(item.localizedAspects)) {
    item.localizedAspects.forEach(function(aspect) {
      if (aspect.name && aspect.value) {
        specifics[aspect.name] = aspect.value;
      }
    });
  }

  if (item.brand)  specifics['Brand'] = item.brand;
  if (item.mpn)    specifics['MPN']   = item.mpn;
  if (item.upc)    specifics['UPC']   = item.upc;
  if (item.ean && !specifics['UPC'])  specifics['EAN'] = item.ean;
  if (item.gtin && Array.isArray(item.gtin) && item.gtin.length > 0 && !specifics['UPC']) {
    specifics['UPC'] = item.gtin[0];
  }

  Logger.log('[extractItemSpecificsFromItem] ' + Object.keys(specifics).length + '件');
  return specifics;
}

