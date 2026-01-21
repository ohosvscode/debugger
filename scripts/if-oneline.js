export const RULE_NAME = 'if-oneline'

export default {
  name: RULE_NAME,
  meta: {
    type: 'layout',
    docs: {
      description: 'Require single line if statements',
    },
    fixable: 'whitespace',
    schema: [],
    messages: {
      expectIfOneline: 'Expect single line if statement',
    },
  },
  defaultOptions: [],
  create: (context) => {
    return {
      IfStatement(node) {
        if (!node.consequent) return
        if (node.consequent.type === 'BlockStatement') return
        if (node.test.loc.end.line !== node.consequent.loc.start.line) {
          context.report({
            node,
            loc: {
              start: node.test.loc.end,
              end: node.consequent.loc.start,
            },
            messageId: 'expectIfOneline',
            fix(fixer) {
              const sourceCode = context.getSourceCode()
              const text = sourceCode.getText()
              const betweenText = text.slice(node.test.range[1], node.consequent.range[0])
              const newText = betweenText.replace(/\s*\n\s*/, ' ')
              return fixer.replaceTextRange([node.test.range[1], node.consequent.range[0]], newText)
            },
          })
        }
      },
    }
  },
}
