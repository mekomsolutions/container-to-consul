function parser(string, results) {
  'use strict';
  const result = /((?:"[^"]+[^\\]")|(?:'[^']+[^\\]')|(?:[^=]+))\s*=\s*("(?:[\s\S]*?[^\\])"|'(?:[\s\S]*?[^\\])'|(?:.*?[^\\])|$)(?:;|$)(?:\s*(.*))?/m.exec(string);
  if (result && result[1]) {
    const key = result[1].trim().replace(/(^\s*["'])|(["']\s*$)/g, '');
    if (typeof result[2] === 'string') {
      const val = result[2].replace(/(^\s*[\\]?["'])|([\\]?["']\s*$)/g, '');
      // const val = result[2];
      if (/^[0-9-.,]+$/.test(val)) {
        results[key] = parseFloat(val);
      } else if (val === '') {
        results[key] = undefined;
      } else if (val.toLowerCase() === 'true') {
        results[key] = true;
      } else if (val.toLowerCase() === 'false') {
        results[key] = false;
      } else {
        results[key] = val;
      }
    } else {
      results[result[1].trim()] = undefined;
    }
    if (result[3] && result[3].length > 1) {
      parser(result[3], results);
    }
  }
}

module.exports = function (string, object) {
  'use strict';
  if (object) {
    parser(string, object);
  } else {
    object = {};
    parser(string, object);
    return object;
  }
};