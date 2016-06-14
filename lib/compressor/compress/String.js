var BACK_SLASH = '\\';

module.exports = function(node) {
    var value = node.value;

    // remove escaped \n, i.e.
    // .a { content: "foo\
    // bar"}
    // ->
    // .a { content: "foobar" }
    if (value.indexOf(BACK_SLASH) !== -1) {
        node.value = value.replace(/\\(\n|\r\n|\r|\f)/g, '');
    }
};
