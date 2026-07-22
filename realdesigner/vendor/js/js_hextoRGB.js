"use strict";

function _slicedToArray(arr, i) {
  return (
    _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest()
  );
}

function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance");
}

function _iterableToArrayLimit(arr, i) {
  var _arr = [];
  var _n = true;
  var _d = false;
  var _e = undefined;
  try {
    for (
      var _i = arr[Symbol.iterator](), _s;
      !(_n = (_s = _i.next()).done);
      _n = true
    ) {
      _arr.push(_s.value);
      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }
  return _arr;
}

function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

var isValidHex = function isValidHex(hex) {
  return /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex);
};

var getChunksFromString = function getChunksFromString(st, chunkSize) {
  return st.match(new RegExp(".{".concat(chunkSize, "}"), "g"));
};

var convertHexUnitTo256 = function convertHexUnitTo256(hexStr) {
  return parseInt(hexStr.repeat(2 / hexStr.length), 16);
};

var getAlphafloat = function getAlphafloat(a, alpha) {
  if (a) {
    return a / 256;
  }

  if (alpha) {
    if (1 < alpha && alpha <= 100) {
      return alpha / 100;
    }

    if (0 <= alpha && alpha <= 1) {
      return alpha;
    }
  }

  return 1;
};

var hexToRGB = function hexToRGB(hex, alpha) {
  if (!isValidHex(hex)) {
    throw new Error("Invalid HEX");
  }

  var chunkSize = Math.floor((hex.length - 1) / 3);
  var hexArr = getChunksFromString(hex.slice(1), chunkSize);

  var _hexArr$map = hexArr.map(convertHexUnitTo256),
    _hexArr$map2 = _slicedToArray(_hexArr$map, 4),
    r = _hexArr$map2[0],
    g = _hexArr$map2[1],
    b = _hexArr$map2[2],
    a = _hexArr$map2[3];

  return "rgba("
    .concat(r, ", ")
    .concat(g, ", ")
    .concat(b, ", ")
    .concat(getAlphafloat(a, alpha), ")");
};