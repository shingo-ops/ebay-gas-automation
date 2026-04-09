/**
 * GeminiTranslate.gs - Gemini 2.5 Flash-Lite による日本語コンディション自動生成
 * ebay-db 原本ブック専用
 */

var GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

/**
 * condition_ja_map シートの ja_display 空欄行を Gemini で自動補完
 * @returns {Object} { filled: number, failed: number }
 */
function fillMissingJaDisplay() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('condition_ja_map');
  if (!sheet) {
    throw new Error('condition_ja_map シートが見つかりません');
  }

  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY がスクリプトプロパティに設定されていません');
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colIdx = {};
  headers.forEach(function(h, i) { colIdx[h] = i; });

  var filled = 0;
  var failed = 0;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var jaDisplay = row[colIdx['ja_display']];

    if (jaDisplay) continue; // 既に入力済みはスキップ

    var conditionName    = row[colIdx['condition_name']];
    var conditionEnum    = row[colIdx['condition_enum']];
    var categoryDisplay  = row[colIdx['category_display']];

    try {
      var result = callGeminiForJaDisplay(apiKey, conditionName, conditionEnum, categoryDisplay);
      if (result.ja_display) {
        sheet.getRange(i + 1, colIdx['ja_display'] + 1).setValue(result.ja_display);
        if (result.ja_description) {
          sheet.getRange(i + 1, colIdx['ja_description'] + 1).setValue(result.ja_description);
        }
        filled++;
        Logger.log('ja_display 生成: condition_id=' + row[colIdx['condition_id']] + ' → ' + result.ja_display);
      } else {
        failed++;
        Logger.log('ja_display 生成失敗: condition_id=' + row[colIdx['condition_id']]);
      }
    } catch (e) {
      failed++;
      Logger.log('Gemini API エラー (condition_id=' + row[colIdx['condition_id']] + '): ' + e.toString());
    }

    // レート制限対策: 1秒待機
    Utilities.sleep(1000);
  }

  Logger.log('ja_display 補完完了: filled=' + filled + ', failed=' + failed);
  return { filled: filled, failed: failed };
}

/**
 * Gemini API を呼び出して ja_display と ja_description を生成
 * @param {string} apiKey
 * @param {string} conditionName - 英語デフォルト名
 * @param {string} conditionEnum - enum値
 * @param {string} categoryDisplay - カテゴリ固有表示名（ある場合）
 * @returns {Object} { ja_display: string, ja_description: string }
 */
function callGeminiForJaDisplay(apiKey, conditionName, conditionEnum, categoryDisplay) {
  var displayTarget = categoryDisplay || conditionName;
  var prompt = 'あなたはeBayの日本語出品サポートAIです。\n\n'
    + 'eBayコンディション「' + displayTarget + '」（enum: ' + conditionEnum + '）の\n'
    + '日本語表記を以下のJSON形式で返してください。\n'
    + 'メルカリ・ヤフオクの出品者が直感的に選択できる表現にしてください。\n\n'
    + '出力形式（JSONのみ）:\n'
    + '{"ja_display": "新品・未使用", "ja_description": "未開封・未使用の新品状態"}';

  var requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          ja_display:     { type: 'STRING' },
          ja_description: { type: 'STRING' }
        },
        required: ['ja_display', 'ja_description']
      }
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  var url = GEMINI_API_ENDPOINT + '?key=' + apiKey;
  var response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() !== 200) {
    throw new Error('Gemini API エラー: ' + response.getResponseCode() + ' ' + response.getContentText());
  }

  var json = JSON.parse(response.getContentText());
  var text = json.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}
