var TokenType = {
    Whitespace:          1,
    Identifier:          2,
    DecimalNumber:       3,
    String:              4,
    Comment:             5,
    Unknown:             6,
    ExclamationMark:    33,  // !
    QuotationMark:      34,  // "
    NumberSign:         35,  // #
    DollarSign:         36,  // $
    PercentSign:        37,  // %
    Ampersand:          38,  // &
    Apostrophe:         39,  // '
    LeftParenthesis:    40,  // (
    RightParenthesis:   41,  // )
    Asterisk:           42,  // *
    PlusSign:           43,  // +
    Comma:              44,  // ,
    HyphenMinus:        45,  // -
    FullStop:           46,  // .
    Solidus:            47,  // /
    Colon:              58,  // :
    Semicolon:          59,  // ;
    LessThanSign:       60,  // <
    EqualsSign:         61,  // =
    GreaterThanSign:    62,  // >
    QuestionMark:       63,  // ?
    CommercialAt:       64,  // @
    LeftSquareBracket:  91,  // [
    RightSquareBracket: 93,  // ]
    CircumflexAccent:   94,  // ^
    LowLine:            95,  // _
    LeftCurlyBracket:  123,  // {
    VerticalLine:      124,  // |
    RightCurlyBracket: 125,  // }
    Tilde:             126   // ~
};

var TokenName = {};

for (var key in TokenType) {
    TokenName[TokenType[key]] = key;
}

module.exports = {
    TokenType: TokenType,
    TokenName: TokenName
};
