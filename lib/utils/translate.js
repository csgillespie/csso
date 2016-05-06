var createHandlers = require('./translateHandlers');

function join(handler, delimeter) {
    return function(node, translate) {
        return handler(node, translate).join(delimeter);
    };
}

var handlers = createHandlers();
handlers.StyleSheet = join(handlers.StyleSheet, '');
handlers.Atrule = join(handlers.Atrule, '');
handlers.Ruleset = join(handlers.Ruleset, '');
handlers.Selector = join(handlers.Selector, ',');
handlers.SimpleSelector = join(handlers.SimpleSelector, '');
handlers.Block = join(handlers.Block, ';');
handlers.Declaration = join(handlers.Declaration, '');

module.exports = function translate(node) {
    if (handlers.hasOwnProperty(node.type)) {
        return handlers[node.type](node, translate);
    }

    throw new Error('Unknown node type: ' + node.type);
};
