
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Block TEA (xxtea) Tiny Encryption Algorithm                        (c) Chris Veness 2002-2016  */
/*  - www.movable-type.co.uk/scripts/tea-block.html                                  MIT Licence  */
/*                                                                                                */
/* Algorithm: David Wheeler & Roger Needham, Cambridge University Computer Lab                    */
/*            http://www.cl.cam.ac.uk/ftp/papers/djw-rmn/djw-rmn-tea.html (1994)                  */
/*            http://www.cl.cam.ac.uk/ftp/users/djw3/xtea.ps (1997)                               */
/*            http://www.cl.cam.ac.uk/ftp/users/djw3/xxtea.ps (1998)                              */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

'use strict';


/**
 * Tiny Encryption Algorithm
 *
 * @namespace
 */
var Tea = {};


/**
 * Encrypts text using Corrected Block TEA (xxtea) algorithm.
 *
 * @param   {string} plaintext - String to be encrypted (multi-byte safe).
 * @param   {string} password - Password to be used for encryption (1st 16 chars).
 * @returns {string} Encrypted text (encoded as base64).
 */
Tea.encrypt = function(plaintext, password) {
//return plaintext
    plaintext = String(plaintext);
    //password = String(password);

    const plen = plaintext.length;
    if (!plen) return('');  // nothing to encrypt

    //  v is n-word data vector; converted to array of longs from UTF-8 string
    //var v = Tea.strToLongs(Tea.utf8Encode(plaintext));
    var v = Tea.strToLongs(plaintext);
    //  k is 4-word key; simply convert first 16 chars of password as key
    //var k = Tea.strToLongs(Tea.utf8Encode(password).slice(0,16));
    var k = password;

    v = Tea.encode(v, k);

    // convert array of longs to string
    var ciphertext = Tea.longsToStr(v) + String.fromCharCode(plen % 4);

    // convert binary string to base64 ascii for safe transport
    //return Tea.base64Encode(ciphertext);
    
    // return binary string cipher data
    return ciphertext;
};


/**
 * Decrypts text using Corrected Block TEA (xxtea) algorithm.
 *
 * @param   {string} ciphertext - String to be decrypted.
 * @param   {string} password - Password to be used for decryption (1st 16 chars).
 * @returns {string} Decrypted text.
 * @throws  {Error}  Invalid ciphertext
 */
Tea.decrypt = function(ciphertext, password) {
//return ciphertext
    ciphertext = String(ciphertext);
    //password = String(password);

    const clen = ciphertext.length
    if (!clen) return('');

    //  v is n-word data vector; converted to array of longs from base64 string
    //var v = Tea.strToLongs(Tea.base64Decode(ciphertext));
    var flags = clen % 4 ? ciphertext.charCodeAt(clen - 1) : undefined,
        v = Tea.strToLongs(ciphertext, true);
    
    //  k is 4-word key; simply convert first 16 chars of password as key
    //var k = Tea.strToLongs(Tea.utf8Encode(password).slice(0,16));
    var k = password;

    v = Tea.decode(v, k);

    var plaintext = Tea.longsToStr(v, flags & 3);

    //for (var i=0, strip_len=0; i<4; i++) if (plaintext[clen - 1 - i]) break; else strip_len++
    // strip trailing null chars resulting from filling 4-char blocks:
    //plaintext = plaintext.replace(/\0+$/,'');
    //plaintext = plaintext.substring(0, clen - 1 - (strip_len < 4 ? strip_len : 0));
    //plaintext = plaintext.substring(0, clen - 1 - (strip_len < 4 ? strip_len : 0));

    //return Tea.utf8Decode(plaintext);
    return plaintext;
};


/**
 * XXTEA: encodes array of unsigned 32-bit integers using 128-bit key.
 *
 * @param   {number[]} v - Data vector.
 * @param   {number[]} k - Key.
 * @returns {number[]} Encoded vector.
 */
Tea.encode = function(v, k) {
    if (v.length < 2) v[1] = 0;  // algorithm doesn't work for n<2 so fudge by adding a null
    var n = v.length;

    var z = v[n-1], y = v[0], delta = 0x9e3779b9;
    var mx, e, q = Math.floor(6 + 52/n), sum = 0;

    while (q-- > 0) {  // 6 + 52/n operations gives between 6 & 32 mixes on each word
        sum += delta;
        e = sum>>>2 & 3;
        for (var p = 0; p < n; p++) {
            y = v[(p+1)%n];
            mx = (z>>>5 ^ y<<2) + (y>>>3 ^ z<<4) ^ (sum^y) + (k[p&3 ^ e] ^ z);
            z = v[p] += mx;
        }
    }

    return v;
};


/**
 * XXTEA: decodes array of unsigned 32-bit integers using 128-bit key.
 *
 * @param   {number[]} v - Data vector.
 * @param   {number[]} k - Key.
 * @returns {number[]} Decoded vector.
 */
Tea.decode = function(v, k) {
    var n = v.length;

    var z = v[n-1], y = v[0], delta = 0x9e3779b9;
    var mx, e, q = Math.floor(6 + 52/n), sum = q*delta;

    while (sum != 0) {
        e = sum>>>2 & 3;
        for (var p = n-1; p >= 0; p--) {
            z = v[p>0 ? p-1 : n-1];
            mx = (z>>>5 ^ y<<2) + (y>>>3 ^ z<<4) ^ (sum^y) + (k[p&3 ^ e] ^ z);
            y = v[p] -= mx;
        }
        sum -= delta;
    }

    return v;
};


/**
 * Converts string to array of longs (each containing 4 chars).
 * @private
 */
Tea.strToLongs = function(s, has_flag) {
    // note chars must be within ISO-8859-1 (Unicode code-point <= U+00FF) to fit 4/long
    var len = Math.ceil((s.length - (has_flag ? s.length % 4 : 0)) / 4),
    //var len = Math.ceil(s.length / 4),
        l = new Array(len);
    for (var i=0; i<len; i++) {
        // note little-endian encoding - endianness is irrelevant as long as it matches longsToStr()
        l[i] = s.charCodeAt(i*4)        + (s.charCodeAt(i*4+1)<<8) +
              (s.charCodeAt(i*4+2)<<16) + (s.charCodeAt(i*4+3)<<24);
    } // note running off the end of the string generates nulls since bitwise operators treat NaN as 0
    return l;
};


/**
 * Converts array of longs to string.
 * @private
 */
Tea.longsToStr = function(l, mod_len) {
    if (!mod_len) mod_len = 4
    var str = '',
        keep_len = 4
    for (var i=0, j=l.length; i<j; i++) {
        if (j-i === 1) keep_len = mod_len
        const one = String.fromCharCode(l[i] & 0xff)
            + (keep_len >= 2 ? String.fromCharCode(l[i]>>>8 & 0xff) : '')
            + (keep_len >= 3 ? String.fromCharCode(l[i]>>>16 & 0xff) : '')
            + (keep_len >= 4 ? String.fromCharCode(l[i]>>>24 & 0xff) : '');
        str += one
    }
    return str;
};

/*Tea.longsToArray = function(l) {
    var arr = new Uint8Array(l.length);
    for (var i=0; i<l.length; i++) {
        arr[i*4] = l[i] & 0xff
        arr[i*4 + 1] = l[i]>>>8 & 0xff
        arr[i*4 + 2] = l[i]>>>16 & 0xff
        arr[i*4 + 3] = l[i]>>>24 & 0xff
    }
    return arr;
};
*/

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */


/**
 * Encodes multi-byte string to utf8 - monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
 */
Tea.utf8Encode = function(str) {
    return unescape(encodeURIComponent(str));
};

/**
 * Decodes utf8 string to multi-byte
 */
Tea.utf8Decode = function(utf8Str) {
    try {
        return decodeURIComponent(escape(utf8Str));
    } catch (e) {
        return utf8Str; // invalid UTF-8? return as-is
    }
};


/**
 * Encodes base64 - developer.mozilla.org/en-US/docs/Web/API/window.btoa, nodejs.org/api/buffer.html
 */
Tea.base64Encode = function(str) {
    if (typeof btoa != 'undefined') return btoa(str); // browser
    if (typeof Buffer != 'undefined') return new Buffer(str, 'binary').toString('base64'); // Node.js
    throw new Error('No Base64 Encode');
};

/**
 * Decodes base64
 */
Tea.base64Decode = function(b64Str) {
    if (typeof atob == 'undefined' && typeof Buffer == 'undefined') throw new Error('No base64 decode');
    try {
        if (typeof atob != 'undefined') return atob(b64Str); // browser
        if (typeof Buffer != 'undefined') return new Buffer(b64Str, 'base64').toString('binary'); // Node.js
    } catch (e) {
        throw new Error('Invalid ciphertext');
    }
};

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
if (typeof module != 'undefined' && module.exports) module.exports = Tea; // CommonJS export
else window.Tea = Tea;
