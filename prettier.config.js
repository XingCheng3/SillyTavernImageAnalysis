export default {
    printWidth: 100, // 一行最多多少字符
    tabWidth: 2, // 缩进的宽度，2 个空格
    useTabs: false, // 是否使用制表符，不使用制表符，使用空格
    semi: false, // 语句结尾是否使用分号
    bracketSpacing: true, // 大括号 {} 中开始和结束是否要空格，true — { foo: 1 }，false — {foo: 1}
    trailingComma: 'none', // 数组或对象或参数的最后一项是否尾随逗号，none — 没有尾随逗号，all — 尽可能使用尾随逗号，es5 — 在 ES5 中有效的尾随逗号（对象、数组等），TypeScript 和 Flow 类型参数中的尾随逗号。
    arrowParens: 'always', // 只有一个参数的箭头函数是否带括号，always — 始终带括号，avoid — 不带括号
    proseWrap: 'always', // 什么对代码进行折行，always — 如果超过 printWidth 指定的一行最多字符宽度，则进行折行；never — 将每块代码块展开成一行；preserve — 什么都不做，保持原样。
    htmlWhitespaceSensitivity: 'strict', // 根据显示样式决定 html 要不要折行
    endOfLine: 'auto', // 每行的结束符（回车符、换行符），取值请参考 https://www.prettier.cn/docs/options.html#end-of-line
    // 每个文件格式化的范围是文件的全部内容
    rangeStart: 0,
    rangeEnd: Infinity,
    // 不需要写文件开头的@prettier
    requirePragma: false,
    // 不需要自动在文件开头插入@prettier
    insertPragma: false,
}
