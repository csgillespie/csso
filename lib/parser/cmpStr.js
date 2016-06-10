module.exports = function cmpStr(testStr, start, end, referenceStr, caseSensetive) {
    if (start < 0 || end > testStr.length) {
        return false;
    }

    if (end - start !== referenceStr.length) {
        return false;
    }

    for (var i = start; i < end; i++) {
        var sourceCode = testStr.charCodeAt(i);
        var strCode = referenceStr.charCodeAt(i - start);

        // referenceStr[i].toLowerCase()
        if (caseSensetive !== true && sourceCode >= 65 && sourceCode <= 90) {
            sourceCode = sourceCode | 32;
        }

        if (sourceCode !== strCode) {
            return false;
        }
    }

    return true;
};
