'use strict';

var TokenType = require('./const').TokenType;
var TokenName = require('./const').TokenName;
var Scanner = require('./scanner');
var List = require('../utils/list');
var cmpStr = require('./cmpStr');
var needPositions;
var filename;
var scanner;

var BACK_SLASH = 92;
var WHITESPACE = TokenType.Whitespace;
var IDENTIFIER = TokenType.Identifier;
var DECIMALNUMBER = TokenType.DecimalNumber;
var STRING = TokenType.String;
var COMMENT = TokenType.Comment;
var UNKNOWN = TokenType.Unknown;
var EXCLAMATIONMARK = TokenType.ExclamationMark;
// var QUOTATIONMARK = TokenType.QuotationMark;
var NUMBERSIGN = TokenType.NumberSign;
var DOLLARSIGN = TokenType.DollarSign;
var PERCENTSIGN = TokenType.PercentSign;
// var AMPERSAND = TokenType.Ampersand;
// var APOSTROPHE = TokenType.Apostrophe;
var LEFTPARENTHESIS = TokenType.LeftParenthesis;
var RIGHTPARENTHESIS = TokenType.RightParenthesis;
var ASTERISK = TokenType.Asterisk;
var PLUSSIGN = TokenType.PlusSign;
var COMMA = TokenType.Comma;
var HYPHENMINUS = TokenType.HyphenMinus;
var FULLSTOP = TokenType.FullStop;
var SOLIDUS = TokenType.Solidus;
var COLON = TokenType.Colon;
var SEMICOLON = TokenType.Semicolon;
// var LESSTHANSIGN = TokenType.LessThanSign;
var EQUALSSIGN = TokenType.EqualsSign;
var GREATERTHANSIGN = TokenType.GreaterThanSign;
var QUESTIONMARK = TokenType.QuestionMark;
var COMMERCIALAT = TokenType.CommercialAt;
var LEFTSQUAREBRACKET = TokenType.LeftSquareBracket;
var RIGHTSQUAREBRACKET = TokenType.RightSquareBracket;
var CIRCUMFLEXACCENT = TokenType.CircumflexAccent;
var LOWLINE = TokenType.LowLine;
var LEFTCURLYBRACKET = TokenType.LeftCurlyBracket;
var VERTICALLINE = TokenType.VerticalLine;
var RIGHTCURLYBRACKET = TokenType.RightCurlyBracket;
var TILDE = TokenType.Tilde;

var SCOPE_ATRULE_EXPRESSION = {
    url: getUri
};
var SCOPE_SELECTOR = {
    url: getUri,
    not: getNotFunction
};
var SCOPE_VALUE = {
    url: getUri,
    expression: getOldIEExpression,
    var: getVarFunction
};

var initialContext = {
    stylesheet: getStylesheet,
    atrule: getAtrule,
    atruleExpression: getAtruleExpression,
    ruleset: getRuleset,
    selector: getSelector,
    simpleSelector: getSimpleSelector,
    block: getBlock,
    declaration: getDeclaration,
    value: getValue
};

var blockMode = {
    'declaration': true,
    'property': true
};

function cmpTokenValue(token, referenceStr, caseSensetive) {
    return cmpStr(scanner.source, token.start, token.end, referenceStr, caseSensetive);
}

function getTokenValue(token) {
    return scanner.source.substring(token.start, token.end);
}

function parseError(message) {
    var error = new Error(message);
    error.name = 'CssSyntaxError';

    if (scanner.token !== null) {
        error.parseError = {
            offset: scanner.token.start,
            line: scanner.token.line,
            column: scanner.token.column
        };
    } else {
        error.parseError = scanner.findLastNonSpaceLocation();
    }

    throw error;
}

function eat(tokenType) {
    if (scanner.token !== null && scanner.token.type === tokenType) {
        scanner.next();
        return true;
    }

    parseError(TokenName[tokenType] + ' is expected');
}

function expectIdentifier(name, eat) {
    if (scanner.token !== null) {
        if (scanner.token.type === IDENTIFIER &&
            cmpTokenValue(scanner.token, name)) {
            if (eat) {
                scanner.next();
            }

            return true;
        }
    }

    parseError('Identifier `' + name + '` is expected');
}

function expectAny(what) {
    if (scanner.token !== null) {
        for (var i = 1, type = scanner.token.type; i < arguments.length; i++) {
            if (type === arguments[i]) {
                return true;
            }
        }
    }

    parseError(what + ' is expected');
}

function getInfo() {
    if (needPositions && scanner.token !== null) {
        return {
            source: filename,
            offset: scanner.token.start,
            line: scanner.token.line,
            column: scanner.token.column
        };
    }

    return null;

}

function removeTrailingSpaces(list) {
    while (list.tail !== null) {
        if (list.tail.data.type === 'Space') {
            list.remove(list.tail);
        } else {
            break;
        }
    }
}

function getStylesheet(nested) {
    var child = null;
    var node = {
        type: 'StyleSheet',
        info: getInfo(),
        rules: new List()
    };

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case WHITESPACE:
                scanner.next();
                continue;

            case COMMENT:
                // ignore comments except exclamation comments (i.e. /*! .. */) on top level
                if (nested || scanner.source.charCodeAt(scanner.token.start + 2) !== EXCLAMATIONMARK) {
                    scanner.next();
                    continue;
                }

                child = getComment();
                break;

            case UNKNOWN:
                child = getUnknown();
                break;

            case COMMERCIALAT:
                child = getAtrule();
                break;

            case RIGHTCURLYBRACKET:
                if (!nested) {
                    parseError('Unexpected right curly brace');
                }

                break scan;

            default:
                child = getRuleset();
        }

        node.rules.appendData(child);
    }

    return node;
}

// '//' ...
// TODO: remove it as wrong thing
function getUnknown() {
    var info = getInfo();
    var value = getTokenValue(scanner.token);

    eat(UNKNOWN);

    return {
        type: 'Unknown',
        info: info,
        value: value
    };
}

function isBlockAtrule() {
    for (var offset = 1, cursor; cursor = scanner.lookup(offset); offset++) {
        var type = cursor.type;

        if (type === RIGHTCURLYBRACKET) {
            return true;
        }

        if (type === LEFTCURLYBRACKET ||
            type === COMMERCIALAT) {
            return false;
        }
    }

    return true;
}

function getAtruleExpression() {
    var list = new List();
    var child = null;
    var node = {
        type: 'AtruleExpression',
        info: getInfo(),
        sequence: list
    };

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case SEMICOLON:
                break scan;

            case LEFTCURLYBRACKET:
                break scan;

            case WHITESPACE:
                // ignore spaces in the beginning
                if (list.isEmpty()) {
                    scanner.next();
                    continue;
                }

                child = getS();
                break;

            case COMMENT: // ignore comments
                scanner.next();
                continue;

            case COMMA:
                child = getOperator();
                break;

            case COLON:
                child = getPseudo();
                break;

            case LEFTPARENTHESIS:
                child = getBraces(SCOPE_ATRULE_EXPRESSION);
                break;

            default:
                child = getAny(SCOPE_ATRULE_EXPRESSION);
        }

        list.appendData(child);
    }

    removeTrailingSpaces(list);

    return node;
}

function getAtrule() {
    eat(COMMERCIALAT);

    var node = {
        type: 'Atrule',
        info: getInfo(),
        name: readIdent(false),
        expression: getAtruleExpression(),
        block: null
    };

    if (scanner.token !== null) {
        switch (scanner.token.type) {
            case SEMICOLON:
                scanner.next();  // {
                break;

            case LEFTCURLYBRACKET:
                scanner.next();  // {

                if (isBlockAtrule()) {
                    node.block = getBlock();
                } else {
                    node.block = getStylesheet(true);
                }

                eat(RIGHTCURLYBRACKET);
                break;

            default:
                parseError('Unexpected input');
        }
    }

    return node;
}

function getRuleset() {
    return {
        type: 'Ruleset',
        info: getInfo(),
        selector: getSelector(),
        block: getBlockWithBrackets()
    };
}

function getSelector() {
    var simpleSelector;
    var isBadSelector = false;
    var lastComma = true;
    var node = {
        type: 'Selector',
        info: getInfo(),
        selectors: new List()
    };

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case LEFTCURLYBRACKET:
                break scan;

            case COMMA:
                if (lastComma) {
                    isBadSelector = true;
                }

                lastComma = true;
                scanner.next();
                break;

            default:
                if (!lastComma) {
                    isBadSelector = true;
                }

                lastComma = false;
                simpleSelector = getSimpleSelector();
                node.selectors.appendData(simpleSelector);

                if (simpleSelector.sequence.isEmpty()) {
                    isBadSelector = true;
                }
        }
    }

    if (lastComma) {
        isBadSelector = true;
        // parseError('Unexpected trailing comma');
    }

    if (isBadSelector) {
        node.selectors = new List();
    }

    return node;
}

function getSimpleSelector(nested) {
    var combinator = null;
    var list = new List();
    var child = null;
    var node = {
        type: 'SimpleSelector',
        info: getInfo(),
        sequence: list
    };

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case COMMA:
                break scan;

            case LEFTCURLYBRACKET:
                if (nested) {
                    parseError('Unexpected input');
                }

                break scan;

            case RIGHTPARENTHESIS:
                if (!nested) {
                    parseError('Unexpected input');
                }

                break scan;

            case COMMENT:
                scanner.next();
                continue;

            case WHITESPACE:
                if (combinator === null && list.head !== null) {
                    combinator = getCombinator();
                } else {
                    scanner.next();
                }
                continue;

            case PLUSSIGN:
            case GREATERTHANSIGN:
            case TILDE:
            case SOLIDUS:
                if (combinator !== null && combinator.name !== ' ') {
                    parseError('Unexpected combinator');
                }

                combinator = getCombinator();
                continue;

            case FULLSTOP:
                child = getClass();
                break;

            case LEFTSQUAREBRACKET:
                child = getAttribute();
                break;

            case NUMBERSIGN:
                child = getShash();
                break;

            case COLON:
                child = getPseudo();
                break;

            case LOWLINE:
            case IDENTIFIER:
            case ASTERISK:
                child = getNamespacedIdentifier(false);
                break;

            case HYPHENMINUS:
            case DECIMALNUMBER:
                child = tryGetPercentage() || getNamespacedIdentifier(false);
                break;

            default:
                parseError('Unexpected input');
        }

        if (combinator !== null) {
            list.appendData(combinator);
            combinator = null;
        }

        list.appendData(child);
    }

    if (combinator && combinator.name !== ' ') {
        parseError('Unexpected combinator');
    }

    return node;
}

function getDeclarations() {
    var declarations = new List();

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case RIGHTCURLYBRACKET:
                break scan;

            case WHITESPACE:
            case COMMENT:
            case SEMICOLON:
                scanner.next();
                break;

            default:
                declarations.appendData(getDeclaration());
        }
    }

    return declarations;
}

function getBlockWithBrackets() {
    var info = getInfo();
    var node;

    eat(LEFTCURLYBRACKET);
    node = {
        type: 'Block',
        info: info,
        declarations: getDeclarations()
    };
    eat(RIGHTCURLYBRACKET);

    return node;
}

function getBlock() {
    return {
        type: 'Block',
        info: getInfo(),
        declarations: getDeclarations()
    };
}

function getDeclaration(nested) {
    var info = getInfo();
    var property = getProperty();
    var name = property.name;
    var value;

    eat(COLON);

    // check it's a filter
    if (cmpStr(name, name.length - 6, name.length, 'filter') && checkProgid()) {
        value = getFilterValue();
    } else {
        value = getValue(nested);
    }

    return {
        type: 'Declaration',
        info: info,
        property: property,
        value: value
    };
}

function getProperty() {
    var start = scanner.token !== null ? scanner.token.start : 0;
    var end = start;
    var node = {
        type: 'Property',
        info: getInfo(),
        name: null
    };

    for (; scanner.token !== null; scanner.next()) {
        var type = scanner.token.type;

        if (type !== SOLIDUS &&
            type !== ASTERISK &&
            type !== DOLLARSIGN) {
            break;
        }

        end = scanner.token.end;
    }

    node.name = scanner.source.substring(start, end + getIdentLen(true));

    readSC();

    return node;
}

function getValue(nested) {
    var list = new List();
    var child = null;
    var node = {
        type: 'Value',
        info: getInfo(),
        important: false,
        sequence: list
    };

    readSC();

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case RIGHTCURLYBRACKET:
            case SEMICOLON:
                break scan;

            case RIGHTPARENTHESIS:
                if (!nested) {
                    parseError('Unexpected input');
                }
                break scan;

            case WHITESPACE:
                child = getS();
                break;

            case COMMENT: // ignore comments
                scanner.next();
                continue;

            case NUMBERSIGN:
                child = getVhash();
                break;

            case SOLIDUS:
            case COMMA:
                child = getOperator();
                break;

            case LEFTPARENTHESIS:
            case LEFTSQUAREBRACKET:
                child = getBraces(SCOPE_VALUE);
                break;

            case EXCLAMATIONMARK:
                node.important = getImportant();
                continue;

            default:
                // check for unicode range: U+0F00, U+0F00-0FFF, u+0F00??
                var start = scanner.token.start;
                if (scanner.token.type === IDENTIFIER) {
                    if (cmpTokenValue(scanner.token, 'u') && scanner.lookupType(1, PLUSSIGN)) {
                        var info = getInfo();
                        scanner.next(); // U or u
                        scanner.next(); // +

                        child = {
                            type: 'Identifier',
                            info: info,
                            name: scanner.source.substr(start, 2 + readUnicodeRange(true))
                        };

                        break;
                    }
                }

                child = getAny(SCOPE_VALUE);
        }

        list.appendData(child);
    }

    removeTrailingSpaces(list);

    return node;
}

// any = string | percentage | dimension | number | uri | functionExpression | funktion | unary | operator | ident
function getAny(scope) {
    switch (scanner.token.type) {
        case STRING:
            return getString();

        case LOWLINE:
        case IDENTIFIER:
            break;

        case FULLSTOP:
        case DECIMALNUMBER:
        case HYPHENMINUS:
        case PLUSSIGN:
            var number = tryGetNumber();

            if (number !== null) {
                if (scanner.token !== null) {
                    if (scanner.token.type === PERCENTSIGN) {
                        return getPercentage(number);
                    } else if (scanner.token.type === IDENTIFIER) {
                        return getDimension(number.value);
                    }
                }

                return number;
            }

            if (scanner.token.type === HYPHENMINUS) {
                var next = scanner.lookup(1);
                if (next !== null && (next.type === IDENTIFIER || next.type === HYPHENMINUS)) {
                    break;
                }
            }

            if (scanner.token.type === HYPHENMINUS ||
                scanner.token.type === PLUSSIGN) {
                return getOperator();
            }

            parseError('Unexpected input');

        default:
            parseError('Unexpected input');
    }

    var ident = getIdentifier(false);

    if (scanner.token !== null && scanner.token.type === LEFTPARENTHESIS) {
        return getFunction(scope, ident);
    }

    return ident;
}

function readAttrselector() {
    expectAny('Attribute selector (=, ~=, ^=, $=, *=, |=)',
        EQUALSSIGN,        // =
        TILDE,             // ~=
        CIRCUMFLEXACCENT,  // ^=
        DOLLARSIGN,        // $=
        ASTERISK,          // *=
        VERTICALLINE       // |=
    );

    var start = scanner.token.start;

    if (scanner.token.type === EQUALSSIGN) {
        scanner.next();
    } else {
        scanner.next();
        eat(EQUALSSIGN);
    }

    return scanner.source.substring(start, scanner.token !== null ? scanner.token.start : scanner.pos);
}

// '[' S* attrib_name ']'
// '[' S* attrib_name S* attrib_match S* [ IDENT | STRING ] S* attrib_flags? S* ']'
function getAttribute() {
    var node = {
        type: 'Attribute',
        info: getInfo(),
        name: null,
        operator: null,
        value: null,
        flags: null
    };

    eat(LEFTSQUAREBRACKET);

    readSC();

    node.name = getNamespacedIdentifier(true);

    readSC();

    if (scanner.token !== null && scanner.token.type !== RIGHTSQUAREBRACKET) {
        // avoid case `[name i]`
        if (scanner.token.type !== IDENTIFIER) {
            node.operator = readAttrselector();

            readSC();

            if (scanner.token !== null && scanner.token.type === STRING) {
                node.value = getString();
            } else {
                node.value = getIdentifier(false);
            }

            readSC();
        }

        // attribute flags
        if (scanner.token !== null && scanner.token.type === IDENTIFIER) {
            node.flags = getTokenValue(scanner.token);

            scanner.next();
            readSC();
        }
    }

    eat(RIGHTSQUAREBRACKET);

    return node;
}

function getBraces(scope) {
    var close;
    var list = new List();
    var child = null;
    var node = {
        type: 'Braces',
        info: getInfo(),
        open: null,
        close: null,
        sequence: list
    };

    if (scanner.token.type === LEFTPARENTHESIS) {
        close = RIGHTPARENTHESIS;
        node.open = '(';
        node.close = ')';
    } else {
        close = RIGHTSQUAREBRACKET;
        node.open = '[';
        node.close = ']';
    }

    // left brace
    scanner.next();

    readSC();

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case close:
                break scan;

            case WHITESPACE:
                child = getS();
                break;

            case COMMENT:
                scanner.next();
                continue;

            case NUMBERSIGN: // ??
                child = getVhash();
                break;

            case LEFTPARENTHESIS:
            case LEFTSQUAREBRACKET:
                child = getBraces(scope);
                break;

            case SOLIDUS:
            case ASTERISK:
            case COMMA:
            case COLON:
                child = getOperator();
                break;

            default:
                child = getAny(scope);
        }

        list.appendData(child);
    }

    removeTrailingSpaces(list);

    // right brace
    eat(close);

    return node;
}

// '.' ident
function getClass() {
    var info = getInfo();

    eat(FULLSTOP);

    return {
        type: 'Class',
        info: info,
        name: readIdent(false)
    };
}

// '#' ident
function getShash() {
    var info = getInfo();

    eat(NUMBERSIGN);

    return {
        type: 'Id',
        info: info,
        name: readIdent(false)
    };
}

// + | > | ~ | /deep/
function getCombinator() {
    var info = getInfo();
    var combinator;

    switch (scanner.token.type) {
        case WHITESPACE:
            combinator = ' ';
            scanner.next();
            break;

        case PLUSSIGN:
        case TILDE:
        case GREATERTHANSIGN:
            combinator = getTokenValue(scanner.token);
            scanner.next();
            break;

        case SOLIDUS:
            combinator = '/deep/';
            scanner.next();

            expectIdentifier('deep', true);

            eat(SOLIDUS);
            break;

        default:
            parseError('Combinator (+, >, ~, /deep/) is expected');
    }

    return {
        type: 'Combinator',
        info: info,
        name: combinator
    };
}

// '/*' .* '*/'
function getComment() {
    var info = getInfo();
    var start = scanner.token.start + 2;
    var end = scanner.token.end;

    if ((end - start) >= 2 &&
        scanner.source.charCodeAt(end - 2) === ASTERISK &&
        scanner.source.charCodeAt(end - 1) === SOLIDUS) {
        end -= 2;
    }

    scanner.next();

    return {
        type: 'Comment',
        info: info,
        value: scanner.source.substring(start, end)
    };
}

// special reader for units to avoid adjoined IE hacks (i.e. '1px\9')
function readUnit() {
    var token = scanner.token;

    if (token === null || token.type !== IDENTIFIER) {
        parseError('Identifier is expected');
    }

    for (var i = token.start; i < token.end; i++) {
        if (scanner.source.charCodeAt(i) === BACK_SLASH) {
            // patch token
            token.start = i;
            token.column += i - token.start;
            // return part before backslash
            return scanner.source.substr(token.start, i);
        }
    }

    // no backslash in unit name
    var unit = getTokenValue(token);

    scanner.next();

    return unit;
}

// number ident
function getDimension(number) {
    return {
        type: 'Dimension',
        info: getInfo(),
        value: number || readNumber(),
        unit: readUnit()
    };
}

// number "%"
function tryGetPercentage() {
    var number = tryGetNumber();

    if (number && scanner.token !== null && scanner.token.type === PERCENTSIGN) {
        return getPercentage(number);
    }

    return null;
}

function getPercentage(number) {
    var info;

    if (!number) {
        info = getInfo();
        number = readNumber();
    } else {
        info = number.info;
        number = number.value;
    }

    eat(PERCENTSIGN);

    return {
        type: 'Percentage',
        info: info,
        value: number
    };
}

// ident '(' functionBody ')' |
// not '(' <simpleSelector>* ')'
function getFunction(scope, ident) {
    var defaultArguments = getFunctionArguments;

    if (!ident) {
        ident = getIdentifier(false);
    }

    // parse special functions
    var name = ident.name.toLowerCase();

    if (scope != null) {
        if (scope.hasOwnProperty(name)) {
            return scope[name](scope, ident);
        }
    }

    return getFunctionInternal(defaultArguments, scope, ident);
}

function getFunctionInternal(functionArgumentsReader, scope, ident) {
    var args;

    eat(LEFTPARENTHESIS);
    args = functionArgumentsReader(scope);
    eat(RIGHTPARENTHESIS);

    return {
        type: scope === SCOPE_SELECTOR ? 'FunctionalPseudo' : 'Function',
        info: ident.info,
        name: ident.name,
        arguments: args
    };
}

function getFunctionArguments(scope) {
    var args = new List();
    var argument = null;
    var child = null;

    readSC();

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case RIGHTPARENTHESIS:
                break scan;

            case WHITESPACE:
                child = getS();
                break;

            case COMMENT: // ignore comments
                scanner.next();
                continue;

            case NUMBERSIGN: // TODO: not sure it should be here
                child = getVhash();
                break;

            case LEFTPARENTHESIS:
            case LEFTSQUAREBRACKET:
                child = getBraces(scope);
                break;

            case COMMA:
                removeTrailingSpaces(argument.sequence);
                scanner.next();
                readSC();
                argument = null;
                continue;

            case SOLIDUS:
            case ASTERISK:
            case COLON:
            case EQUALSSIGN:
                child = getOperator();
                break;

            default:
                child = getAny(scope);
        }

        if (argument === null) {
            argument = {
                type: 'Argument',
                sequence: new List()
            };

            args.appendData(argument);
        }

        argument.sequence.appendData(child);
    }

    if (argument !== null) {
        removeTrailingSpaces(argument.sequence);
    }

    return args;
}

function getVarFunction(scope, ident) {
    return getFunctionInternal(getVarFunctionArguments, scope, ident);
}

function getNotFunctionArguments() {
    var args = new List();
    var wasSelector = false;

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case RIGHTPARENTHESIS:
                if (!wasSelector) {
                    parseError('Simple selector is expected');
                }

                break scan;

            case COMMA:
                if (!wasSelector) {
                    parseError('Simple selector is expected');
                }

                wasSelector = false;
                scanner.next();
                break;

            default:
                wasSelector = true;
                args.appendData(getSimpleSelector(true));
        }
    }

    return args;
}

function getNotFunction(scope, ident) {
    var args;

    eat(LEFTPARENTHESIS);
    args = getNotFunctionArguments(scope);
    eat(RIGHTPARENTHESIS);

    return {
        type: 'Negation',
        info: ident.info,
        // name: ident.name,  // TODO: add name?
        sequence: args        // FIXME: -> arguments?
    };
}

// var '(' ident (',' <declaration-value>)? ')'
function getVarFunctionArguments() { // TODO: special type Variable?
    var args = new List();

    readSC();

    args.appendData({
        type: 'Argument',
        sequence: new List().appendData(getIdentifier(true))
    });

    readSC();

    if (scanner.token !== null && scanner.token.type === COMMA) {
        eat(COMMA);
        readSC();

        args.appendData({
            type: 'Argument',
            sequence: new List().appendData(getValue(true))
        });

        readSC();
    }

    return args;
}

// url '(' ws* (string | raw) ws* ')'
function getUri(scope, ident) {
    var node = {
        type: 'Url',
        info: ident.info,
        // name: ident.name,
        value: null
    };

    eat(LEFTPARENTHESIS); // (

    readSC();

    if (scanner.token.type === STRING) {
        node.value = getString();
        readSC();
    } else {
        var rawInfo = getInfo();
        var start = scanner.token.start;
        var end = scanner.token.end;

        for (; scanner.token !== null; scanner.next()) {
            var type = scanner.token.type;

            if (type === WHITESPACE ||
                type === LEFTPARENTHESIS ||
                type === RIGHTPARENTHESIS) {
                break;
            }

            end = scanner.token.end;
        }

        node.value = {
            type: 'Raw',
            info: rawInfo,
            value: scanner.source.substring(start, end)
        };

        readSC();
    }

    eat(RIGHTPARENTHESIS); // )

    return node;
}

// expression '(' raw ')'
function getOldIEExpression(scope, ident) {
    eat(LEFTPARENTHESIS);

    var balance = 0;
    var start = scanner.token.start;
    var end = start;

    for (; scanner.token !== null; scanner.next()) {
        if (scanner.token.type === RIGHTPARENTHESIS) {
            if (balance === 0) {
                break;
            }

            balance--;
        } else if (scanner.token.type === LEFTPARENTHESIS) {
            balance++;
        }

        end = scanner.token.end;
    }

    eat(RIGHTPARENTHESIS);

    return {
        type: 'Function',
        info: ident.info,
        name: ident.name,
        arguments: new List().appendData({
            type: 'Argument',
            sequence: new List().appendData({
                type: 'Raw',
                value: scanner.source.substring(start, end)
            })
        })
    };
}

function readUnicodeRange(tryNext) {
    var hexStart = scanner.token.start;
    var hexLength = 0;

    for (; scanner.token !== null; scanner.next()) {
        if (scanner.token.type !== DECIMALNUMBER &&
            scanner.token.type !== IDENTIFIER) {
            break;
        }

        hexLength += scanner.token.end - scanner.token.start;
    }

    if (hexLength === 0 || hexLength > 6) {
        parseError('Unexpected input');
    }

    // validate hex
    for (var i = 0; i < hexLength; i++) {
        if (scanner.isHex(scanner.source.charCodeAt(hexStart + i)) === false) {
            parseError('Unexpected input');
        }
    }

    // U+abc???
    if (tryNext) {
        for (; hexLength < 6 && scanner.token !== null; scanner.next()) {
            if (scanner.token.type !== QUESTIONMARK) {
                break;
            }

            hexLength++;
            tryNext = false;
        }
    }

    // U+aaa-bbb
    if (tryNext) {
        if (scanner.token !== null && scanner.token.type === HYPHENMINUS) {
            scanner.next();

            var next = readUnicodeRange(false);

            if (next === 0) {
                parseError('Unexpected input');
            }

            hexLength += 1 + next;
        }
    }

    return hexLength;
}

function getIdentLen(varAllowed) {
    var start = scanner.token !== null ? scanner.token.start : 0;
    var end;

    // optional first -
    if (scanner.token !== null && scanner.token.type === HYPHENMINUS) {
        scanner.next();

        if (varAllowed && scanner.token !== null && scanner.token.type === HYPHENMINUS) {
            scanner.next();
        }
    }

    expectAny('Identifier',
        LOWLINE,
        IDENTIFIER
    );

    end = scanner.token.end;
    scanner.next();

    for (; scanner.token !== null; scanner.next()) {
        var type = scanner.token.type;

        if (type !== LOWLINE &&
            type !== IDENTIFIER &&
            type !== DECIMALNUMBER &&
            type !== HYPHENMINUS) {
            break;
        }

        end = scanner.token.end;
    }

    return end - start;
}

function readIdent(varAllowed) {
    var start = scanner.token !== null ? scanner.token.start : 0;
    var len = getIdentLen(varAllowed);

    if (len !== 0) {
        return scanner.source.substr(start, len);
    }

    return '';
}

function getNamespacedIdentifier(checkColon) {
    if (scanner.token === null) {
        parseError('Unexpected end of input');
    }

    var info = getInfo();
    var start = scanner.token.start;
    var len = 0;

    if (scanner.token.type === ASTERISK) {
        checkColon = false;
        len++;
        scanner.next();
    } else {
        len = getIdentLen(false);
    }

    if (scanner.token !== null) {
        if (scanner.token.type === VERTICALLINE &&
            scanner.lookupType(1, EQUALSSIGN) === false) {
            len++;

            if (scanner.next() !== null) {
                if (scanner.token.type === HYPHENMINUS ||
                    scanner.token.type === IDENTIFIER ||
                    scanner.token.type === LOWLINE) {
                    len += getIdentLen(false);
                } else if (scanner.token.type === ASTERISK) {
                    checkColon = false;
                    len++;
                    scanner.next();
                }
            }
        }
    }

    if (checkColon && scanner.token !== null && scanner.token.type === COLON) {
        scanner.next();
        len += 1 + getIdentLen(false);
    }

    return {
        type: 'Identifier',
        info: info,
        name: scanner.source.substr(start, len)
    };
}

function getIdentifier(varAllowed) {
    return {
        type: 'Identifier',
        info: getInfo(),
        name: readIdent(varAllowed)
    };
}

// ! ws* important
function getImportant() { // TODO?
    // var info = getInfo();

    eat(EXCLAMATIONMARK);

    readSC();

    // return {
    //     type: 'Identifier',
    //     info: info,
    //     name: readIdent(false)
    // };

    expectIdentifier('important');

    readIdent(false);

    // should return identifier in future for original source restoring as is
    // returns true for now since it's fit to optimizer purposes
    return true;
}

// odd | even | number? n
function getNth() {
    expectAny('Number, odd or even',
        IDENTIFIER,
        DECIMALNUMBER
    );

    var info = getInfo();
    var token = scanner.token;
    var start = token.start;
    var end;

    if (token.type === DECIMALNUMBER) {
        var next = scanner.lookup(1);
        if (next !== null &&
            next.type === IDENTIFIER &&
            cmpTokenValue(next, 'n')) {
            scanner.next();
        }
    } else {
        if (cmpTokenValue(token, 'n') === false &&
            cmpTokenValue(token, 'odd') === false &&
            cmpTokenValue(token, 'even') === false) {
            parseError('Unexpected identifier');
        }
    }

    end = scanner.token.end;
    scanner.next();

    return {
        type: 'Nth',
        info: info,
        value: scanner.source.substring(start, end)
    };
}

function getNthSelector() {
    var info = getInfo();
    var sequence = new List();
    var node;
    var child = null;

    eat(COLON);
    expectIdentifier('nth', false);

    node = {
        type: 'FunctionalPseudo',
        info: info,
        name: readIdent(false),
        arguments: new List().appendData({
            type: 'Argument',
            sequence: sequence
        })
    };

    eat(LEFTPARENTHESIS);

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case RIGHTPARENTHESIS:
                break scan;

            case WHITESPACE:
            case COMMENT:
                scanner.next();
                continue;

            case HYPHENMINUS:
            case PLUSSIGN:
                child = getOperator();
                break;

            default:
                child = getNth();
        }

        sequence.appendData(child);
    }

    eat(RIGHTPARENTHESIS);

    return node;
}

function readNumber() {
    var start = scanner.token.start;
    var end = start;
    var wasDigits = false;
    var offset = 0;

    if (scanner.lookupType(offset, HYPHENMINUS)) {
        offset++;
    }

    if (scanner.lookupType(offset, DECIMALNUMBER)) {
        wasDigits = true;
        offset++;
    }

    if (scanner.lookupType(offset, FULLSTOP)) {
        offset++;
    }

    if (scanner.lookupType(offset, DECIMALNUMBER)) {
        wasDigits = true;
        offset++;
    }

    if (wasDigits) {
        while (offset--) {
            end = scanner.token.end;
            scanner.next();
        }

        return scanner.source.substring(start, end);
    }

    return null;
}

function tryGetNumber() {
    var info = getInfo();
    var number = readNumber();

    if (number !== null) {
        return {
            type: 'Number',
            info: info,
            value: number
        };
    }

    return null;
}

// '/' | '*' | ',' | ':' | '=' | '+' | '-'
// TODO: remove '=' since it's wrong operator, but theat as operator
// to make old things like `filter: alpha(opacity=0)` works
function getOperator() {
    var node = {
        type: 'Operator',
        info: getInfo(),
        value: getTokenValue(scanner.token)
    };

    scanner.next();

    return node;
}

function getFilterValue() { // TODO
    var progid;
    var node = {
        type: 'Value',
        info: getInfo(),
        important: false,
        sequence: new List()
    };

    while (progid = checkProgid()) {
        node.sequence.appendData(getProgid(progid));
    }

    readSC(node);

    if (scanner.token !== null && scanner.token.type === EXCLAMATIONMARK) {
        node.important = getImportant();
    }

    return node;
}

// 'progid:' ws* 'DXImageTransform.Microsoft.' ident ws* '(' .* ')'
function checkProgid() {
    function checkSC(offset) {
        for (var cursor; cursor = scanner.lookup(offset); offset++) {
            if (cursor.type !== WHITESPACE &&
                cursor.type !== COMMENT) {
                break;
            }
        }

        return offset;
    }

    var offset = checkSC(0);

    if (scanner.lookup(offset + 1) === null ||
        cmpTokenValue(scanner.lookup(offset), 'progid') === false ||
        scanner.lookup(offset + 1).type !== COLON) {
        return false; // fail
    }

    offset += 2;
    offset = checkSC(offset);

    if (scanner.lookup(offset + 5) === null ||
        cmpTokenValue(scanner.lookup(offset + 0), 'dximagetransform') === false ||
        scanner.lookup(offset + 1).type !== FULLSTOP ||
        cmpTokenValue(scanner.lookup(offset + 2), 'microsoft') === false ||
        scanner.lookup(offset + 3).type !== FULLSTOP ||
        scanner.lookup(offset + 4).type !== IDENTIFIER) {
        return false; // fail
    }

    offset += 5;
    offset = checkSC(offset);

    if (scanner.lookupType(offset, LEFTPARENTHESIS) === false) {
        return false; // fail
    }

    for (var cursor; cursor = scanner.lookup(offset); offset++) {
        if (cursor.type === RIGHTPARENTHESIS) {
            return cursor;
        }
    }

    return false;
}

function getProgid(progidEnd) {
    var node = {
        type: 'Progid',
        info: getInfo(),
        value: null
    };

    if (!progidEnd) {
        progidEnd = checkProgid();
    }

    if (!progidEnd) {
        parseError('progid is expected');
    }

    readSC(node);

    var rawInfo = getInfo();
    var start = scanner.token.start;
    var end;
    for (; scanner.token !== null && scanner.token !== progidEnd; scanner.next()) {
        end = scanner.token.end;
    }

    eat(RIGHTPARENTHESIS);

    node.value = {
        type: 'Raw',
        info: rawInfo,
        value: scanner.source.substring(start, end + 1)
    };

    readSC(node);

    return node;
}

// <pseudo-element> | <nth-selector> | <pseudo-class>
function getPseudo() {
    var next = scanner.lookup(1);

    if (next === null) {
        scanner.next();
        parseError('Colon or identifier is expected');
    }

    if (next.type === COLON) {
        return getPseudoElement();
    }

    if (next.type === IDENTIFIER && cmpTokenValue(next, 'nth')) {
        return getNthSelector();
    }

    return getPseudoClass();
}

// :: ident
function getPseudoElement() {
    var info = getInfo();

    eat(COLON);
    eat(COLON);

    return {
        type: 'PseudoElement',
        info: info,
        name: readIdent(false)
    };
}

// : ( ident | function )
function getPseudoClass() {
    var info = getInfo();
    var ident = eat(COLON) && getIdentifier(false);

    if (scanner.token !== null && scanner.token.type === LEFTPARENTHESIS) {
        return getFunction(SCOPE_SELECTOR, ident);
    }

    return {
        type: 'PseudoClass',
        info: info,
        name: ident.name
    };
}

// ws
function getS() {
    var node = {
        type: 'Space'
    };

    scanner.next();

    return node;
}

function readSC() {
    // var nodes = [];

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case WHITESPACE:
                scanner.next();
                // nodes.push(getS());
                break;

            case COMMENT:
                scanner.next();
                // nodes.push(getComment());
                break;

            default:
                break scan;
        }
    }

    return null;

    // return nodes.length ? new List(nodes) : null;
}

// node: String
function getString() {
    var node = {
        type: 'String',
        info: getInfo(),
        value: getTokenValue(scanner.token)
    };

    scanner.next();

    return node;
}

// # ident
function getVhash() {
    var info = getInfo();
    var start;
    var end;

    eat(NUMBERSIGN);

    expectAny('Number or identifier',
        DECIMALNUMBER,
        IDENTIFIER
    );

    start = scanner.token.start;
    end = scanner.token.end;

    if (scanner.token.type === DECIMALNUMBER &&
        scanner.lookupType(1, IDENTIFIER)) {
        scanner.next();
        end = scanner.token.end;
    }

    scanner.next();

    return {
        type: 'Hash',
        info: info,
        value: scanner.source.substring(start, end)
    };
}

function parse(source, options) {
    var ast;

    if (!options || typeof options !== 'object') {
        options = {};
    }

    var context = options.context || 'stylesheet';
    needPositions = Boolean(options.positions);
    filename = options.filename || '<unknown>';

    if (!initialContext.hasOwnProperty(context)) {
        throw new Error('Unknown context `' + context + '`');
    }

    scanner = new Scanner(source, blockMode.hasOwnProperty(context), options.line, options.column);
    scanner.next();
    ast = initialContext[context]();

    scanner = null;

    // console.log(JSON.stringify(ast, null, 4));
    return ast;
};

// warm up parse to elimitate code branches that never execute
// fix soft deoptimizations (insufficient type feedback)
parse('a.b#c:e:NOT(a)::g,* b>c+d~e/deep/f{v:1 2em t a(2%, var(--a)) url(..) -foo-bar !important}');

module.exports = parse;
