/**
 * VerifyListingTest.gs
 *
 * eBay API VerifyAddFixedPriceItem のテスト関数
 * 出品前に商品情報の検証を行います
 */

/**
 * 出品データを検証する関数
 *
 * @param {Object} params - 出品パラメータ
 * @returns {Object} 検証結果
 */
function verifyListing(params) {
  try {
    const config = getConfig();
    const token = getAccessToken();

    if (!token) {
      throw new Error('認証トークンが取得できません。先に認証を完了してください。');
    }

    // VerifyAddFixedPriceItem エンドポイント
    // Trading API を使用（Sandbox環境）
    const apiUrl = config.EBAY_ENVIRONMENT === 'PRODUCTION'
      ? 'https://api.ebay.com/ws/api.dll'
      : 'https://api.sandbox.ebay.com/ws/api.dll';

    // XML リクエストを構築
    const xmlRequest = buildVerifyAddFixedPriceItemXML(params);

    const options = {
      method: 'post',
      contentType: 'text/xml',
      headers: {
        'X-EBAY-API-SITEID': '0', // US site
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'VerifyAddFixedPriceItem',
        'X-EBAY-API-IAF-TOKEN': token
      },
      payload: xmlRequest,
      muteHttpExceptions: true
    };

    Logger.log('VerifyAddFixedPriceItem リクエスト送信: ' + apiUrl);
    Logger.log('リクエストXML: ' + xmlRequest);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseText = response.getContentText();

    Logger.log('レスポンス: ' + responseText);

    // XML レスポンスを解析
    const result = parseVerifyResponse(responseText);

    return result;
  } catch (error) {
    Logger.log('verifyListing エラー: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * VerifyAddFixedPriceItem 用の XML リクエストを構築
 *
 * @param {Object} params - 出品パラメータ
 * @returns {string} XML リクエスト
 */
function buildVerifyAddFixedPriceItemXML(params) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${escapeXml(params.title)}</Title>
    <Description>${escapeXml(params.description)}</Description>
    <PrimaryCategory>
      <CategoryID>${params.categoryId}</CategoryID>
    </PrimaryCategory>
    <StartPrice>${params.price}</StartPrice>
    <ConditionID>${params.conditionId}</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PaymentMethods>PayPal</PaymentMethods>
    <PayPalEmailAddress>test@example.com</PayPalEmailAddress>
    <PictureDetails>
      <PictureURL>${params.imageUrl || 'https://i.ebayimg.com/images/g/default/s-l500.jpg'}</PictureURL>
    </PictureDetails>
    <PostalCode>95125</PostalCode>
    <Quantity>${params.quantity || 1}</Quantity>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <RefundOption>MoneyBack</RefundOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSPriority</ShippingService>
        <ShippingServiceCost>10.00</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <Site>US</Site>
  </Item>
</VerifyAddFixedPriceItemRequest>`;

  return xml;
}

/**
 * XML 特殊文字をエスケープ
 *
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
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
 * VerifyAddFixedPriceItem のレスポンスを解析
 *
 * @param {string} xmlResponse - XML レスポンス
 * @returns {Object} 解析結果
 */
function parseVerifyResponse(xmlResponse) {
  try {
    const doc = XmlService.parse(xmlResponse);
    const root = doc.getRootElement();
    const ns = XmlService.getNamespace('urn:ebay:apis:eBLBaseComponents');

    const ack = root.getChild('Ack', ns).getText();
    const success = (ack === 'Success' || ack === 'Warning');

    const result = {
      success: success,
      ack: ack,
      errors: [],
      warnings: []
    };

    // エラーを抽出
    const errors = root.getChildren('Errors', ns);
    for (const error of errors) {
      const severity = error.getChild('SeverityCode', ns).getText();
      const errorCode = error.getChild('ErrorCode', ns).getText();
      const shortMessage = error.getChild('ShortMessage', ns).getText();
      const longMessage = error.getChild('LongMessage', ns).getText();

      const errorObj = {
        severity: severity,
        code: errorCode,
        shortMessage: shortMessage,
        longMessage: longMessage
      };

      if (severity === 'Error') {
        result.errors.push(errorObj);
      } else if (severity === 'Warning') {
        result.warnings.push(errorObj);
      }
    }

    // ItemID を取得（成功時）
    const itemIdElement = root.getChild('ItemID', ns);
    if (itemIdElement) {
      result.itemId = itemIdElement.getText();
    }

    return result;
  } catch (error) {
    Logger.log('parseVerifyResponse エラー: ' + error.toString());
    return {
      success: false,
      error: 'レスポンスの解析に失敗しました: ' + error.message
    };
  }
}

/**
 * テスト用: サンプルデータで VerifyAddFixedPriceItem を実行
 */
function runVerifyTest() {
  Logger.log('=== VerifyAddFixedPriceItem テスト開始 ===');

  // サンプルデータ
  const testParams = {
    title: 'Test Item - iPhone 12 Pro 128GB Unlocked',
    description: 'This is a test listing for verification purposes only. Brand new iPhone 12 Pro with 128GB storage, factory unlocked.',
    categoryId: '9355', // Cell Phones & Smartphones
    price: '799.99',
    conditionId: '1000', // New
    quantity: 1,
    imageUrl: 'https://i.ebayimg.com/images/g/default/s-l500.jpg'
  };

  Logger.log('テストパラメータ: ' + JSON.stringify(testParams, null, 2));

  // 検証実行
  const result = verifyListing(testParams);

  Logger.log('=== 検証結果 ===');
  Logger.log('成功: ' + result.success);
  Logger.log('Ack: ' + result.ack);

  if (result.errors && result.errors.length > 0) {
    Logger.log('エラー数: ' + result.errors.length);
    result.errors.forEach((err, index) => {
      Logger.log(`エラー ${index + 1}:`);
      Logger.log('  コード: ' + err.code);
      Logger.log('  メッセージ: ' + err.shortMessage);
      Logger.log('  詳細: ' + err.longMessage);
    });
  }

  if (result.warnings && result.warnings.length > 0) {
    Logger.log('警告数: ' + result.warnings.length);
    result.warnings.forEach((warn, index) => {
      Logger.log(`警告 ${index + 1}:`);
      Logger.log('  コード: ' + warn.code);
      Logger.log('  メッセージ: ' + warn.shortMessage);
    });
  }

  if (result.itemId) {
    Logger.log('Item ID: ' + result.itemId);
  }

  Logger.log('=== テスト終了 ===');

  return result;
}

/**
 * テスト用: Condition ID のバリデーションテスト
 */
function testConditionValidation() {
  Logger.log('=== Condition ID バリデーションテスト ===');

  const testConditions = [
    { id: '1000', name: '新品・未使用' },
    { id: '1500', name: '未使用品（開封済み）' },
    { id: '3000', name: '目立った傷や汚れなし' },
    { id: '7000', name: 'ジャンク品（部品取り）' }
  ];

  testConditions.forEach(cond => {
    Logger.log(`\nテスト: ${cond.name} (ID: ${cond.id})`);

    const testParams = {
      title: `Test Item - Condition ${cond.id}`,
      description: `Test listing with condition ${cond.name}`,
      categoryId: '9355',
      price: '99.99',
      conditionId: cond.id,
      quantity: 1
    };

    const result = verifyListing(testParams);
    Logger.log('結果: ' + (result.success ? '成功' : '失敗'));

    if (!result.success && result.errors) {
      Logger.log('エラー: ' + result.errors[0].shortMessage);
    }
  });

  Logger.log('\n=== テスト終了 ===');
}
