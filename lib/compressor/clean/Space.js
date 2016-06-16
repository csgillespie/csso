function canCleanWhitespace(item) {
    if (item !== null && item.data.type === 'Operator') {
        return item.data.value !== '+' && item.data.value !== '-';
    }

    return false;
}

module.exports = function cleanWhitespace(node, item, list) {
    if (canCleanWhitespace(item.prev) || canCleanWhitespace(item.next)) {
        list.remove(item);
    }
};
