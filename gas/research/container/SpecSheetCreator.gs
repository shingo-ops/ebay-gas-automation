/**
 * 仕様書シート作成ツール
 * ユーザー向け仕様書と技術仕様書をスプレッドシートに出力
 */

/**
 * メイン関数: 両方の仕様書シートを作成
 */
function createSpecSheets() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 既存のシートがあれば削除確認
    const existingUserSpec = ss.getSheetByName('仕様書（ユーザー向け）');
    const existingTechSpec = ss.getSheetByName('仕様書（技術）');

    if (existingUserSpec || existingTechSpec) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        '仕様書シートの作成',
        '既存の仕様書シートを削除して再作成しますか？',
        ui.ButtonSet.OK_CANCEL
      );

      if (response !== ui.Button.OK) {
        ss.toast('キャンセルしました', '仕様書シート作成');
        return;
      }

      if (existingUserSpec) existingUserSpec.activate();
      if (existingUserSpec) ss.deleteSheet(existingUserSpec);
      if (existingTechSpec) existingTechSpec.activate();
      if (existingTechSpec) ss.deleteSheet(existingTechSpec);
    }

    // 2つのシートを作成
    Logger.log('ユーザー向け仕様書シートを作成中...');
    createUserSpecSheet(ss);

    Logger.log('技術仕様書シートを作成中...');
    createTechSpecSheet(ss);

    ss.toast('仕様書シートを作成しました', '完了', 5);

  } catch (error) {
    Logger.log('❌ エラー: ' + error.toString());
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'エラー: ' + error.message,
      '仕様書シート作成',
      10
    );
  }
}

/**
 * ユーザー向け仕様書シートを作成
 */
function createUserSpecSheet(ss) {
  const sheet = ss.insertSheet('仕様書（ユーザー向け）');

  let row = 1;

  // タイトル
  sheet.getRange(row, 1).setValue('eBay利益計算ツール - ユーザー向け仕様書');
  sheet.getRange(row, 1).setFontSize(16).setFontWeight('bold');
  row += 2;

  // メタ情報
  sheet.getRange(row, 1).setValue('作成日:');
  sheet.getRange(row, 2).setValue('2026年3月28日');
  row++;
  sheet.getRange(row, 1).setValue('対象者:');
  sheet.getRange(row, 2).setValue('ツール利用者、運用担当者');
  row++;
  sheet.getRange(row, 1).setValue('目的:');
  sheet.getRange(row, 2).setValue('eBay商品リサーチから出品までの自動化システムの使い方を説明');
  row += 2;

  // === システム概要 ===
  row = addSectionHeader(sheet, row, 'システム概要');

  sheet.getRange(row, 1).setValue('このツールは何をするもの？');
  sheet.getRange(row, 1).setFontWeight('bold');
  row++;
  sheet.getRange(row, 1).setValue('eBayで商品をリサーチして出品するまでの作業を自動化するツールです。');
  row += 2;

  // 手作業 vs ツール使用
  sheet.getRange(row, 1, 1, 2).merge().setValue('【手作業でやると】');
  sheet.getRange(row, 1).setFontWeight('bold').setBackground('#ffcccc');
  row++;
  const manualSteps = [
    '1. eBayで商品情報をコピペ',
    '2. 仕入先のサイトから画像を保存',
    '3. 画像をGoogleドライブにアップロード',
    '4. 出品シートに情報を転記',
    '5. 利益計算'
  ];
  manualSteps.forEach(function(step) {
    sheet.getRange(row, 1).setValue(step);
    row++;
  });
  row++;

  sheet.getRange(row, 1, 1, 2).merge().setValue('【このツールを使うと】');
  sheet.getRange(row, 1).setFontWeight('bold').setBackground('#ccffcc');
  row++;
  const toolSteps = [
    '1. eBay URLと仕入元URLを入力',
    '2. 出品ボタンを押す',
    '3. ★自動で全部完了！★'
  ];
  toolSteps.forEach(function(step) {
    sheet.getRange(row, 1).setValue(step);
    row++;
  });
  row += 2;

  // === 主な機能 ===
  row = addSectionHeader(sheet, row, '主な機能');

  const features = [
    {
      title: '1. 商品情報の自動取得',
      items: [
        'eBay APIから商品タイトル、カテゴリ、価格などを自動取得',
        'Item Specifics（商品仕様）を最大30件まで自動充填'
      ]
    },
    {
      title: '2. 画像の自動ダウンロード',
      items: [
        'メルカリ・ヤフオクの商品ページから画像を自動抽出',
        '最大20枚まで対応',
        'Googleドライブに自動保存',
        '出品シートに画像URLを自動出力'
      ]
    },
    {
      title: '3. ポリシー別出品（3種類）',
      items: [
        'Expedited（速達）: 早く届ける発送方法',
        'Standard（通常）: 通常の発送方法',
        '書状: 安価な発送方法',
        '※それぞれのボタンを押すと、その発送方法での利益計算結果が出品シートに反映'
      ]
    },
    {
      title: '4. 仕入元の自動判定',
      items: [
        'ツール設定シートに登録したサイト（Amazon、メルカリなど）を自動判定',
        '仕入元列に名前を出力'
      ]
    },
    {
      title: '5. 複数人同時作業対応',
      items: [
        '複数人が同時に出品ボタンを押してもデータが上書きされない',
        'SKU（在庫管理番号）を先に出力して行を予約'
      ]
    }
  ];

  features.forEach(function(feature) {
    sheet.getRange(row, 1).setValue(feature.title);
    sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
    row++;
    feature.items.forEach(function(item) {
      sheet.getRange(row, 1).setValue('  • ' + item);
      row++;
    });
    row++;
  });

  // === 使い方 ===
  row = addSectionHeader(sheet, row, '使い方');

  sheet.getRange(row, 1).setValue('事前準備: ツール設定シートの設定');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row += 2;

  // 設定項目テーブル
  const settingsHeaders = ['項目', '内容', '例'];
  const settingsData = [
    ['App ID', 'eBay APIのアプリケーションID', '指定のID'],
    ['Cert ID', 'eBay APIの証明書ID', '指定のID'],
    ['Dev ID', 'eBay APIの開発者ID', '指定のID'],
    ['画像フォルダ', '画像を保存するGoogleドライブフォルダのURL', 'https://drive.google.com/drive/folders/xxxxx'],
    ['出品シート', '出品データを出力するスプレッドシートのURL', 'https://docs.google.com/spreadsheets/d/xxxxx'],
    ['カテゴリマスタ', 'カテゴリ情報を管理するスプレッドシートのURL', 'https://docs.google.com/spreadsheets/d/xxxxx']
  ];

  row = addTable(sheet, row, settingsHeaders, settingsData);
  row += 2;

  // 仕入元マッピング
  sheet.getRange(row, 1).setValue('仕入元マッピングの設定（ツール設定シート）');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row += 2;

  const sourceHeaders = ['仕入元', 'URL'];
  const sourceData = [
    ['Amazon', 'https://www.amazon.co.jp/'],
    ['メルカリ', 'https://jp.mercari.com/'],
    ['ヤフオク', 'https://auctions.yahoo.co.jp/'],
    ['ラクマ', 'https://fril.jp/'],
    ['Yahoo!フリマ', 'https://paypayfleamarket.yahoo.co.jp/'],
    ['Yahoo!ショッピング', 'https://shopping.yahoo.co.jp/'],
    ['楽天市場', 'https://www.rakuten.co.jp/']
  ];

  row = addTable(sheet, row, sourceHeaders, sourceData);
  row += 2;

  // === 出品手順 ===
  sheet.getRange(row, 1).setValue('基本的な使い方（出品手順）');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(12);
  row += 2;

  const steps = [
    {
      step: 'ステップ1: リサーチシートに情報を入力',
      details: [
        'トップ情報（B2～C2）: リサーチ方法、担当者名',
        '価格情報（E4～H5）: 仕入元URL①、画像URL、メモ',
        '商品リスト（E7～H12）: Item URL、状態',
        'メイン情報（K4～L11）: 仕入値、売値、Best offer、実重量、サイズ',
        'ポリシーセクション（E13～H16）: 各発送方法の利益計算結果'
      ]
    },
    {
      step: 'ステップ2: 出品ボタンを押す',
      details: [
        '出品（Expedited）: 速達配送での出品',
        '出品（Standard）: 通常配送での出品',
        '出品（書状）: 書状配送での出品',
        '※希望する発送方法のボタンをクリック'
      ]
    },
    {
      step: 'ステップ3: 確認ダイアログ',
      details: [
        '「{ポリシー名} shippingで出品しますか？」というダイアログが表示',
        'OK: 出品を実行',
        'キャンセル: 中止'
      ]
    },
    {
      step: 'ステップ4: 自動処理の開始',
      details: [
        '1. SKUを生成して行を予約',
        '2. eBay APIから商品情報を取得',
        '3. 商品ページから画像を取得（最大20枚）',
        '4. Googleドライブに画像を保存',
        '5. 出品シートに全データを転記'
      ]
    },
    {
      step: 'ステップ5: 完了',
      details: [
        '「出品データを転記しました」というメッセージが表示されたら完了'
      ]
    }
  ];

  steps.forEach(function(step) {
    sheet.getRange(row, 1).setValue(step.step);
    sheet.getRange(row, 1).setFontWeight('bold').setBackground('#e6f2ff');
    row++;
    step.details.forEach(function(detail) {
      sheet.getRange(row, 1).setValue('  ' + detail);
      row++;
    });
    row++;
  });

  // === 各シートの役割 ===
  row = addSectionHeader(sheet, row, '各シートの役割');

  const sheetRoles = [
    ['シート名', '目的', '編集頻度'],
    ['ツール設定', 'APIキーやフォルダURLなどの設定を管理', '初期設定のみ（普段は触らない）'],
    ['リサーチ', '商品リサーチ情報を入力', '毎回の出品時'],
    ['出品', '出品データを管理（自動で書き込まれる）', '必要に応じて手動修正'],
    ['カテゴリマスタ', 'eBayカテゴリごとの必須・推奨Item Specificsを管理', 'ほぼなし']
  ];

  row = addTable(sheet, row, sheetRoles[0], sheetRoles.slice(1));
  row += 2;

  // === ポリシー別出品機能 ===
  row = addSectionHeader(sheet, row, 'ポリシー別出品機能');

  sheet.getRange(row, 1).setValue('SKU（在庫管理番号）とは？');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row++;
  sheet.getRange(row, 1).setValue('SKUは商品を一意に識別するための番号です。');
  row += 2;

  sheet.getRange(row, 1).setValue('フォーマット:');
  sheet.getRange(row, 1).setFontWeight('bold');
  row++;
  sheet.getRange(row, 1).setValue('リサーチ方法/担当者/利益額/利益率/タイムスタンプ');
  sheet.getRange(row, 1).setFontFamily('Courier New');
  row += 2;

  sheet.getRange(row, 1).setValue('例:');
  sheet.getRange(row, 1).setFontWeight('bold');
  row++;
  sheet.getRange(row, 1).setValue('eBay/田中/1500/25/20260328143052');
  sheet.getRange(row, 1).setFontFamily('Courier New').setBackground('#f0f0f0');
  row += 2;

  sheet.getRange(row, 1).setValue('なぜSKUが重要？');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row++;
  sheet.getRange(row, 1).setValue('複数人が同時に出品ボタンを押しても、SKUを先に出力して行を予約することで、データが上書きされるのを防ぎます。');
  row += 2;

  // ポリシーごとの違い
  sheet.getRange(row, 1).setValue('ポリシーごとの違い');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row += 2;

  const policyHeaders = ['ポリシー', '発送方法', '特徴', '利益'];
  const policyData = [
    ['Expedited', 'FedEx/DHL等', '速く届く、送料高い', '利益率低め'],
    ['Standard', '日本郵便等', '通常配送、送料中間', '利益率中間'],
    ['書状', '日本郵便書状', '安い、薄い商品のみ', '利益率高め']
  ];

  row = addTable(sheet, row, policyHeaders, policyData);
  row += 2;

  // === よくある質問 ===
  row = addSectionHeader(sheet, row, 'よくある質問（FAQ）');

  const faqs = [
    {
      q: 'Q1. SKUが出品シートに表示されない',
      a: 'ヘッダー行（3行目）に「SKU」列が存在するか確認してください。'
    },
    {
      q: 'Q2. 画像がGoogleドライブに保存されない',
      a: 'ツール設定シートの「画像フォルダ」URLが正しいか、フォルダに編集権限があるか、OAuth認証を実行したかを確認してください。'
    },
    {
      q: 'Q3. 仕入元が「不明」と表示される',
      a: 'ツール設定シートの「仕入元」「URL」列に、該当するサイトが登録されているか確認してください。'
    },
    {
      q: 'Q4. 「アクセスが拒否されました: DriveApp」エラー',
      a: '図形ボタンから初期設定を実行して、Googleドライブへのアクセス権限を付与してください。'
    },
    {
      q: 'Q5. 発送方法列にエラーが出る',
      a: '出品シートのCS列（発送方法）にデータ入力規則が設定されている場合、許可されている値（FedEx, DHL, 日本郵便）以外は入力できません。'
    },
    {
      q: 'Q6. 複数人で同時に出品ボタンを押しても大丈夫？',
      a: 'はい、SKU先行出力により行が予約されるため、データが上書きされることはありません。'
    }
  ];

  faqs.forEach(function(faq) {
    sheet.getRange(row, 1).setValue(faq.q);
    sheet.getRange(row, 1).setFontWeight('bold').setBackground('#fff3cd');
    row++;
    sheet.getRange(row, 1).setValue(faq.a);
    row += 2;
  });

  // === トラブルシューティング ===
  row = addSectionHeader(sheet, row, 'トラブルシューティング');

  const troubles = [
    {
      problem: '問題: 出品ボタンを押してもエラーが出る',
      checks: [
        '確認1: eBay APIキーが正しく設定されているか（ツール設定シートのApp ID, Cert ID, Dev ID）',
        '確認2: 図形ボタンから初期設定を実行したか（権限承認）',
        '確認3: eBay URLが正しいか（リサーチシートのItem URL）'
      ]
    },
    {
      problem: '問題: 画像が出力されない',
      checks: [
        '確認1: 商品ページURLが正しいか（メルカリ: https://jp.mercari.com/item/m*****、ヤフオク: https://page.auctions.yahoo.co.jp/*****）',
        '確認2: 画像フォルダURLが正しいか（Googleドライブのフォルダを開いたときのURL全体をコピー）',
        '確認3: 実行ログを確認（表示 > ログ）'
      ]
    },
    {
      problem: '問題: 列がずれている',
      checks: [
        '原因: 出品シートの列構造が変わった',
        '解決: このツールはヘッダー名でマッピングするため、列を追加・削除しても自動で対応します。ヘッダー行（3行目）のヘッダー名を変更しないでください。'
      ]
    }
  ];

  troubles.forEach(function(trouble) {
    sheet.getRange(row, 1).setValue(trouble.problem);
    sheet.getRange(row, 1).setFontWeight('bold').setBackground('#f8d7da');
    row++;
    trouble.checks.forEach(function(check) {
      sheet.getRange(row, 1).setValue('  ' + check);
      row++;
    });
    row += 2;
  });

  // === 用語集 ===
  row = addSectionHeader(sheet, row, '用語集');

  const glossaryHeaders = ['用語', '意味'];
  const glossaryData = [
    ['SKU', 'Stock Keeping Unit（在庫管理番号）。商品を一意に識別する番号'],
    ['Item Specifics', 'eBayの商品仕様（Brand, UPC, Colorなど）'],
    ['OAuth認証', 'Googleドライブなどへのアクセス権限を付与する認証'],
    ['ポリシー', '発送方法のこと（Expedited, Standard, 書状）'],
    ['ヘッダー行', '出品シートの3行目。列名が書かれている'],
    ['動的マッピング', '列位置が変わっても、ヘッダー名で自動的に列を見つける仕組み']
  ];

  row = addTable(sheet, row, glossaryHeaders, glossaryData);
  row += 2;

  // 列幅を調整
  sheet.setColumnWidth(1, 600);
  sheet.setColumnWidth(2, 400);

  Logger.log('✅ ユーザー向け仕様書シート作成完了');
}

/**
 * 技術仕様書シートを作成
 */
function createTechSpecSheet(ss) {
  const sheet = ss.insertSheet('仕様書（技術）');

  let row = 1;

  // タイトル
  sheet.getRange(row, 1).setValue('eBay利益計算ツール - 技術仕様書');
  sheet.getRange(row, 1).setFontSize(16).setFontWeight('bold');
  row += 2;

  // メタ情報
  sheet.getRange(row, 1).setValue('作成日:');
  sheet.getRange(row, 2).setValue('2026年3月28日');
  row++;
  sheet.getRange(row, 1).setValue('対象者:');
  sheet.getRange(row, 2).setValue('開発者、保守担当者');
  row++;
  sheet.getRange(row, 1).setValue('言語:');
  sheet.getRange(row, 2).setValue('Google Apps Script (JavaScript ES5互換)');
  row++;
  sheet.getRange(row, 1).setValue('バージョン:');
  sheet.getRange(row, 2).setValue('1.0');
  row += 2;

  // === アーキテクチャ概要 ===
  row = addSectionHeader(sheet, row, 'アーキテクチャ概要');

  sheet.getRange(row, 1).setValue('システム構成');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row += 2;

  const architecture = [
    'Google Apps Script',
    '  ├─ 図形ボタン → Functions.gs → EbayAPI.gs',
    '  ├─ Utils.gs',
    '  ├─ ImageHandler.gs',
    '  ├─ ProductImageFetcher.gs',
    '  ├─ Setup.gs',
    '  └─ Config.gs',
    '',
    '外部API:',
    '  ├─ eBay Browse API (商品情報取得)',
    '  ├─ Google Drive (画像保存)',
    '  └─ Google Sheets (データ管理)'
  ];

  architecture.forEach(function(line) {
    sheet.getRange(row, 1).setValue(line);
    sheet.getRange(row, 1).setFontFamily('Courier New');
    row++;
  });
  row += 2;

  sheet.getRange(row, 1).setValue('設計原則');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row++;
  const principles = [
    '1. ヘッダー名ベースの動的マッピング: 列位置が変わっても自動対応',
    '2. モジュラー設計: 各機能を独立したファイルに分離',
    '3. エラーリカバリー: try-catchで全ての外部API呼び出しを保護',
    '4. ログ駆動: Logger.log()で詳細な実行ログを記録'
  ];
  principles.forEach(function(principle) {
    sheet.getRange(row, 1).setValue(principle);
    row++;
  });
  row += 2;

  // === ファイル構成 ===
  row = addSectionHeader(sheet, row, 'ファイル構成');

  const files = [
    {
      file: 'Config.gs',
      role: '設定・定数管理',
      functions: 'getEbayConfig(), getEbayAccessToken(), extractSpreadsheetId()'
    },
    {
      file: 'Functions.gs',
      role: 'メイン処理（出品データ転記）',
      functions: 'onListingButtonPolicy1/2/3(), transferListingDataWithPolicy(), buildHeaderMapping()'
    },
    {
      file: 'EbayAPI.gs',
      role: 'eBay API連携',
      functions: 'getItemInfo(), getSpecInfo()'
    },
    {
      file: 'ProductImageFetcher.gs',
      role: '画像スクレイピング',
      functions: 'extractImageUrlsFromProductPage()'
    },
    {
      file: 'ImageHandler.gs',
      role: '画像保存',
      functions: 'downloadAndSaveImage(), downloadMultipleImages()'
    },
    {
      file: 'Utils.gs',
      role: 'ユーティリティ',
      functions: 'generateSKU(), getPurchaseSourceMappings(), getPurchaseSourceNameFromUrl()'
    }
  ];

  const fileHeaders = ['ファイル名', '役割', '主要関数'];
  const fileData = files.map(function(f) {
    return [f.file, f.role, f.functions];
  });

  row = addTable(sheet, row, fileHeaders, fileData);
  row += 2;

  // === 主要機能の技術詳細 ===
  row = addSectionHeader(sheet, row, '主要機能の技術詳細');

  const techFeatures = [
    {
      title: '1. ヘッダー名ベースの動的マッピング',
      description: '出品シートのヘッダー行（3行目）から列マッピングを動的に構築',
      benefits: [
        '列を追加・削除してもヘッダー名が一致すれば動作',
        '列順序を変更しても影響なし'
      ]
    },
    {
      title: '2. SKU先行出力による行予約',
      description: 'SKUを先に出力して行を物理的に予約し、複数人同時作業での競合を防止',
      benefits: [
        'SpreadsheetApp.flush()で即座に反映',
        '画像ダウンロード中も他のユーザーは次の行を使用可能'
      ]
    },
    {
      title: '3. 仕入元の動的マッピング',
      description: 'ツール設定シートから仕入元マッピングを動的に取得',
      benefits: [
        '新しい仕入元を追加する際にコード変更不要',
        'ユーザーがツール設定シートで管理可能'
      ]
    },
    {
      title: '4. Item Specificsの自動充填',
      description: 'カテゴリマスタから必須・推奨スペックを取得し、最大30件まで自動充填',
      benefits: [
        '必須スペック（赤色）を優先充填',
        '推奨スペック（オレンジ色）で補完'
      ]
    }
  ];

  techFeatures.forEach(function(feature) {
    sheet.getRange(row, 1).setValue(feature.title);
    sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11).setBackground('#e6f2ff');
    row++;
    sheet.getRange(row, 1).setValue(feature.description);
    row++;
    feature.benefits.forEach(function(benefit) {
      sheet.getRange(row, 1).setValue('  ✓ ' + benefit);
      row++;
    });
    row++;
  });

  // === データ構造 ===
  row = addSectionHeader(sheet, row, 'データ構造');

  sheet.getRange(row, 1).setValue('出品シート構造（126列）');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row += 2;

  // 主要列のみ表示（全126列は長すぎるため）
  const columnHeaders = ['列', '列番号', 'ヘッダー名'];
  const columnData = [
    ['A', '1', '出品URL'],
    ['B', '2', 'ステータス'],
    ['C', '3', 'SKU ★新規追加★'],
    ['D', '4', 'キーワード'],
    ['E', '5', 'メモ'],
    ['F～H', '6～8', '仕入元URL①②③'],
    ['I', '9', '仕入元'],
    ['J', '10', 'リサーチ担当'],
    ['K～O', '11～15', '出品担当、ピックアップ担当、仕入れ検索担当、利益計算担当、業務6担当 ★新規追加★'],
    ['P', '16', 'タイトル'],
    ['Q', '17', '文字数'],
    ['R～U', '18～21', '状態、状態テンプレ、状態説明(テンプレ)、状態説明'],
    ['V～W', '22～23', 'ItemURL、スペックURL'],
    ['X～Y', '24～25', 'カテゴリID、カテゴリ'],
    ['Z～AC', '26～29', 'Brand、UPC、EAN、MPN(型番可)'],
    ['AD～CK', '30～89', 'Item Specifics（項目名1～30、内容1～30）= 60列'],
    ['CL', '90', 'テンプレート'],
    ['CM～CP', '91～94', '実重量(g)、奥行き(cm)、幅(cm)、高さ(cm)'],
    ['CQ～CR', '95～96', '容積重量(g)、適用重量(g)'],
    ['CS', '97', '発送方法'],
    ['CT', '98', '個数 ★1固定出力★'],
    ['CU～CW', '99～101', '仕入値(¥)、売値($)、Best offer'],
    ['CX～CY', '102～103', '最安値URL、画像URL'],
    ['CZ～DS', '104～123', '画像1～20 ★20枚対応★'],
    ['DT～DV', '124～126', '出品タイムスタンプ、管理年月、在庫管理']
  ];

  row = addTable(sheet, row, columnHeaders, columnData);
  row += 2;

  sheet.getRange(row, 1).setValue('リサーチシート - ポリシーセクション（E13:H16）');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row += 2;

  const policyStructure = [
    ['行', 'E列（ポリシー）', 'F列（発送方法）', 'G列（利益額）', 'H列（利益率）'],
    ['13', 'ヘッダー', 'ヘッダー', 'ヘッダー', 'ヘッダー'],
    ['14', 'Expedited', '（関数計算）', '（関数）', '（関数）'],
    ['15', 'Standard', '（関数計算）', '（関数）', '（関数）'],
    ['16', '書状', '（関数計算）', '（関数）', '（関数）']
  ];

  row = addTable(sheet, row, policyStructure[0], policyStructure.slice(1));
  row += 2;

  // === API仕様 ===
  row = addSectionHeader(sheet, row, 'API仕様');

  sheet.getRange(row, 1).setValue('eBay Browse API');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row++;
  sheet.getRange(row, 1).setValue('認証: OAuth 2.0 (Client Credentials Grant)');
  row++;
  sheet.getRange(row, 1).setValue('エンドポイント: https://api.ebay.com/buy/browse/v1/');
  sheet.getRange(row, 1).setFontFamily('Courier New');
  row += 2;

  const apiMethods = [
    ['API', 'エンドポイント', '用途'],
    ['get_item_by_legacy_id', '/item/get_item_by_legacy_id', '通常の商品情報取得'],
    ['get_items_by_item_group', '/item/get_items_by_item_group', 'バリエーション商品の情報取得']
  ];

  row = addTable(sheet, row, apiMethods[0], apiMethods.slice(1));
  row += 2;

  // === エラーハンドリング ===
  row = addSectionHeader(sheet, row, 'エラーハンドリング');

  const errorLevels = [
    ['レベル', '対応', '例'],
    ['レベル1: 致命的エラー', '処理中断、エラーメッセージ表示', 'リサーチシートが見つからない'],
    ['レベル2: 警告', '処理続行、ログ出力', 'ヘッダーが見つからない'],
    ['レベル3: 情報', 'ログのみ', '画像保存成功']
  ];

  row = addTable(sheet, row, errorLevels[0], errorLevels.slice(1));
  row += 2;

  sheet.getRange(row, 1).setValue('エラーメッセージ規約');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row++;
  const errorIcons = [
    '✅: 成功',
    '❌: エラー',
    '⚠️: 警告',
    '📁: ファイル/フォルダ関連',
    '🔍: 検索・探索',
    '📦: データ処理'
  ];
  errorIcons.forEach(function(icon) {
    sheet.getRange(row, 1).setValue(icon);
    row++;
  });
  row += 2;

  // === パフォーマンス最適化 ===
  row = addSectionHeader(sheet, row, 'パフォーマンス最適化');

  const optimizations = [
    {
      title: '1. SpreadsheetApp.flush()の使用',
      description: 'SKU先行出力を即座に反映し、他のユーザーが同じ行を検出するのを防ぐ'
    },
    {
      title: '2. 一括書き込み（setValues）',
      description: '126回のAPI呼び出しを1回に削減、実行時間が数秒から数ミリ秒に短縮'
    },
    {
      title: '3. キャッシュの活用',
      description: 'eBay APIトークンをScriptPropertiesにキャッシュ、有効期限内は再利用'
    },
    {
      title: '4. レート制限対策',
      description: '画像ダウンロード時にUtilities.sleep(500)で0.5秒待機、レート制限エラーを回避'
    }
  ];

  optimizations.forEach(function(opt) {
    sheet.getRange(row, 1).setValue(opt.title);
    sheet.getRange(row, 1).setFontWeight('bold');
    row++;
    sheet.getRange(row, 1).setValue(opt.description);
    row += 2;
  });

  // === デバッグガイド ===
  row = addSectionHeader(sheet, row, 'デバッグガイド');

  sheet.getRange(row, 1).setValue('テスト関数');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row += 2;

  const testFunctions = [
    ['関数名', 'コマンド', '用途'],
    ['inspectListingHeaderMapping()', 'clasp run inspectListingHeaderMapping', '出品シートのヘッダー検証（126列の一致・不一致を確認）'],
    ['testPolicyAndSKU()', 'clasp run testPolicyAndSKU', 'ポリシーデータ取得とSKU生成テスト']
  ];

  row = addTable(sheet, row, testFunctions[0], testFunctions.slice(1));
  row += 2;

  sheet.getRange(row, 1).setValue('よくあるエラーとデバッグ方法');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row += 2;

  const debugMethods = [
    ['エラー', '原因', '解決方法'],
    ['アクセスが拒否されました: DriveApp', 'OAuth認証が未実施', '図形ボタンから初期設定を実行'],
    ['ヘッダー「〇〇」が見つかりません', 'Config.gsのヘッダー名と実際のシートが不一致', 'Config.gsを実際のヘッダー名に合わせる'],
    ['eBay API 401 Unauthorized', 'トークンの有効期限切れ', 'ScriptPropertiesをクリアして再実行']
  ];

  row = addTable(sheet, row, debugMethods[0], debugMethods.slice(1));
  row += 2;

  // === セキュリティ ===
  row = addSectionHeader(sheet, row, 'セキュリティ');

  sheet.getRange(row, 1).setValue('OAuth認証スコープ');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row++;
  const oauthScopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.scriptapp'
  ];
  oauthScopes.forEach(function(scope) {
    sheet.getRange(row, 1).setValue('  • ' + scope);
    sheet.getRange(row, 1).setFontFamily('Courier New');
    row++;
  });
  row += 2;

  sheet.getRange(row, 1).setValue('API認証情報の保護');
  sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
  row++;
  sheet.getRange(row, 1).setValue('App ID, Cert ID, Dev IDはツール設定シートに保存し、トークンはScriptPropertiesにキャッシュ。コード内にハードコーディングしない。');
  row += 2;

  // 列幅を調整
  sheet.setColumnWidth(1, 700);
  sheet.setColumnWidth(2, 300);

  Logger.log('✅ 技術仕様書シート作成完了');
}

/**
 * セクションヘッダーを追加
 */
function addSectionHeader(sheet, row, title) {
  sheet.getRange(row, 1, 1, 2).merge().setValue(title);
  sheet.getRange(row, 1).setFontSize(14).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
  return row + 2;
}

/**
 * テーブルを追加
 */
function addTable(sheet, startRow, headers, data) {
  let row = startRow;

  // ヘッダー行
  for (let i = 0; i < headers.length; i++) {
    sheet.getRange(row, i + 1).setValue(headers[i]);
    sheet.getRange(row, i + 1).setFontWeight('bold').setBackground('#d9ead3');
  }
  row++;

  // データ行
  data.forEach(function(rowData) {
    for (let i = 0; i < rowData.length; i++) {
      sheet.getRange(row, i + 1).setValue(rowData[i]);
    }
    row++;
  });

  // 枠線を設定
  const tableRange = sheet.getRange(startRow, 1, data.length + 1, headers.length);
  tableRange.setBorder(true, true, true, true, true, true);

  return row;
}
