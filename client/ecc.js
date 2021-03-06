
// @source https://github.com/jpillora/eccjs/blob/11fece9ad4419be74a270095b1391da4d76c25e8/src/ecc.js

const SJCL = require("sjcl");

var ecc = {},
    DEFAULT_CURVE = 192,
    ENC_DEC = ecc.ENC_DEC = {},
    SIG_VER = ecc.SIG_VER = {},
    elg = eccAPI('elGamal'),
    dsa = eccAPI('ecdsa'),
    sha256 = hashAPI('sha256');

ecc.sjcl = SJCL;

ecc.generate = function(type, curve) {
  if(!curve)
    curve = DEFAULT_CURVE;
  var keys, pub, sec;
  if(type === ENC_DEC) {
    pub = 'enc';
    sec = 'dec';
    keys = elg.generate(curve);
  } else if(type === SIG_VER) {
    pub = 'ver';
    sec = 'sig';
    keys = dsa.generate(curve);
  } else
    throw "eccjs: generate: Unknown type";

  var newkeys = {};
  newkeys[pub] = exportPublic(keys.pub);
  newkeys[sec] = exportSecret(keys.sec);
  return newkeys;
};

var cache = {
  enc: {}, dec: {}, sig: {}, ver: {}
};

ecc.encrypt = function(enckey, plaintext) {
  var kem = cache.enc[enckey];

  if(!kem) {
    kem = cache.enc[enckey] = elg.importPublic(enckey).kem();
    kem.tagHex = SJCL.codec.hex.fromBits(kem.tag);
  }

  var obj = SJCL.json._encrypt(kem.key, plaintext);
  obj.tag = kem.tagHex;

  return JSON.stringify(obj);
};


ecc.decrypt = function(deckey, ciphertext) {
  var obj = JSON.parse(ciphertext);

  var kem = cache.dec[deckey];
  if(!kem) {
    kem = cache.dec[deckey] = elg.importSecret(deckey);
    kem.$keys = {};
  }

  var key = kem.$keys[obj.tag];
  if(!key)
    key = kem.$keys[obj.tag] = kem.unkem(SJCL.codec.hex.toBits(obj.tag));

  return SJCL.json._decrypt(key, obj);
};

ecc.sign = function(sigkey, text, hash) {
  var key = cache.sig[sigkey];
  if(!key)
    key = cache.sig[sigkey] = dsa.importSecret(sigkey);

  //hash first
  if(hash !== false)
    text = sha256.hash(text);

  return key.sign(text);
};

ecc.verify = function(verkey, signature, text, hash) {
  var key = cache.ver[verkey];
  if(!key)
    key = cache.ver[verkey] = dsa.importPublic(verkey);

  //hash first
  if(hash !== false)
    text = sha256.hash(text);

  try {
    return key.verify(text, signature);
  } catch(e) {
    return false;
  }
};


//ecc algorithm helpers
function eccAPI(algoName) {
  var algo = SJCL.ecc[algoName];
  if(!algo)
    throw new Error("Missing ECC algorithm: " + algoName);
  return {
    generate: function(curve) {
      var keys = algo.generateKeys(curve, 1);
      keys.pub.$curve = curve;
      keys.sec.$curve = curve;
      return keys;
    },
    importPublic: function(keyStr) {
      var key = extract(keyStr);
      return new algo.publicKey(key.curve, SJCL.codec.hex.toBits(key.hex));
    },
    importSecret: function(keyStr) {
      var key = extract(keyStr);
      return new algo.secretKey(key.curve, new SJCL.bn(key.hex));
    }
  };
}

function extract(str) {
  return {
    curve: SJCL.ecc.curves['c'+str.substr(0, 3)],
    hex: str.substr(3)
  };
}

function exportPublic(keyObj) {
  var obj = keyObj.get();
  return keyObj.$curve +
         SJCL.codec.hex.fromBits(obj.x) +
         SJCL.codec.hex.fromBits(obj.y);
}
function exportSecret(keyObj) {
  return keyObj.$curve + SJCL.codec.hex.fromBits(keyObj.get());
}

//hash algorithm helpers
function hashAPI(algoName) {
  var algo = SJCL.hash[algoName];
  if(!algo)
    throw new Error("Missing hash algorithm: " + algoName);
  return {
    hash: function(input) {
      return algo.hash(input);
    }
  };
}

module.exports = ecc;
