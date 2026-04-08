/**
 * eBay利益計算ツール - eBay API連携
 *
 * eBay Browse API を使用して商品情報を取得
 */

/**
 * eBay URLから商品IDを抽出
 *
 * @param {string} url eBay商品URL
 * @returns {string} 商品ID（Item ID）
 */
function extractItemIdFromUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('有効なURLを入力してください');
  }

  // eBay URLのパターン
  // 例: https://www.ebay.com/itm/123456789012
  // 例: https://www.ebay.com/itm/Product-Name/123456789012
  const patterns = [
    /\/itm\/(\d+)/,           // /itm/123456789012
    /\/itm\/[^\/]+\/(\d+)/,   // /itm/product-name/123456789012
    /item=(\d+)/              // ?item=123456789012
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = url.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error('URLから商品IDを抽出できませんでした: ' + url);
}

/**
 * eBay Browse API で商品情報を取得
 *
 * @param {string} itemId 商品ID
 * @returns {Object} 商品情報
 */
function getItemFromEbay(itemId) {
  try {
    const config = getEbayConfig();
    const token = getOAuthToken();

    // get_item_by_legacy_id エンドポイントを使用（成功実装と同じ）
    const apiUrl = config.getBrowseApiUrl() +
                   '/item/get_item_by_legacy_id' +
                   '?legacy_item_id=' + itemId +
                   '&fieldgroups=PRODUCT';

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      muteHttpExceptions: true
    };

    Logger.log('eBay API呼び出し: ' + apiUrl);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log('APIエラー: ' + statusCode + ' - ' + responseText);

      // エラー詳細をパース
      try {
        const errorData = JSON.parse(responseText);

        // エラーコード11006: バリエーション商品（アイテムグループ）
        if (errorData.errors && errorData.errors.length > 0) {
          const firstError = errorData.errors[0];
          const errorId = Number(firstError.errorId);

          if (errorId === 11006) {
            Logger.log('バリエーション商品を検出。アイテムグループAPIで再取得します。');

            // parametersからitem_group_idを抽出
            if (firstError.parameters && Array.isArray(firstError.parameters)) {
              const itemGroupParam = firstError.parameters.find(function(p) {
                return p.name === 'itemGroupHref';
              });

              if (itemGroupParam && itemGroupParam.value) {
                const match = itemGroupParam.value.match(/item_group_id=(\d+)/);
                if (match && match[1]) {
                  const itemGroupId = match[1];
                  Logger.log('アイテムグループID: ' + itemGroupId);
                  return getItemGroupData(itemGroupId);
                }
              }
            }
          }
        }

        // ステータスコード別にユーザー向けメッセージを生成
        let userMessage = 'eBay商品情報の取得に失敗しました。\n\n';
        if (statusCode === 404) {
          userMessage += '指定された商品が見つかりません。\nItem URLを確認してください。';
        } else if (statusCode === 401 || statusCode === 403) {
          userMessage += 'eBay APIの認証に失敗しました。\nツール設定シートのApp ID、Cert IDを確認してください。';
        } else {
          userMessage += 'eBay APIでエラーが発生しました。\n時間をおいて再度お試しください。';
        }
        throw new Error(userMessage);

      } catch (parseError) {
        // レスポンスのパースに失敗した場合もユーザー向けメッセージ
        let userMessage = 'eBay商品情報の取得に失敗しました。\n\n';
        if (statusCode === 404) {
          userMessage += '指定された商品が見つかりません。\nItem URLを確認してください。';
        } else if (statusCode === 401 || statusCode === 403) {
          userMessage += 'eBay APIの認証に失敗しました。\nツール設定シートのApp ID、Cert IDを確認してください。';
        } else {
          userMessage += 'eBay APIでエラーが発生しました。\n時間をおいて再度お試しください。';
        }
        throw new Error(userMessage);
      }
    }

    const item = JSON.parse(responseText);
    Logger.log('商品情報を取得しました: ' + item.title);

    return item;

  } catch (error) {
    Logger.log('getItemFromEbayエラー: ' + error.toString());
    throw error;
  }
}

/**
 * アイテムグループ（バリエーション商品）のデータを取得
 *
 * @param {string} itemGroupId アイテムグループID
 * @returns {Object} 商品情報（最初のバリエーション）
 */
function getItemGroupData(itemGroupId) {
  try {
    const config = getEbayConfig();
    const token = getOAuthToken();

    // fieldgroups=PRODUCTは非サポート
    // カテゴリ情報（categoryId, categoryPath）はデフォルトで含まれる
    const apiUrl = config.getBrowseApiUrl() +
                   '/item/get_items_by_item_group' +
                   '?item_group_id=' + itemGroupId;

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      muteHttpExceptions: true
    };

    Logger.log('Item Group API呼び出し: ' + apiUrl);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      let userMessage = 'eBayバリエーション商品の取得に失敗しました。\n\n';
      if (statusCode === 404) {
        userMessage += 'バリエーション商品が見つかりません。\nItem URLを確認してください。';
      } else if (statusCode === 401 || statusCode === 403) {
        userMessage += 'eBay APIの認証に失敗しました。\nツール設定シートのApp ID、Cert IDを確認してください。';
      } else {
        userMessage += 'eBay APIでエラーが発生しました。\n時間をおいて再度お試しください。';
      }
      throw new Error(userMessage);
    }

    const data = JSON.parse(responseText);

    Logger.log('バリエーション商品: ' + (data.items ? data.items.length : 0) + '個のバリエーション');

    // 最初のバリエーション（代表商品）を返す
    if (data.items && data.items.length > 0) {
      const firstItem = data.items[0];

      // アイテムグループ情報を追加
      firstItem._isItemGroup = true;
      firstItem._itemGroupId = itemGroupId;
      firstItem._variationCount = data.items.length;

      Logger.log('アイテムグループ商品を取得: ' + firstItem.title);

      return firstItem;
    }

    throw new Error('アイテムグループにバリエーションが見つかりませんでした');

  } catch (error) {
    Logger.log('getItemGroupDataエラー: ' + error.toString());
    throw error;
  }
}

/**
 * 商品情報からカテゴリ情報を抽出
 *
 * @param {Object} item eBay商品情報
 * @returns {Object} { categoryId: string, categoryName: string }
 */
function extractCategoryInfo(item) {
  try {
    if (!item || !item.categoryPath) {
      throw new Error('カテゴリ情報が見つかりません');
    }

    // カテゴリパスから最下層のカテゴリを取得
    // 例: "Collectibles|Trading Cards|Sports Trading Cards"
    const categoryPath = item.categoryPath;
    const categories = categoryPath.split('|');
    const categoryName = categories[categories.length - 1].trim();

    // カテゴリIDを取得
    const categoryId = item.categoryId || '';

    return {
      categoryId: categoryId,
      categoryName: categoryName,
      fullPath: categoryPath
    };

  } catch (error) {
    Logger.log('extractCategoryInfoエラー: ' + error.toString());
    throw error;
  }
}

/**
 * 商品情報からアイテムスペシフィックスを抽出
 *
 * @param {Object} item eBay商品情報
 * @returns {Object} アイテムスペシフィックス（キー: 値の形式）
 */
function extractItemSpecifics(item) {
  try {
    const specifics = {};

    // localizedAspectsから取得
    if (item.localizedAspects && Array.isArray(item.localizedAspects)) {
      item.localizedAspects.forEach(function(aspect) {
        const name = aspect.name;
        const value = aspect.value;

        if (name && value) {
          specifics[name] = value;
        }
      });
    }

    // よく使われるフィールドを追加
    if (item.brand) {
      specifics['Brand'] = item.brand;
    }

    if (item.mpn) {
      specifics['MPN'] = item.mpn;
    }

    if (item.condition) {
      specifics['Condition'] = item.condition;
    }

    // UPC/EAN/GTIN（Product Identifiers）を追加
    // gtin配列から取得（UPC、EAN、ISBNなどが含まれる）
    if (item.gtin && Array.isArray(item.gtin) && item.gtin.length > 0) {
      specifics['UPC'] = item.gtin[0]; // 最初のGTINをUPCとして使用
    }

    // upcフィールドが直接存在する場合
    if (item.upc) {
      specifics['UPC'] = item.upc;
    }

    // eanフィールドが存在する場合
    if (item.ean && !specifics['UPC']) {
      specifics['EAN'] = item.ean;
    }

    Logger.log('Item Specificsを抽出: ' + Object.keys(specifics).length + '件');

    return specifics;

  } catch (error) {
    Logger.log('extractItemSpecificsエラー: ' + error.toString());
    return {};
  }
}

/**
 * URLから商品の全情報を取得
 *
 * @param {string} url eBay商品URL
 * @returns {Object} { item, category, specifics }
 */
function getProductInfoFromUrl(url) {
  try {
    // URLから商品IDを抽出
    const itemId = extractItemIdFromUrl(url);
    Logger.log('商品ID: ' + itemId);

    // eBay APIで商品情報を取得
    const item = getItemFromEbay(itemId);

    // カテゴリ情報を抽出
    const category = extractCategoryInfo(item);

    // アイテムスペシフィックスを抽出
    const specifics = extractItemSpecifics(item);

    // 画像URLを抽出
    const imageUrl = item.image && item.image.imageUrl ? item.image.imageUrl : '';

    return {
      item: item,
      category: category,
      specifics: specifics,
      title: item.title || '',
      itemId: itemId,
      imageUrl: imageUrl
    };

  } catch (error) {
    Logger.log('getProductInfoFromUrlエラー: ' + error.toString());
    throw error;
  }
}

/**
 * カテゴリマスタからカテゴリ情報を取得
 *
 * @param {string} categoryId カテゴリID
 * @returns {Object} カテゴリ情報（requiredAspects, recommendedAspects, optionalAspects）
 */
function getCategoryMasterData(categoryId) {
  try {
    // ツール設定からカテゴリマスタブックIDを取得
    const config = getEbayConfig();
    const categoryMasterSpreadsheetId = config.categoryMasterSpreadsheetId;

    if (!categoryMasterSpreadsheetId) {
      Logger.log('カテゴリマスタブックIDが設定されていません');
      return null;
    }

    // 外部ブックを開く
    const categoryMasterSs = SpreadsheetApp.openById(categoryMasterSpreadsheetId);
    const sheet = categoryMasterSs.getSheetByName(SHEET_NAMES.CATEGORY_MASTER);

    if (!sheet) {
      Logger.log('カテゴリマスタシートが見つかりません');
      return null;
    }

    // カテゴリIDで検索（A列）
    const lastRow = sheet.getLastRow();
    const categoryIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    let targetRow = -1;
    for (let i = 0; i < categoryIds.length; i++) {
      // カテゴリIDは文字列で保存されている可能性があるため、文字列比較
      if (categoryIds[i][0].toString() === categoryId.toString()) {
        targetRow = i + 2; // ヘッダー行を考慮
        break;
      }
    }

    if (targetRow === -1) {
      Logger.log('カテゴリID ' + categoryId + ' がカテゴリマスタに見つかりません');
      return null;
    }

    // カテゴリデータを取得
    const rowData = sheet.getRange(targetRow, 1, 1, 7).getValues()[0];

    const categoryData = {
      categoryId: rowData[0],
      categoryName: rowData[1],
      requiredAspects: JSON.parse(rowData[3] || '[]'),
      recommendedAspects: JSON.parse(rowData[4] || '[]'),
      optionalAspects: JSON.parse(rowData[5] || '[]')
    };

    Logger.log('カテゴリマスタデータ取得: ' + categoryData.categoryName);
    Logger.log('必須スペック: ' + categoryData.requiredAspects.length + '件');
    Logger.log('推奨スペック: ' + categoryData.recommendedAspects.length + '件');

    return categoryData;

  } catch (error) {
    Logger.log('getCategoryMasterDataエラー: ' + error.toString());
    return null;
  }
}

/**
 * Item Specificsを優先度順にソート
 * 優先度: 必須 > 推奨 > その他、かつ値が埋まっている > 空白
 * 30個に満たない場合、カテゴリマスタから不足分を充填（必須 > 推奨の順）
 *
 * @param {Object} specifics アイテムスペシフィックス（キー: 値の形式）
 * @param {string} categoryId カテゴリID
 * @returns {Array} ソート済みスペック配列 [{name, value, priority, color}, ...]（最大30件）
 */
function sortItemSpecificsByPriority(specifics, categoryId) {
  try {
    // カテゴリマスタから必須・推奨スペックを取得
    const categoryData = getCategoryMasterData(categoryId);

    const requiredSpecs = categoryData ? categoryData.requiredAspects : [];
    const recommendedSpecs = categoryData ? categoryData.recommendedAspects : [];
    const optionalSpecs = categoryData ? categoryData.optionalAspects : [];

    // Brand, UPC, EAN, MPN, Conditionは専用列に転記済みなので除外
    const excludeSpecs = ['Brand', 'UPC', 'EAN', 'MPN', 'Condition'];

    // スペックを配列に変換し、優先度と色を付与
    const specArray = [];
    const usedSpecNames = []; // 使用済みスペック名を記録

    Object.keys(specifics).forEach(function(key) {
      if (excludeSpecs.indexOf(key) !== -1) {
        return; // 除外スペックはスキップ
      }

      const value = specifics[key];
      const hasValue = value && value.toString().trim() !== '';

      let priority = 3; // その他
      let color = SPEC_COLORS.OPTIONAL;

      if (requiredSpecs.indexOf(key) !== -1) {
        priority = 1; // 必須
        color = SPEC_COLORS.REQUIRED;
      } else if (recommendedSpecs.indexOf(key) !== -1) {
        priority = 2; // 推奨
        color = SPEC_COLORS.RECOMMENDED;
      }

      specArray.push({
        name: key,
        value: value,
        priority: priority,
        hasValue: hasValue,
        color: color
      });

      usedSpecNames.push(key);
    });

    // ソート: 優先度 → 値の有無
    specArray.sort(function(a, b) {
      // 第1優先: 優先度（昇順: 必須=1, 推奨=2, その他=3）
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // 第2優先: 値の有無（降順: 値あり=true > 値なし=false）
      if (a.hasValue !== b.hasValue) {
        return a.hasValue ? -1 : 1;
      }

      // 第3優先: 名前の辞書順
      return a.name.localeCompare(b.name);
    });

    Logger.log('既存のItem Specifics: ' + specArray.length + '件');

    // 30個に満たない場合、カテゴリマスタから不足分を充填
    if (specArray.length < 30) {
      const remaining = 30 - specArray.length;
      Logger.log('不足分を充填: ' + remaining + '件');

      // 充填候補を優先度順に準備（必須 > 推奨 > その他）
      const fillCandidates = [];

      // 必須スペック（未使用のもの）
      requiredSpecs.forEach(function(specName) {
        if (usedSpecNames.indexOf(specName) === -1 && excludeSpecs.indexOf(specName) === -1) {
          fillCandidates.push({
            name: specName,
            value: '',
            priority: 1,
            hasValue: false,
            color: SPEC_COLORS.REQUIRED
          });
        }
      });

      // 推奨スペック（未使用のもの）
      recommendedSpecs.forEach(function(specName) {
        if (usedSpecNames.indexOf(specName) === -1 && excludeSpecs.indexOf(specName) === -1) {
          fillCandidates.push({
            name: specName,
            value: '',
            priority: 2,
            hasValue: false,
            color: SPEC_COLORS.RECOMMENDED
          });
        }
      });

      // その他スペック（未使用のもの）
      optionalSpecs.forEach(function(specName) {
        if (usedSpecNames.indexOf(specName) === -1 && excludeSpecs.indexOf(specName) === -1) {
          fillCandidates.push({
            name: specName,
            value: '',
            priority: 3,
            hasValue: false,
            color: SPEC_COLORS.OPTIONAL
          });
        }
      });

      // 不足分を追加（最大30件まで）
      for (let i = 0; i < remaining && i < fillCandidates.length; i++) {
        specArray.push(fillCandidates[i]);
        Logger.log('充填: ' + fillCandidates[i].name + ' (優先度: ' + fillCandidates[i].priority + ')');
      }
    }

    Logger.log('最終Item Specifics件数: ' + specArray.length + '件');

    return specArray;

  } catch (error) {
    Logger.log('sortItemSpecificsByPriorityエラー: ' + error.toString());
    return [];
  }
}

