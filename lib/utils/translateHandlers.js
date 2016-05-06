function each(translate, list) {
    return eachDelim(translate, list, '');
}

function eachDelim(translate, list, delimeter) {
    if (list.head === null) {
        return '';
    }

    if (list.head === list.tail) {
        return translate(list.head.data);
    }

    return list.map(translate).join(delimeter);
}

module.exports = function createHandlers() {
    return {
        StyleSheet: function(node, translate) {
            return node.rules.map(translate);
        },

        Atrule: function(node, translate) {
            var nodes = ['@', node.name];

            if (node.expression && !node.expression.sequence.isEmpty()) {
                nodes.push(' ', translate(node.expression));
            }

            if (node.block) {
                nodes.push('{', translate(node.block), '}');
            } else {
                nodes.push(';');
            }

            return nodes;
        },

        Ruleset: function(node, translate) {
            return [
                translate(node.selector), '{', translate(node.block), '}'
            ];
        },

        Selector: function(node, translate) {
            return node.selectors.map(translate);
        },

        SimpleSelector: function(node, translate) {
            return node.sequence.map(function(node) {
                // add extra spaces around /deep/ combinator since comment beginning/ending may to be produced
                if (node.type === 'Combinator' && node.name === '/deep/') {
                    return ' ' + translate(node) + ' ';
                }

                return translate(node);
            });
        },

        Block: function(node, translate) {
            return node.declarations.map(translate);
        },

        Declaration: function(node, translate) {
            return [
                translate(node.property), ':', translate(node.value)
            ];
        },

        Property: function(node) {
            return node.name;
        },

        Value: function(node, translate) {
            return node.important
                ? each(translate, node.sequence) + '!important'
                : each(translate, node.sequence);
        },

        Attribute: function(node, translate) {
            var result = translate(node.name);

            if (node.operator !== null) {
                result += node.operator;

                if (node.value !== null) {
                    result += translate(node.value);

                    if (node.flags !== null) {
                        result += (node.value.type !== 'String' ? ' ' : '') + node.flags;
                    }
                }
            }

            return '[' + result + ']';
        },

        FunctionalPseudo: function(node, translate) {
            return ':' + node.name + '(' + eachDelim(translate, node.arguments, ',') + ')';
        },

        Function: function(node, translate) {
            return node.name + '(' + eachDelim(translate, node.arguments, ',') + ')';
        },

        Negation: function(node, translate) {
            return ':not(' + eachDelim(translate, node.sequence, ',') + ')';
        },

        Braces: function(node, translate) {
            return node.open + each(translate, node.sequence) + node.close;
        },

        Argument: function(node, translate) {
            return each(translate, node.sequence);
        },

        AtruleExpression: function(node, translate) {
            return each(translate, node.sequence);
        },

        Url: function(node, translate) {
            return 'url(' + translate(node.value) + ')';
        },

        Progid: function(node, translate) {
            return translate(node.value);
        },

        Combinator: function(node) {
            return node.name;
        },

        Identifier: function(node) {
            return node.name;
        },

        PseudoClass: function(node) {
            return ':' + node.name;
        },

        PseudoElement: function(node) {
            return '::' + node.name;
        },

        Class: function(node) {
            return '.' + node.name;
        },

        Id: function(node) {
            return '#' + node.name;
        },

        Hash: function(node) {
            return '#' + node.value;
        },

        Dimension: function(node) {
            return node.value + node.unit;
        },

        Nth: function(node) {
            return node.value;
        },

        Number: function(node) {
            return node.value;
        },

        String: function(node) {
            return node.value;
        },

        Operator: function(node) {
            return node.value;
        },

        Raw: function(node) {
            return node.value;
        },

        Unknown: function(node) {
            return node.value;
        },

        Percentage: function(node) {
            return node.value + '%';
        },

        Space: function() {
            return ' ';
        },

        Comment: function(node) {
            return '/*' + node.value + '*/';
        }
    };
};
