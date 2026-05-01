/**
 * MercariShopsDPoP.gs
 *
 * メルカリショップス DPoP JWT 生成 (Ephemeral ECDSA P-256 / ES256)
 *
 * 設計方針:
 *   - リクエストごとに新規鍵ペアを生成 (Ephemeral Keys)
 *   - 鍵の永続化・コード埋め込みなし → GitHub 露出リスクゼロ
 *   - メルカリのブラウザ実装と同じアルゴリズム (crypto.subtle.generateKey ECDSA P-256)
 *
 * 依存: GAS V8 ランタイム (BigInt 必須)
 * 実証: api.mercari.jp が ES256 Ephemeral DPoP を受け入れることを確認済み (2026-05-01)
 */

// ── P-256 (secp256r1) ドメインパラメータ ─────────────────────────────────────
var _P256_P_  = BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF');
var _P256_A_  = BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC');
var _P256_Gx_ = BigInt('0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296');
var _P256_Gy_ = BigInt('0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5');
var _P256_N_  = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551');

// ── 内部ユーティリティ ────────────────────────────────────────────────────────

/** GAS 符号付きバイト列 → BigInt */
function _p256Bytes2Int_(bytes) {
  var hex = bytes.map(function(b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); }).join('');
  return BigInt('0x' + hex);
}

/** BigInt → 32 バイト big-endian 配列 */
function _p256Int2B32_(n) {
  var hex = n.toString(16).padStart(64, '0');
  var out = [];
  for (var i = 0; i < 64; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/** mod p (負値対応) */
function _p256Mp_(a) { return ((a % _P256_P_) + _P256_P_) % _P256_P_; }

/** mod n (負値対応) */
function _p256Mn_(a) { return ((a % _P256_N_) + _P256_N_) % _P256_N_; }

/** 拡張ユークリッド法: a^{-1} mod m */
function _p256Inv_(a, m) {
  var r0 = ((a % m) + m) % m, r1 = m;
  var s0 = BigInt(1), s1 = BigInt(0);
  while (r1 !== BigInt(0)) {
    var q  = r0 / r1;
    var r2 = r0 - q * r1;
    var s2 = s0 - q * s1;
    r0 = r1; r1 = r2;
    s0 = s1; s1 = s2;
  }
  return ((s0 % m) + m) % m;
}

/**
 * EC 点の加算 (Weierstrass: y² = x³ + ax + b mod p)
 * null = 無限遠点
 */
function _p256Add_(P1, P2) {
  if (P1 === null) return P2;
  if (P2 === null) return P1;

  var x1 = P1[0], y1 = P1[1], x2 = P2[0], y2 = P2[1];

  if (x1 === x2) {
    if (y1 !== y2) return null;                               // P + (-P) = O
    // 2倍算: λ = (3x² + a) / (2y) mod p
    var lam2 = _p256Mp_(_p256Mp_(BigInt(3) * x1 * x1 + _P256_A_) * _p256Inv_(BigInt(2) * y1, _P256_P_));
    var x3 = _p256Mp_(lam2 * lam2 - BigInt(2) * x1);
    return [x3, _p256Mp_(lam2 * (x1 - x3) - y1)];
  }

  // 加算: λ = (y2 - y1) / (x2 - x1) mod p
  var lam = _p256Mp_(_p256Mp_(y2 - y1) * _p256Inv_(_p256Mp_(x2 - x1), _P256_P_));
  var x3  = _p256Mp_(lam * lam - x1 - x2);
  return [x3, _p256Mp_(lam * (x1 - x3) - y1)];
}

/** スカラー倍算 k * P (double-and-add) */
function _p256ScalarMul_(k, P) {
  var result = null, addend = P;
  while (k > BigInt(0)) {
    if ((k & BigInt(1)) === BigInt(1)) result = _p256Add_(result, addend);
    addend = _p256Add_(addend, addend);
    k >>= BigInt(1);
  }
  return result;
}

// ── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * リクエストごとに新規 ECDSA P-256 エフェメラル鍵ペアを生成し
 * ES256 DPoP JWT を返す。
 *
 * メルカリのブラウザ実装 (crypto.subtle.generateKey ECDSA P-256) と同じ方式。
 * 鍵はこの関数のスコープ内にのみ存在し、呼び出し後に破棄される。
 *
 * @param {string} method HTTP メソッド (例: 'GET')
 * @param {string} url    リクエスト先 URL (クエリ文字列含む完全 URL)
 * @returns {string} DPoP JWT 文字列
 */
function _buildMercariShopsDPoP_(method, url) {
  var t0 = Date.now();

  // ── 秘密鍵スカラー d を生成 ──────────────────────────────────────────────
  // Utilities.getUuid() (UUID v4) は GAS のセキュアランダムを使用。
  // 2 個 = 256 bit エントロピー → P-256 秘密鍵として十分。
  var raw = BigInt('0x' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  var d   = (raw % (_P256_N_ - BigInt(1))) + BigInt(1);   // [1, n-1]

  // ── 公開鍵 Q = d * G ─────────────────────────────────────────────────────
  var Q = _p256ScalarMul_(d, [_P256_Gx_, _P256_Gy_]);

  // ── JWK (公開鍵のみ) ─────────────────────────────────────────────────────
  var jwk = {
    kty: 'EC', crv: 'P-256',
    x: _dpopB64url_(_p256Int2B32_(Q[0])),
    y: _dpopB64url_(_p256Int2B32_(Q[1]))
  };

  // ── JWT header / payload ─────────────────────────────────────────────────
  var header  = JSON.stringify({ typ: 'dpop+jwt', alg: 'ES256', jwk: jwk });
  var payload = JSON.stringify({
    iat:  Math.floor(Date.now() / 1000),
    jti:  Utilities.getUuid(),
    htu:  url,
    htm:  method,
    uuid: '00000000-0000-0000-0000-000000000000'
  });

  var hB64 = _dpopB64url_(Utilities.newBlob(header).getBytes());
  var pB64 = _dpopB64url_(Utilities.newBlob(payload).getBytes());
  var msg  = hB64 + '.' + pB64;

  // ── ES256 署名 ───────────────────────────────────────────────────────────
  var hashBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.newBlob(msg).getBytes()
  );
  var e = _p256Bytes2Int_(hashBytes);

  // r, s を求める (確率的; ほぼ1回で成功)
  var r, s;
  for (var attempt = 0; attempt < 100; attempt++) {
    var kRaw = BigInt('0x' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
    var k    = (kRaw % (_P256_N_ - BigInt(1))) + BigInt(1);
    var R    = _p256ScalarMul_(k, [_P256_Gx_, _P256_Gy_]);
    r = _p256Mn_(R[0]);
    if (r === BigInt(0)) continue;
    s = _p256Mn_(_p256Inv_(k, _P256_N_) * _p256Mn_(e + r * d));
    if (s !== BigInt(0)) break;
  }

  // JWS ECDSA 形式: r‖s (各 32 バイト big-endian)
  var sigBytes = _p256Int2B32_(r).concat(_p256Int2B32_(s));

  Logger.log(JSON.stringify({
    event: 'mercari-shops-dpop',
    alg: 'ES256',
    keyGenMs: Date.now() - t0,
    jwkX: jwk.x.slice(0, 8) + '...'
  }));

  return msg + '.' + _dpopB64url_(sigBytes);
}

/** byte 配列 → base64url (padding なし) */
function _dpopB64url_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}
