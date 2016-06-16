var BOM = String.fromCharCode(0xFEFF);
var path = require('path');
var assert = require('assert');
var csso = require('../lib/index');
var JsonLocator = require('./helpers/JsonLocator');
var forEachParseTest = require('./fixture/parse').forEachTest;
var stringify = require('./helpers/stringify');

function createParseErrorTest(location, test, options) {
    it(location + ' ' + JSON.stringify(test.css), function() {
        var error;

        assert.throws(function() {
            csso.parse(test.css, options);
        }, function(e) {
            error = e;
            if (e.parseError) {
                return true;
            }
        }, 'Should be CSS parse error');

        assert.equal(error.message, test.error);
        assert.deepEqual(error.parseError, test.position);
    });
}

function createPositionsTest(css, expected, initLine, initColumn) {
    return function() {
        var positions = [];
        var ast = csso.parse(css, {
            positions: true,
            line: initLine,
            column: initColumn
        });

        csso.walk(ast, function(node) {
            positions.unshift([node.info.line, node.info.column, node.type]);
        });

        assert.deepEqual(positions, expected);
    };
}

describe('parse', function() {
    forEachParseTest(function createParseTest(name, test, context) {
        (test.skip ? it.skip : it)(name, function() {
            var ast = csso.parse(test.source, {
                context: context
            });

            // AST should be equal
            assert.equal(stringify(ast), stringify(test.ast));

            // translated AST should be equal to original source
            assert.equal(csso.translate(ast), 'translate' in test ? test.translate : test.source);
        });
    });
});

describe('parse error', function() {
    var filename = __dirname + '/fixture/parse-errors.json';
    var tests = require(filename);
    var locator = new JsonLocator(filename);

    filename = path.relative(__dirname + '/..', filename);

    for (var key in tests) {
        tests[key].name = locator.get(key);
    }

    tests.forEach(function(test) {
        createParseErrorTest(filename, test);
        createParseErrorTest(filename + ' (with positions)', test, {
            positions: true
        });
    });
});

describe('positions', function() {
    var css = '.foo.bar {\n  property: value;\n}';

    describe('should start with line 1 column 1 by default', function() {
        var positions = [
            [1, 1, 'StyleSheet'],
            [1, 1, 'Ruleset'],
            [1, 10, 'Block'],
            [2, 3, 'Declaration'],
            [2, 12, 'Value'],
            [2, 13, 'Identifier'],
            [2, 3, 'Property'],
            [1, 1, 'Selector'],
            [1, 1, 'SimpleSelector'],
            [1, 5, 'Class'],
            [1, 1, 'Class']
        ];

        it('regular', createPositionsTest(css, positions));
        it('with BOM', createPositionsTest(BOM + css, positions));
    });

    it('should start with line 1 and specified column', function() {
        var positions = [
            [1, 5, 'StyleSheet'],
            [1, 5, 'Ruleset'],
            [1, 14, 'Block'],
            [2, 3, 'Declaration'],
            [2, 12, 'Value'],
            [2, 13, 'Identifier'],
            [2, 3, 'Property'],
            [1, 5, 'Selector'],
            [1, 5, 'SimpleSelector'],
            [1, 9, 'Class'],
            [1, 5, 'Class']
        ];

        it('regular', createPositionsTest(css, positions, undefined, 5));
        it('with BOM', createPositionsTest(BOM + css, positions, undefined, 5));
    });

    it('should start with specified line and column', function() {
        var positions = [
            [3, 5, 'StyleSheet'],
            [3, 5, 'Ruleset'],
            [3, 14, 'Block'],
            [4, 3, 'Declaration'],
            [4, 12, 'Value'],
            [4, 13, 'Identifier'],
            [4, 3, 'Property'],
            [3, 5, 'Selector'],
            [3, 5, 'SimpleSelector'],
            [3, 9, 'Class'],
            [3, 5, 'Class']
        ];

        it('regular', createPositionsTest(css, positions, 3, 5));
        it('with BOM', createPositionsTest(BOM + css, positions, 3, 5));
    });

    it('should start with specified line and column 1', function() {
        var positions = [
            [3, 1, 'StyleSheet'],
            [3, 1, 'Ruleset'],
            [3, 10, 'Block'],
            [4, 3, 'Declaration'],
            [4, 12, 'Value'],
            [4, 13, 'Identifier'],
            [4, 3, 'Property'],
            [3, 1, 'Selector'],
            [3, 1, 'SimpleSelector'],
            [3, 5, 'Class'],
            [3, 1, 'Class']
        ];

        it('regular', createPositionsTest(css, positions, 3));
        it('with BOM', createPositionsTest(BOM + css, positions, 3));
    });
});
