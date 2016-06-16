'use strict';

var TokenType = require('./const.js').TokenType;
var cmpStr = require('./cmpStr');

// token types (note: value shouldn't intersect with using char codes)
var WHITESPACE = TokenType.Whitespace;
var IDENTIFIER = TokenType.Identifier;
var NUMBER = TokenType.DecimalNumber;
var STRING = TokenType.String;
var COMMENT = TokenType.Comment;
var UNKNOWN = TokenType.Unknown;
var PUNCTUATOR = 7;

var TAB = 9;
var N = 10;
var F = 12;
var R = 13;
var SPACE = 32;
var DOUBLE_QUOTE = 34;
var QUOTE = 39;
var RIGHT_PARENTHESIS = 41;
var STAR = 42;
var SLASH = 47;
var BACK_SLASH = 92;
var UNDERSCORE = 95;
var LEFT_CURLY_BRACE = 123;
var RIGHT_CURLY_BRACE = 125;

var PUNCTUATION = {
    33: TokenType.ExclamationMark,    // '!'
    34: TokenType.QuotationMark,      // '"'
    35: TokenType.NumberSign,         // '#'
    36: TokenType.DollarSign,         // '$'
    37: TokenType.PercentSign,        // '%'
    38: TokenType.Ampersand,          // '&'
    39: TokenType.Apostrophe,         // '\''
    40: TokenType.LeftParenthesis,    // '('
    41: TokenType.RightParenthesis,   // ')'
    42: TokenType.Asterisk,           // '*'
    43: TokenType.PlusSign,           // '+'
    44: TokenType.Comma,              // ','
    45: TokenType.HyphenMinus,        // '-'
    46: TokenType.FullStop,           // '.'
    47: TokenType.Solidus,            // '/'
    58: TokenType.Colon,              // ':'
    59: TokenType.Semicolon,          // ';'
    60: TokenType.LessThanSign,       // '<'
    61: TokenType.EqualsSign,         // '='
    62: TokenType.GreaterThanSign,    // '>'
    63: TokenType.QuestionMark,       // '?'
    64: TokenType.CommercialAt,       // '@'
    91: TokenType.LeftSquareBracket,  // '['
    93: TokenType.RightSquareBracket, // ']'
    94: TokenType.CircumflexAccent,   // '^'
    95: TokenType.LowLine,            // '_'
    123: TokenType.LeftCurlyBracket,  // '{'
    124: TokenType.VerticalLine,      // '|'
    125: TokenType.RightCurlyBracket, // '}'
    126: TokenType.Tilde              // '~'
};
var SYMBOL_CATEGORY_LENGTH = Math.max.apply(null, Object.keys(PUNCTUATION)) + 1;
var SYMBOL_CATEGORY = new Uint32Array(SYMBOL_CATEGORY_LENGTH);
var IS_PUNCTUATOR = new Uint32Array(SYMBOL_CATEGORY_LENGTH);

for (var i = 0; i < SYMBOL_CATEGORY.length; i++) {
    SYMBOL_CATEGORY[i] = IDENTIFIER;
}

// fill categories
Object.keys(PUNCTUATION).forEach(function(key) {
    SYMBOL_CATEGORY[Number(key)] = PUNCTUATOR;
    IS_PUNCTUATOR[Number(key)] = PUNCTUATOR;
}, SYMBOL_CATEGORY);

// don't treat as punctuator
IS_PUNCTUATOR[UNDERSCORE] = 0;
// whitespace is punctuator
IS_PUNCTUATOR[SPACE] = PUNCTUATOR;
IS_PUNCTUATOR[TAB] = PUNCTUATOR;
IS_PUNCTUATOR[N] = PUNCTUATOR;
IS_PUNCTUATOR[R] = PUNCTUATOR;
IS_PUNCTUATOR[F] = PUNCTUATOR;

for (var i = 48; i <= 57; i++) {
    SYMBOL_CATEGORY[i] = NUMBER;
}

SYMBOL_CATEGORY[SPACE] = WHITESPACE;
SYMBOL_CATEGORY[TAB] = WHITESPACE;
SYMBOL_CATEGORY[N] = WHITESPACE;
SYMBOL_CATEGORY[R] = WHITESPACE;
SYMBOL_CATEGORY[F] = WHITESPACE;

SYMBOL_CATEGORY[QUOTE] = STRING;
SYMBOL_CATEGORY[DOUBLE_QUOTE] = STRING;

//
// scanner
//

var Scanner = function(source, initBlockMode, initLine, initColumn) {
    var start = source.charCodeAt(0) === 0xFEFF ? 1 : 0;
    var sourceLength = source.length;

    this.source = source;
    this.initLine = typeof initLine === 'undefined' ? 1 : initLine;
    this.initColumn = (typeof initColumn === 'undefined' ? 1 : initColumn) - start;

    var line = this.initLine;
    var lines = new Uint32Array(source.length + 1);
    var lastCategory = 0;
    var approximateTokenCount = 0;

    for (var i = start; i < sourceLength; i++) {
        var code = source.charCodeAt(i);
        var category = code < SYMBOL_CATEGORY_LENGTH ? SYMBOL_CATEGORY[code] : IDENTIFIER;

        lines[i] = line;

        if (code === N || code === R || code === F) {
            if (code === R && i + 1 < sourceLength && source.charCodeAt(i + 1) === N) {
                i++;
                lines[i] = line;
            }
            line++;
        }

        if (category !== lastCategory || category === PUNCTUATOR) {
            approximateTokenCount++;
        }

        lastCategory = category;
    }

    lines[sourceLength] = line;
    this.lines = lines;

    this.minBlockMode = initBlockMode ? 1 : 0;
    this.blockMode = this.minBlockMode;
    this.urlMode = false;

    this.tokenize(start, approximateTokenCount);

    this.currentToken = -1;
    this.token = {
        type: 0,
        start: 0,
        end: 0
    };
    this.next();
};

Scanner.prototype = {
    lookup: function(offset) {
        offset += this.currentToken;

        if (offset < this.tokenCount) {
            return {
                type: this.types[offset],
                start: this.offsets[offset],
                end: this.offsets[offset + 1]
            };
        }

        return null;
    },
    lookupType: function(offset) {
        offset += this.currentToken;

        if (offset < this.tokenCount) {
            return this.types[offset];
        }

        return 0;
    },
    lookupValue: function(offset, referenceStr) {
        offset += this.currentToken;

        if (offset < this.tokenCount) {
            return cmpStr(this.source, this.offsets[offset], this.offsets[offset + 1], referenceStr);
        }

        return false;
    },
    next: function() {
        this.currentToken++;

        if (this.currentToken >= this.tokenCount) {
            this.token = null;
        } else {
            this.token.type = this.types[this.currentToken];
            this.token.start = this.offsets[this.currentToken];
            this.token.end = this.offsets[this.currentToken + 1];
        }

        return this.token;
    },

    getLocation: function(offset, source) {
        var line = this.lines[offset];
        var column = line === this.initLine
            ? offset + this.initColumn
            : offset - this.lines.lastIndexOf(line - 1, offset);

        return {
            source: source,
            offset: offset,
            line: line,
            column: column
        };
    },
    findLastNonSpaceLocation: function() {
        for (var i = this.offsets[this.currentToken] - 1; i >= 0; i--) {
            var code = this.source.charCodeAt(i);

            if (code !== SPACE && code !== TAB && code !== R && code !== N && code !== F) {
                break;
            }
        }

        return this.getLocation(i + 1);
    },

    tokenize: function(startPos, approximateTokenCount) {
        var source = this.source;
        var sourceLength = source.length;
        var offsets = new Uint32Array(approximateTokenCount + 1);
        var types = new Uint8Array(approximateTokenCount);
        var tokenCount = 0;
        var start = startPos;
        var end;
        var next;

        offsets[sourceLength] = sourceLength;

        while (start < sourceLength) {
            var code = source.charCodeAt(start);
            var type = code < SYMBOL_CATEGORY_LENGTH ? SYMBOL_CATEGORY[code] : IDENTIFIER;

            switch (type) {
                case NUMBER:
                    end = this.readDecimalNumber(start + 1);
                    break;

                case STRING:
                    end = this.readString(start + 1, code);
                    break;

                case WHITESPACE:
                    end = this.readSpaces(start + 1);
                    break;

                case PUNCTUATOR:
                    if (code === SLASH) {
                        next = start + 1 < source.length ? source.charCodeAt(start + 1) : 0;

                        if (next === STAR) { // /*
                            type = COMMENT;
                            end = this.readComment(start + 2);
                            break;
                        } else if (next === SLASH && !this.urlMode) { // //
                            if (this.blockMode > 0) {
                                var skip = 2;

                                while (source.charCodeAt(start + skip) === SLASH) {
                                    skip++;
                                }

                                type = IDENTIFIER;
                                end = this.readIdentifier(start + skip);

                                this.urlMode = this.urlMode || cmpStr(source, start, end, 'url');
                            } else {
                                type = UNKNOWN;
                                end = this.readUnknown(start + 2);
                            }
                            break;
                        }
                    }

                    type = code;
                    end = start + 1;

                    if (code === RIGHT_PARENTHESIS) {
                        this.urlMode = false;
                    } else if (code === LEFT_CURLY_BRACE) {
                        this.blockMode++;
                    } else if (code === RIGHT_CURLY_BRACE) {
                        if (this.blockMode > this.minBlockMode) {
                            this.blockMode--;
                        }
                    }

                    break;

                default:
                    type = IDENTIFIER;
                    end = this.readIdentifier(start);

                    this.urlMode = this.urlMode || cmpStr(source, start, end, 'url');
            }

            // console.log(type, this.source.substring(start, end));
            offsets[tokenCount] = start;
            types[tokenCount] = type;
            tokenCount++;

            // TODO: remove
            start = end;
        }

        offsets[tokenCount] = end;

        this.types = types;
        this.offsets = offsets;
        this.tokenCount = tokenCount;
    },

    isNewline: function(code, offset) {
        if (code === N || code === F || code === R) {
            if (code === R && offset + 1 < this.source.length && this.source.charCodeAt(offset + 1) === N) {
                return 2;
            }

            return 1;
        }

        return 0;
    },

    isHex: function(code) {
        return (code >= 48 && code <= 57) || // 0 .. 9
               (code >= 65 && code <= 70) || // A .. F
               (code >= 97 && code <= 102);  // a .. f
    },

    readSpaces: function(offset) {
        for (; offset < this.source.length; offset++) {
            var code = this.source.charCodeAt(offset);

            if (code !== SPACE && code !== TAB && code !== R && code !== N && code !== F) {
                break;
            }
        }

        return offset;
    },

    readComment: function(offset) {
        for (; offset < this.source.length; offset++) {
            var starOffset = this.source.indexOf('*', offset);

            if (starOffset === -1) {
                offset = this.source.length;
                break;
            }

            offset = starOffset;
            if (this.source.charCodeAt(offset + 1) === SLASH) {
                return offset + 2;
            }
        }

        return offset;
    },

    readUnknown: function(offset) {
        for (; offset < this.source.length; offset++) {
            var newline = this.isNewline(this.source.charCodeAt(offset), offset);

            if (newline > 0) {
                offset += newline;
                break;
            }
        }

        return offset;
    },

    readString: function(offset, quote) {
        for (; offset < this.source.length; offset++) {
            var code = this.source.charCodeAt(offset);

            // TODO: bad string
            if (code === BACK_SLASH) {
                offset++;
            } else if (code === quote) {
                offset++;
                break;
            }
        }

        return offset;
    },

    readDecimalNumber: function(offset) {
        for (; offset < this.source.length; offset++) {
            var code = this.source.charCodeAt(offset);

            if (code < 48 || code > 57) {  // 0 .. 9
                break;
            }
        }

        return offset;
    },

    readIdentifier: function(offset) {
        for (; offset < this.source.length; offset++) {
            var code = this.source.charCodeAt(offset);

            if (code === BACK_SLASH) {
                offset++;

                // skip escaped unicode sequence that can ends with space
                // [0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?
                for (var i = 0; i < 7 && offset + i < this.source.length; i++) {
                    code = this.source.charCodeAt(offset + i);

                    if (i !== 6 && this.isHex(code)) {
                        continue;
                    }

                    if (i > 0) {
                        offset += i - 1 + this.isNewline(code, offset + i);
                        if (code === SPACE || code === TAB) {
                            offset++;
                        }
                    }

                    break;
                }
            } else if (code < SYMBOL_CATEGORY_LENGTH && IS_PUNCTUATOR[code] === PUNCTUATOR) {
                break;
            }
        }

        return offset;
    }
};

// warm up tokenizer to elimitate code branches that never execute
// fix soft deoptimizations (insufficient type feedback)
new Scanner('\n\r\r\n\f//""\'\'/*\r\n\f*/1a;.{url(a)}').lookup(1e3);

module.exports = Scanner;
