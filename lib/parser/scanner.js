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
    this.source = source;

    this.pos = source.charCodeAt(0) === 0xFEFF ? 1 : 0;
    this.eof = this.pos === this.source.length;
    this.line = typeof initLine === 'undefined' ? 1 : initLine;
    this.lineStartPos = typeof initColumn === 'undefined' ? -1 : -initColumn;

    this.minBlockMode = initBlockMode ? 1 : 0;
    this.blockMode = this.minBlockMode;
    this.urlMode = false;

    this.token = null;
    this.buffer = [];
};

Scanner.prototype = {
    lookup: function(offset) {
        if (offset === 0) {
            return this.token;
        }

        for (var i = this.buffer.length; !this.eof && i < offset; i++) {
            this.buffer.push(this.getToken());
        }

        return offset <= this.buffer.length ? this.buffer[offset - 1] : null;
    },
    lookupType: function(offset, type) {
        var token = this.lookup(offset);

        return token !== null && token.type === type;
    },
    next: function() {
        var newToken = null;

        if (this.buffer.length !== 0) {
            newToken = this.buffer.shift();
        } else if (!this.eof) {
            newToken = this.getToken(this.token);
        }

        this.token = newToken;

        return newToken;
    },

    tokenize: function() {
        var tokens = [];

        for (; this.pos < this.source.length; this.pos++) {
            tokens.push(this.getToken());
        }

        return tokens;
    },

    findLastNonSpaceLocation: function() {
        var line = this.line;
        var column = 1;

        for (var i = this.pos - 1; i >= 0; i--) {
            var code = this.source.charCodeAt(i);
            if (code === F || code === R) {
                line--;
            } else if (code === N) {
                line--;
                if (i > 0 && this.source.charCodeAt(i - 1) === R) {
                    i--;
                }
            } else if (code !== SPACE && code !== TAB) {
                break;
            }
        }

        for (; i >= 0; i--, column++) {
            var code = this.source.charCodeAt(i);
            if (code === N || code === R || code === F) {
                break;
            }
        }

        return {
            offset: i + column,
            line: line,
            column: column
        };
    },

    getToken: function(token) {
        var code = this.source.charCodeAt(this.pos);
        var line = this.line;
        var column = this.pos - this.lineStartPos;
        var offset = this.pos;
        var next;

        if (token == null) {
            // x++;
            token = {
                type: 0,

                start: offset,
                end: 0,

                line: line,
                column: column
            };
        } else {
            token.start = offset;
            token.line = line;
            token.column = column;
        }

        switch (code < SYMBOL_CATEGORY_LENGTH ? SYMBOL_CATEGORY[code] : 0) {
            case NUMBER:
                token.type = NUMBER;
                this.readDecimalNumber();
                break;

            case STRING:
                token.type = STRING;
                this.readString(code);
                break;

            case WHITESPACE:
                token.type = WHITESPACE;
                this.readSpaces();
                break;

            case PUNCTUATOR:
                if (code === SLASH) {
                    next = this.pos + 1 < this.source.length ? this.source.charCodeAt(this.pos + 1) : 0;

                    if (next === STAR) { // /*
                        token.type = COMMENT;
                        this.readComment();
                        break;
                    } else if (next === SLASH && !this.urlMode) { // //
                        if (this.blockMode > 0) {
                            var skip = 2;

                            while (this.source.charCodeAt(this.pos + 2) === SLASH) {
                                skip++;
                            }

                            token.type = IDENTIFIER;
                            this.readIdentifier(skip);

                            this.urlMode = this.urlMode || cmpStr(this.source, offset, this.pos, 'url');
                        } else {
                            token.type = UNKNOWN;
                            this.readUnknown();
                        }
                        break;
                    }
                }

                token.type = code;
                this.pos++;

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
                token.type = IDENTIFIER;
                this.readIdentifier(0);

                this.urlMode = this.urlMode || cmpStr(this.source, offset, this.pos, 'url');
        }

        this.eof = this.pos === this.source.length;
        token.end = this.pos;

        return token;
    },

    isNewline: function(code) {
        if (code === N || code === F || code === R) {
            if (code === R && this.pos + 1 < this.source.length && this.source.charCodeAt(this.pos + 1) === N) {
                this.pos++;
            }

            this.line++;
            this.lineStartPos = this.pos;
            return true;
        }

        return false;
    },

    isHex: function(code) {
        return (code >= 48 && code <= 57) || // 0 .. 9
               (code >= 65 && code <= 70) || // A .. F
               (code >= 97 && code <= 102);  // a .. f
    },

    readSpaces: function() {
        for (; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            if (!this.isNewline(code) && code !== SPACE && code !== TAB) {
                break;
            }
        }
    },

    readComment: function() {
        for (this.pos += 2; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            if (code === STAR) { // */
                if (this.source.charCodeAt(this.pos + 1) === SLASH) {
                    this.pos += 2;
                    break;
                }
            } else {
                this.isNewline(code);
            }
        }
    },

    readUnknown: function() {
        for (this.pos += 2; this.pos < this.source.length; this.pos++) {
            if (this.isNewline(this.source.charCodeAt(this.pos))) {
                break;
            }
        }
    },

    readString: function(quote) {
        for (this.pos++; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            // TODO bad string
            if (code === BACK_SLASH) {
                this.pos++;
                this.isNewline(this.source.charCodeAt(this.pos));
            } else if (code === quote) {
                this.pos++;
                break;
            }
        }
    },

    readDecimalNumber: function() {
        for (this.pos++; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            if (code < 48 || code > 57) {  // 0 .. 9
                break;
            }
        }
    },

    readIdentifier: function(skip) {
        for (this.pos += skip; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            if (code === BACK_SLASH) {
                this.pos++;

                // skip escaped unicode sequence that can ends with space
                // [0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?
                for (var i = 0; i < 7 && this.pos + i < this.source.length; i++) {
                    code = this.source.charCodeAt(this.pos + i);

                    if (i !== 6 && this.isHex(code)) {
                        continue;
                    }

                    if (i > 0) {
                        this.pos += i - 1;
                        if (code === SPACE || code === TAB || this.isNewline(code)) {
                            this.pos++;
                        }
                    }

                    break;
                }
            } else if (code < SYMBOL_CATEGORY_LENGTH &&
                       IS_PUNCTUATOR[code] === PUNCTUATOR) {
                break;
            }
        }
    }
};

// warm up tokenizer to elimitate code branches that never execute
// fix soft deoptimizations (insufficient type feedback)
new Scanner('\n\r\r\n\f//""\'\'/**/1a;.{url(a)}').lookup(1e3);

module.exports = Scanner;
