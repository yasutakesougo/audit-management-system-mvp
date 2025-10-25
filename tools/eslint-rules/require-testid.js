module.exports = {
  meta: { type: 'suggestion', schema: [] },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = node.name && node.name.name;
        if (!name) return;
        // 押下系・フォーム主要要素に testid を推奨
        const target = new Set(['button','input','select','textarea']);
        if (!target.has(name)) return;
        const hasTestId = node.attributes.some(
          (a) => a.name && a.name.name === 'data-testid'
        );
        if (!hasTestId) {
          context.report({
            node,
            message: `Add data-testid to <${name}> for E2E stability.`,
          });
        }
      },
    };
  },
};
