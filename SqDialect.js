import SqOperator from './SqOperator';
import { tabulate, pick, extend } from './helpers';

const SqDialect = function(options = {}) {
  let { operators, operatorsOptions, toStringOptions } = options;
  // initializing operators
  this._initializeOperators(operators, operatorsOptions);

  //initializing toString options
  this.toStringOptions = Object.assign(
    {},
    this.toStringOptions,
    toStringOptions
  );

  //initializing reference pattern
  this._initializeReferencePattern();
};

SqDialect.extend = extend;


SqDialect.prototype = {
  _initializeReferencePattern() {
    if (this.toStringOptions.referencePattern instanceof RegExp) {
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
  },

  //#region Operators

  _initializeOperators(operators, { replaceAll, merge = true } = {}) {
    // in case of not replacing we will process default operators first.
    let rawOperators = replaceAll ? operators : this.defaultOperators;
    this.operators = this._buildOperators(rawOperators);

    // if we are replacing all our operators ready and we may leave.
    if (replaceAll) return;

    // processing given operators
    let newOps = this._buildOperators(operators);
    newOps &&
      Object.keys(newOps).forEach(key => {
        let newOp = newOps[key];
        let existOp = this.operators[key];

        // using merge instead of replace if merge is true nad operator exists
        if (existOp && merge) {
          this._mergeOperators(existOp, newOp);
        } else {
          //otherwise using assign
          this.operators[key] = newOp;
        }
      });
  },

  _mergeOperators(operator, another) {
    operator.update(another);
  },

  // building operrators from object hash
  _buildOperators(operators) {
    if (typeof operators !== 'object') return;
    return Object.keys(operators).reduce((memo, key) => {
      let raw = operators[key];
      let operator = this._buildOperator(raw, key);
      operator && (memo[operator.id] = operator);
      return memo;
    }, {});
  },

  // building SqOperator from object literal
  _buildOperator(raw, id) {
    let operator;
    if (raw instanceof SqOperator) {
      operator = raw;
    } else {
      operator = new SqOperator(raw);
    }
    if (operator.id == null && id != null) {
      operator.id = id;
    }
    return operator;
  },

  getOperator(id) {
    if (id == null) return;
    id.id && (id = id.id);
    return this.operators[id];
  },

  isOperator(operator) {
    return this.getOperator(operator) != null;
  },

  //#endregion

  // in case of arrow function the second argument is toStringOptions.referenceWrapper
  referenceToString(value, wrapper) {
    let [left, right] = this.toStringOptions.referenceWrapper;
    return `${left}${value}${right}`;
  },

  wrapReferenceValue(value) {
    let [left, right] = this.toStringOptions.referenceWrapper;
    return `${left}${value}${right}`;
  },

  unwrapReferenceValue(value) {
    return value.replace(this.toStringOptions.referencePattern, '$1');
  },

  groupToString(group, options = {}) {
    let parametrized = pick('parametrized', options, this.toStringOptions);
    if (!options.params && parametrized) {
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
  },

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
  },

  itemValueToString(qsValue, options = {}) {
    if (qsValue.isRef()) {
      return this.unwrapReferenceValue(qsValue.value);
    } else {
      if (options.side == 'left') {
        return qsValue.value.toString();
      } else {
        let parametrized = pick('parametrized', options, this.toStringOptions);
        if (parametrized) {
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
  },


  parseOptions: {
    leftSideAsReference: true
  },
  _regexSpecials: /[.*+?^${}()|[\]\\]/g,
  toStringOptions: {
    indentation: true,
    groupWrapper: ['(', ')'],
    orSign: 'OR',
    andSign: 'AND',
    referenceWrapper: ['[', ']'],
    parametrized: true,
    parameterSign: '$',
    indexedParameterSign: true
  },
  defaultOperators: [
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
  ]
}

export default SqDialect;
