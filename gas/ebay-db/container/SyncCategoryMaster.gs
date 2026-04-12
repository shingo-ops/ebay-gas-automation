/**
 * SyncCategoryMaster.gs
 * このブック（category_master原本）から参照用ブックへカテゴリマスタを転記
 *
 * ソース: このスクリプトがバインドされているスプレッドシート（category_master原本）
 * ターゲット: スクリプトプロパティ SERVICE_BOOK_ID で指定された参照用ブック
 */

const SYNC_SHEET_NAMES = [
  'category_master_EBAY_US',
  'category_master_EBAY_GB',
  'category_master_EBAY_DE',
  'category_master_EBAY_AU',
  'category_master_EBAY_JP',
  'condition_ja_map'
];

/**
 * category_master原本から参照用ブックへ全シートを転記
 */
function syncCategoryMasterSheets() {
  const targetId = PropertiesService.getScriptProperties().getProperty('SERVICE_BOOK_ID');
  if (!targetId) {
    throw new Error('スクリプトプロパティ SERVICE_BOOK_ID が未設定です');
  }

  const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
  const targetSs = SpreadsheetApp.openById(targetId);

  const results = [];

  SYNC_SHEET_NAMES.forEach(function(sheetName) {
    const sourceSheet = sourceSs.getSheetByName(sheetName);

    if (!sourceSheet) {
      Logger.log('スキップ: ' + sheetName + ' がソースブックに存在しません');
      results.push(sheetName + ': ソースなし（スキップ）');
      return;
    }

    const lastRow = sourceSheet.getLastRow();
    const lastCol = sourceSheet.getLastColumn();

    if (lastRow === 0) {
      Logger.log('スキップ: ' + sheetName + ' にデータがありません');
      results.push(sheetName + ': データなし（スキップ）');
      return;
    }

    const data = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();

    let targetSheet = targetSs.getSheetByName(sheetName);
    if (!targetSheet) {
      targetSheet = targetSs.insertSheet(sheetName);
    } else {
      targetSheet.clearContents();
    }

    targetSheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    const rowCount = lastRow - 1;
    Logger.log('転記完了: ' + sheetName + ' (' + rowCount + '件)');
    results.push(sheetName + ': ' + rowCount + '件');
  });

  Logger.log('=== 転記完了 ===\n' + results.join('\n'));
}

/**
 * condition_ja_map シートを確定CSV データで全上書きしてから参照用ブックへ同期
 *
 * CI フロー: clasp push → clasp run importConditionJaMap
 * → 原本の condition_ja_map を更新 → syncCategoryMasterSheets で参照用へ転記
 */
function importConditionJaMap() {
  const HEADERS = ['condition_group', 'condition_ids_json', 'ja_map_json', 'en_map_json', 'category_count', 'example_categories', 'last_synced'];
  const ROWS = [
    ['A', '[1000, 1500, 2500, 3000, 7000]',          '{"1000": "新品/未使用", "1500": "未使用に近い", "2500": "整備済み", "3000": "中古品", "7000": "ジャンク品"}',                                                                                                                                                                         '{"1000": "New", "1500": "New other (see details)", "2500": "Seller refurbished", "3000": "Used", "7000": "For parts or not working"}',                                                                                                                                                                                   3920, 'Sideboards & Buffets, Trunks & Chests, Vanities & Vanity Tables', '2026-04-12'],
    ['B', '[1000, 1500, 1750, 3000]',                 '{"1000": "新品/未使用", "1500": "未使用に近い", "1750": "新品/未使用（訳あり）", "3000": "中古品"}',                                                                                                                                                                                     '{"1000": "New", "1500": "New other (see details)", "1750": "New with defects", "3000": "Used"}',                                                                                                                                                                                                                          722,  'Tapestries, Masks & Eye Masks, Garment Bags', '2026-04-12'],
    ['C', '[1000, 3000]',                             '{"1000": "新品/未使用", "3000": "中古品"}',                                                                                                                                                                                                                                              '{"1000": "New", "3000": "Used"}',                                                                                                                                                                                                                                                                                         4434, 'Television Sets, Brass, Cast Iron', '2026-04-12'],
    ['D', '[1000, 1500, 3000, 7000]',                 '{"1000": "新品/未使用", "1500": "未使用に近い", "3000": "中古品", "7000": "ジャンク品"}',                                                                                                                                                                                                '{"1000": "New", "1500": "New other (see details)", "3000": "Used", "7000": "For parts or not working"}',                                                                                                                                                                                                                  2439, 'Air Compressor Accessory Kits, Air Hose Reels, Hand Tool Accessories', '2026-04-12'],
    ['E', '[1000, 1500, 1750, 2500, 2750, 3000, 4000, 5000, 6000, 7000]', '{"1000": "新品/未使用", "1500": "未使用に近い", "1750": "新品/未使用（訳あり）", "2500": "整備済み", "2750": "目立った傷や汚れなし", "3000": "やや傷や汚れあり", "4000": "傷や汚れあり", "5000": "傷や汚れあり（多）", "6000": "全体的に状態が悪い", "7000": "ジャンク品"}', '{"1000": "New with tags", "1500": "New without tags", "1750": "New with defects", "2500": "Seller refurbished", "2750": "Very Good", "3000": "Good", "4000": "Acceptable", "5000": "For parts or not working", "6000": "Not working", "7000": "For parts or not working"}', 2052, 'Apparel, Photos, Other Rock & Pop Artists C', '2026-04-12'],
    ['F', '[1000, 3000, 7000]',                       '{"1000": "新品/未使用", "3000": "中古品", "7000": "ジャンク品"}',                                                                                                                                                                                                                        '{"1000": "New", "3000": "Used", "7000": "For parts or not working"}',                                                                                                                                                                                                                                                    32,   '1970-Now, Tamagotchi, Furby', '2026-04-12'],
    ['G', '[1000, 2750, 4000, 5000, 6000]',           '{"1000": "新品/未使用", "2750": "未使用に近い", "4000": "目立った傷や汚れなし", "5000": "やや傷や汚れあり", "6000": "全体的に状態が悪い"}',                                                                                                                                              '{"1000": "New", "2750": "Like New", "4000": "Very Good", "5000": "Good", "6000": "Acceptable"}',                                                                                                                                                                                                                          463,  'Magazines, Lithographs, Posters & Prints, Ticket Stubs', '2026-04-12'],
    ['H', '[1000, 1500, 3000]',                       '{"1000": "新品/未使用", "1500": "未使用に近い", "3000": "中古品"}',                                                                                                                                                                                                                      '{"1000": "New", "1500": "New other (see details)", "3000": "Used"}',                                                                                                                                                                                                                                                      183,  'Cream & Sugar, Butter Dishes, Gravy Boats', '2026-04-12'],
    ['I', '[1000]',                                   '{"1000": "新品/未使用"}',                                                                                                                                                                                                                                                               '{"1000": "New"}',                                                                                                                                                                                                                                                                                                         332,  "Women's Razor Blades, Women's Razors, Water", '2026-04-10'],
    ['J', '[1000, 1500]',                             '{"1000": "新品/未使用", "1500": "未使用に近い"}',                                                                                                                                                                                                                                        '{"1000": "New", "1500": "New other (see details)"}',                                                                                                                                                                                                                                                                      96,   'Gel Nail Polish, Treatments, Oils & Protectors, BB, CC & Alphabet Cream', '2026-04-10'],
    ['K', '[1000, 1500, 1750, 2990, 3000, 3010]',     '{"1000": "新品・タグ付き", "1500": "未使用に近い", "1750": "新品/未使用（訳あり）", "2990": "目立った傷や汚れなし", "3000": "やや傷や汚れあり", "3010": "傷や汚れあり"}',                                                                                                               '{"1000": "New with tags", "1500": "New without tags", "1750": "New with defects", "2990": "Very Good", "3000": "Good", "3010": "Acceptable"}',                                                                                                                                                                            384,  'Ballet, Belt Buckles, Dance Accessories', '2026-04-12'],
    ['L', '[1000, 1500, 1750, 2500, 3000]',           '{"1000": "新品/未使用", "1500": "未使用に近い", "1750": "新品/未使用（訳あり）", "2500": "整備済み", "3000": "目立った傷や汚れなし"}',                                                                                                                                                  '{"1000": "New", "1500": "New other (see details)", "1750": "New with defects", "2500": "Seller refurbished", "3000": "Used"}',                                                                                                                                                                                            11,   'Wristwatch Bands, Watch Winders, Boxes & Cases', '2026-04-10'],
    ['M', '[1000, 1500, 1750, 2500, 2990, 3000, 3010, 7000]', '{"1000": "新品・タグ付き", "1500": "未使用に近い", "1750": "新品/未使用（訳あり）", "2500": "整備済み", "2990": "目立った傷や汚れなし", "3000": "やや傷や汚れあり", "3010": "傷や汚れあり", "7000": "ジャンク品"}',                                                            '{"1000": "New with tags", "1500": "New without tags", "1750": "New with defects", "2500": "Seller refurbished", "2990": "Very Good", "3000": "Good", "3010": "Acceptable", "7000": "For parts or not working"}',                                                                                                          3,    'Other Watches, Pocket Watches, Wristwatches', '2026-04-12'],
    ['N', '[1000, 1500, 1750]',                       '{"1000": "新品/未使用", "1500": "未使用に近い", "1750": "新品/未使用（訳あり）"}',                                                                                                                                                                                                       '{"1000": "New with tags", "1500": "New without tags", "1750": "New with defects"}',                                                                                                                                                                                                                                       19,   'Underwear, Groin Guards & Cups, Groin Guards & Cups', '2026-04-10'],
    ['O', '[2750, 3000, 4000]',                       '{"2750": "鑑定済み（Graded）", "3000": "中古", "4000": "未鑑定（Ungraded）"}',                                                                                                                                                                                                           '{"2750": "Graded", "3000": "Used", "4000": "Ungraded"}',                                                                                                                                                                                                                                                                  6,    'Trading Card Singles, CCG Individual Cards, Trading Card Singles', '2026-04-10'],
    ['P', '[1000, 1500, 1750, 2500, 3000, 7000]',     '{"1000": "新品/未使用", "1500": "未使用に近い", "1750": "新品/未使用（訳あり）", "2500": "整備済み", "3000": "目立った傷や汚れなし", "7000": "ジャンク品"}',                                                                                                                             '{"1000": "New", "1500": "New other (see details)", "1750": "New with defects", "2500": "Seller refurbished", "3000": "Used", "7000": "For parts or not working"}',                                                                                                                                                        3,    'Other Watch Parts, Watches for Parts, Movements', '2026-04-10'],
    ['Q', '[1000, 1500, 2500, 3000, 3010, 7000]',     '{"1000": "新品/未使用", "1500": "未使用に近い", "2500": "整備済み", "3000": "目立った傷や汚れなし", "3010": "やや傷や汚れあり", "7000": "ジャンク品"}',                                                                                                                                 '{"1000": "New", "1500": "New other (see details)", "2500": "Seller refurbished", "3000": "Good", "3010": "Acceptable", "7000": "For parts or not working"}',                                                                                                                                                              1,    'Test Category 4', '2026-04-12'],
    ['R', '[1000, 1750, 3000, 3010, 7000]',           '{"1000": "新品/未使用", "1750": "新品/未使用（訳あり）", "3000": "目立った傷や汚れなし", "3010": "やや傷や汚れあり", "7000": "ジャンク品"}',                                                                                                                                            '{"1000": "New", "1750": "New with defects", "3000": "Good", "3010": "Acceptable", "7000": "For parts or not working"}',                                                                                                                                                                                                   1,    'Test Category 3', '2026-04-12'],
    ['S', '[1000, 1500, 2500]',                       '{"1000": "新品/未使用", "1500": "未使用に近い", "2500": "整備済み"}',                                                                                                                                                                                                                    '{"1000": "New", "1500": "New other (see details)", "2500": "Seller refurbished"}',                                                                                                                                                                                                                                        1,    'Air & Water Flossers', '2026-04-10'],
    ['T', '[1000, 1500, 7000]',                       '{"1000": "新品/未使用", "1500": "未使用に近い", "7000": "ジャンク品"}',                                                                                                                                                                                                                  '{"1000": "New", "1500": "New other (see details)", "7000": "For parts or not working"}',                                                                                                                                                                                                                                  1,    'Electric Toothbrushes', '2026-04-10'],
    ['U', '[1000, 1500, 2500, 3000]',                 '{"1000": "新品/未使用", "1500": "未使用に近い", "2500": "整備済み", "3000": "目立った傷や汚れなし"}',                                                                                                                                                                                    '{"1000": "New", "1500": "New other (see details)", "2500": "Seller refurbished", "3000": "Used"}',                                                                                                                                                                                                                        1,    'Category 20', '2026-04-10'],
    ['V', '[1000, 3000, 4000, 5000, 6000]',           '{"1000": "新品/未使用", "3000": "目立った傷や汚れなし", "4000": "やや傷や汚れあり", "5000": "傷や汚れあり", "6000": "全体的に状態が悪い"}',                                                                                                                                             '{"1000": "New", "3000": "Very Good", "4000": "Good", "5000": "Acceptable", "6000": "For parts or not working"}',                                                                                                                                                                                                          1,    'Vintage Manuals & Guides', '2026-04-10'],
    ['W', '[1000, 1500, 1750, 2750, 3000, 4000, 5000, 6000, 7000]', '{"1000": "新品/未使用", "1500": "未使用に近い", "1750": "新品/未使用（訳あり）", "2750": "目立った傷や汚れなし", "3000": "やや傷や汚れあり", "4000": "傷や汚れあり", "5000": "傷や汚れあり（多）", "6000": "全体的に状態が悪い", "7000": "ジャンク品"}',                  '{"1000": "New", "1500": "New other (see details)", "1750": "New with defects", "2750": "Very Good", "3000": "Good", "4000": "Acceptable", "5000": "For parts or not working", "6000": "Not working", "7000": "For parts or not working"}',                                                                                 1,    'Every Other Thing', '2026-04-12'],
    ['X', '[1000, 2750, 4000]',                       '{"1000": "新品/未使用", "2750": "鑑定済み（Graded）", "4000": "未鑑定（Ungraded）"}',                                                                                                                                                                                                    '{"1000": "New", "2750": "Graded", "4000": "Ungraded"}',                                                                                                                                                                                                                                                                   1,    'Category 2', '2026-04-10'],
    ['Y', '[1000, 3000, 4000]',                       '{"1000": "新品/未使用", "3000": "目立った傷や汚れなし", "4000": "やや傷や汚れあり"}',                                                                                                                                                                                                    '{"1000": "New", "3000": "Very Good", "4000": "Good"}',                                                                                                                                                                                                                                                                    3,    'Attributes3, Attributes4, Attributes5', '2026-04-10'],
    ['Z', '[2750, 4000]',                             '{"2750": "鑑定済み（Graded）", "4000": "未鑑定（Ungraded）"}',                                                                                                                                                                                                                           '{"2750": "Graded", "4000": "Ungraded"}',                                                                                                                                                                                                                                                                                  1,    'Attributes6_Test', '2026-04-10']
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('condition_ja_map');
  if (!sheet) {
    sheet = ss.insertSheet('condition_ja_map');
    Logger.log('[importConditionJaMap] シートを新規作成しました');
  }

  // 全クリアしてヘッダー＋データを書き込み
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(2, 1, ROWS.length, ROWS[0].length).setValues(ROWS);

  Logger.log('[importConditionJaMap] ' + ROWS.length + '件書き込み完了');

  // 原本更新後にそのまま参照用へ同期
  syncCategoryMasterSheets();
}
