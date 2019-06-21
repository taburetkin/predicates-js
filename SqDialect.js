import SqOperator from './SqOperator';
import { tabulate } from './helpers';

class SqDialect {
  constructor({ operators, operatorsOptions } = {}) {
    this._initializeReferencePattern();
    this._initializeOperators(operators, operatorsOptions);
  }

  _initializeOperators(operators, { replaceAll, merge = true } = {}) {
    let rawOperators = replaceAll ? operators : this.operators;
    this.operators = this._buildOperators(rawOperators);
    if (replaceAll) return;

    let newOps = this._buildOperators(operators);
    newOps &&
      Object.keys(newOps).forEach(key => {
        let newOp = newOps[key];
        let existOp = this.operators[key];
        if (!existOp || !merge) {
          this.operators[key] = newOp;
        } else if (existOp) {
          this._mergeOperators(existOp, newOp);
        }
      });
  }

  _mergeOperators(operator, another) {
    operator.update(another);
  }

  _buildOperators(operators) {
    if (typeof operators !== 'object') return;
    return Object.keys(operators).reduce((memo, key) => {
      let raw = operators[key];
      let operator;
      if (raw instanceof SqOperator) {
        operator = raw;
      } else {
        operator = new SqOperator(raw);
      }
      if (!operator.id) {
        operator.id = key;
      }
      memo[operator.id] = operator;
      return memo;
    }, {});
  }

  _initializeReferencePattern() {
    if (this.toStringOptions.referencePattern) {
      return;
    }

    if (this.toStringOptions.referenceWrapper == null) {
      return;
    }

    let wrap = this.toStringOptions.referenceWrapper;
    if (!Array.isArray(wrap)) {
      wrap = [wrap, wrap];
    }
    let left = wrap[0].toString().replace(this._regexSpecials, '\\$&');
    let right = wrap[1].toString().replace(this._regexSpecials, '\\$&');
    let pattern = new RegExp(`^${left}([^${right}]+)${right}`);

    this.toStringOptions.referencePattern = pattern;
  }

  // in case of arrow function the second argument is toStringOptions.referenceWrapper
  referenceToString(value, wrapper) {
    let [left, right] = this.toStringOptions.referenceWrapper;
    return `${left}${value}${right}`;
  }
  wrapReferenceValue(value) {
    let [left, right] = this.toStringOptions.referenceWrapper;
    return `${left}${value}${right}`;
  }
  unwrapReferenceValue(value) {
    return value.replace(this.toStringOptions.referencePattern, '$1');
  }

  groupToString(group, options = {}) {
    if (!options.params && this.toStringOptions.parametrized) {
      options.params = [];
    }
    if (group.items.length === 0) return '';
    if (group.items.length === 1) return group.items[0].toString(options);
    let itemTexts = group.items.map(item => item.toString(options));

    let shouldIdent = this.toStringOptions.indentation;
    let i = this.toStringOptions.indentation ? '\n' : ' ';
    let bitwise = group.isAny
      ? this.toStringOptions.orSign
      : this.toStringOptions.andSign;
    let leftBracet = this.toStringOptions.groupWrapper[0];
    let rightBracet = this.toStringOptions.groupWrapper[1];
    bitwise = `${i}${bitwise}${i}`;
    leftBracet = leftBracet + i;
    rightBracet = i + rightBracet;

    let text = itemTexts.join(bitwise);
    shouldIdent && (text = tabulate(text, 1));

    return leftBracet + text + rightBracet;
  }

  itemToString(item, options) {
    let lopts = Object.assign({}, options, {
      side: 'left',
      operator: item.operator
    });
    let ropts = Object.assign({}, options, {
      side: 'right',
      operator: item.operator
    });
    let res = item.operator.toString(
      item.left.toString(lopts),
      item.right.toString(ropts)
    );
    return res;
  }

  itemValueToString(qsValue, options = {}) {
    if (qsValue.isRef()) {
      return this.unwrapReferenceValue(qsValue.value);
    } else {
      if (options.side == 'left') {
        return qsValue.value.toString();
      } else {
        if (this.toStringOptions.parametrized) {
          let sign = this.toStringOptions.parameterSign;
          if (this.toStringOptions.indexedParameterSign) {
            let { params = [] } = options;
            options.params = params;
            params.push(qsValue.value);
            sign += params.length;
          }
          return sign;
        } else {
          return JSON.stringify(qsValue.value);
        }
      }
    }
  }

  getOperator(id) {
    if (id == null) return;
    id.id && (id = id.id);
    return this.operators[id];
  }

  isOperator(operator) {
    return this.getOperator(operator) != null;
  }
}

SqDialect.prototype.parseOptions = {
  leftSideAsReference: true
};
SqDialect.prototype._regexSpecials = /[.*+?^${}()|[\]\\]/g;
SqDialect.prototype.toStringOptions = {
  indentation: true,
  groupWrapper: ['(', ')'],
  orSign: 'OR',
  andSign: 'AND',
  referenceWrapper: ['[', ']'],

  parametrized: true,
  parameterSign: '$',
  indexedParameterSign: true
};
SqDialect.prototype.operators = [
  {
    id: 'equal',
    sign: '=',
    filter: (a, b) => a == b
  },
  {
    id: 'notEqual',
    sign: '!=',
    filter: (a, b) => a != b
  },
  {
    id: 'greater',
    sign: '>',
    filter: (a, b) => a > b
  },
  {
    id: 'greaterOrEqual',
    sign: '>=',
    filter: (a, b) => a >= b
  },
  {
    id: 'lesser',
    sign: '<',
    filter: (a, b) => a < b
  },
  {
    id: 'lesserOrEqual',
    sign: '<=',
    filter: (a, b) => a <= b
  },
  {
    id: 'startsWith',
    sign: 'starts with',
    filter: (a, b) => (a && a.startsWith && a.startsWith(b)) || false
  },
  {
    id: 'endsWith',
    sign: 'ends with',
    filter: (a, b) => (a && a.endsWith && a.endsWith(b)) || false
  },
  {
    id: 'notStartsWith',
    sign: 'not starts with',
    filter: (a, b) => (a && a.startsWith && !a.startsWith(b)) || true
  },
  {
    id: 'notEndsWith',
    sign: 'not ends with',
    filter: (a, b) => (a && a.endsWith && !a.endsWith(b)) || true
  },
  {
    id: 'contains',
    sign: 'contains',
    filter: (a, b) => {
      return (a && a.includes && a.includes(b)) || false;
    }
  },
  {
    id: 'notContains',
    sign: 'not contains',
    filter: (a, b) => (a && a.includes && !a.includes(b)) || true
  },
  {
    id: 'in',
    sign: 'in',
    filter: (a, b) => (b && b.includes && b.includes(a)) || false
  },
  {
    id: 'notIn',
    sign: 'not in',
    filter: (a, b) => (b && b.includes && !b.includes(a)) || true
  },
  {
    id: 'null',
    sign: 'is null',
    filter: a => a == null
  },
  {
    id: 'notNull',
    sign: 'is not null',
    filter: a => a != null
  }
];

export default SqDialect;
