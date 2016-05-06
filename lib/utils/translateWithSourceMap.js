var SourceMapGenerator = require('source-map').SourceMapGenerator;
var SourceNode = require('source-map').SourceNode;
var createHandlers = require('./translateHandlers');

// Our own implementation of SourceNode#toStringWithSourceMap,
// since SourceNode doesn't allow multiple references to original source.
// Also, as we know structure of result we could be optimize generation
// (currently it's ~40% faster).
function walk(node, fn) {
    for (var chunk, i = 0; i < node.children.length; i++) {
        chunk = node.children[i];

        if (chunk instanceof SourceNode) {
            // this is a hack, because source maps doesn't support for 1(generated):N(original)
            // if (chunk.merged) {
            //     fn('', chunk);
            // }

            walk(chunk, fn);
        } else {
            fn(chunk, node);
        }
    }
}

function generateSourceMap(root) {
    var map = new SourceMapGenerator();
    var css = '';
    var sourceMappingActive = false;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastIndexOfNewline;
    var generated = {
        line: 1,
        column: 0
    };
    var activatedMapping = {
        generated: generated
    };

    walk(root, function(chunk, original) {
        if (original.line !== null &&
            original.column !== null) {
            if (lastOriginalLine !== original.line ||
                lastOriginalColumn !== original.column) {
                map.addMapping({
                    source: original.source,
                    original: original,
                    generated: generated
                });
            }

            lastOriginalLine = original.line;
            lastOriginalColumn = original.column;
            sourceMappingActive = true;
        } else if (sourceMappingActive) {
            map.addMapping(activatedMapping);
            sourceMappingActive = false;
        }

        css += chunk;

        lastIndexOfNewline = chunk.lastIndexOf('\n');
        if (lastIndexOfNewline !== -1) {
            generated.line += chunk.match(/\n/g).length;
            generated.column = chunk.length - lastIndexOfNewline - 1;
        } else {
            generated.column += chunk.length;
        }
    });

    return {
        css: css,
        map: map
    };
}

function createAnonymousSourceNode(children) {
    return new SourceNode(
        null,
        null,
        null,
        children
    );
}

function createSourceNode(info, children) {
    if (info.primary) {
        // special marker node to add several references to original
        // var merged = createSourceNode(info.merged, []);
        // merged.merged = true;
        // children.unshift(merged);

        // use recursion, because primary can also has a primary/merged info
        return createSourceNode(info.primary, children);
    }

    return new SourceNode(
        info.line,
        info.column - 1,
        info.source,
        children
    );
}

function anonymousSourceNode(handler, delimeter) {
    return function(node, translate) {
        return createAnonymousSourceNode(handler(node, translate));
    };
}

function sourceNode(handler) {
    return function(node, translate) {
        return createSourceNode(node.info, handler(node, translate));
    };
}

function list(handler, delimeter) {
    return function(node, translate) {
        return createAnonymousSourceNode(handler(node, translate)).join(delimeter);
    };
}

function translate(node) {
    if (handlers.hasOwnProperty(node.type)) {
        return handlers[node.type](node, translate);
    }

    throw new Error('Unknown node type: ' + node.type);
}

var handlers = createHandlers();
handlers.StyleSheet = anonymousSourceNode(handlers.StyleSheet);
handlers.Atrule = sourceNode(handlers.Atrule);
handlers.Ruleset = anonymousSourceNode(handlers.Ruleset);
handlers.Selector = list(handlers.Selector, ',');
handlers.SimpleSelector = sourceNode(handlers.SimpleSelector);
handlers.Block = list(handlers.Block, ';');
handlers.Declaration = sourceNode(handlers.Declaration);

module.exports = function(node) {
    return generateSourceMap(
        createAnonymousSourceNode(translate(node))
    );
};
