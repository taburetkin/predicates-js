var predicatesJs = (function (exports) {
  'use strict';

  // adds indentation to multiline text
  function tabulate(text, num = 1) {
    if (!text) return text;
    let tabs = '\t'.repeat(num);
    return text.replace(/^(.)/gim, tabs + '$1');
  }

  // merges given object with provided other objects
  function merge(mutated, ...args) {
    if (!args || !args.length) return mutated;

    //if skipUndefined is true then key with undefined values will be ignored
    let skipUndefined = true;
    // last argument may be boolean for determine behavior for undefined values
    if (typeof args[args.length - 1] !== 'object') {
      skipUndefined = args.pop();
    }

    args.forEach(obj => {
      Object.keys(obj).forEach(key => {
        let val = obj[key];
        if (val !== void 0 || !skipUndefined) {
          mutated[key] = val;
        }
      });
    });
    return mutated;
  }

  // detects if a given argument is a simple value (numbers, strings, date)
  function isSimpleValue(arg) {
    if (Array.isArray(arg) || typeof arg === 'function') return false;
    if (arg == null || typeof arg !== 'object') return true;
    if (arg.valueOf && typeof arg.valueOf() !== 'object') {
      return true;
    }
    return false;
  }


  // takes first non undefined value from given contexts
  function pick(key, ...contexts) {
    let value;
    while (contexts.length || value === undefined) {
      let context = contexts.shift() || {};
      context && (value = context[key]);
    }
    return value;
  }

  // backbone's extend
  function extend(protoProps, staticProps) {
    let parent = this;
    let child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      child = protoProps.constructor;
    } else {
      child = function() { return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    Object.assign(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function and add the prototype properties.

    child.prototype = Object.assign(Object.create(parent.prototype), protoProps);
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  }

  const SqOperator = function(options = {}) {
    let { id, sign, separator } = options;
    if (id == null) {
      throw new Error('SqOperator id must be not empty and unique');
    }
    this.id = id;
    if (!separator && sign) {
      options.separator = ` ${sign} `;
    }
    this.update(options, true);
  };

  SqOperator.prototype = {
    update(another = {}, force) {
      let { sign, prefix, separator, postfix } = another;
      let options = { sign, prefix, separator, postfix };
      merge(this, options, force);

      if (another.hasOwnProperty('toString')) {
        this._bind('toString', another.toString);
      }

      if (another.hasOwnProperty('filter')) {
        this._bind('filter', another.filter);
      }
    },

    _bind(key, method) {
      if (typeof method !== 'function') return;
      this[key] = method.bind(this);
    },

    toString(left, right) {
      return `${this.prefix || ''}${left}${this.separator || ''}${right}${this
      .postfix || ''}`;
    },

    filter() { }
  };

  SqOperator.extend = extend;

  function maybeOperator(arg) {
    return arg == null || arg instanceof SqOperator || typeof arg === 'string';
  }

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
  };

  const config = {
    anyWord: 'any',
    everyWord: 'every',
    defaultIsAny: false,
    defaultDialect: new SqDialect()
  };

  const SqItemValue = function(value, ref, options) {
    this.options = options;
    this.value = value;
    this.ref = ref; // true or false, indicates is a value is a reference or not
  };

  SqItemValue.prototype = {

    isRef() {
      return this.ref === true;
    },

    getModelValue(model, key, dialect) {
      if (dialect && dialect.getModelValue) {
        return dialect.getModelValue(model, key);
      }
      return model && model[key];
    },

    getValue(model) {
      if (this.isRef()) {
        return this.getModelValue(model, this.value);
      } else {
        return this.value;
      }
    },

    getDialect() {
      return this.options.dialect || config.defaultDialect;
    },

    toJSON() {
      let dialect = this.getDialect();
      if (this.isRef()) {
        return dialect.unwrapReferenceValue(this.value);
      } else {
        if (this.value && this.value.toJSON) {
          return this.value.toJSON();
        } else {
          return this.value;
        }
      }
    },

    toString(options = {}) {
      let dialect = options.dialect || this.getDialect();
      if (dialect && dialect.itemValueToString) {
        return dialect.itemValueToString(this, options);
      } else {
        return this.value;
      }
    },

    compare(rightItem, { model, compareValues } = {}) {
      let leftItem = this;

      let leftValue = leftItem.getValue(model);
      let rightValue =
        rightValue instanceof SqItemValue ? rightItem.getValue(model) : rightItem;

      let compare = compareValues || ((a, b) => a == b);
      return compare(leftValue, rightValue);
    },
  };

  SqItemValue.extend = extend;

  SqItemValue.parse = function(value, options = {}) {
    if (value instanceof SqItemValue) {
      return value;
    }
    let ref = false;
    if (typeof value === 'string') {
      let { dialect = config.defaultDialect } = options;
      let pattern = dialect.toStringOptions.referencePattern;
      ref = pattern.test(value);
      ref && (value = value.replace(pattern, '$1'));
    }
    return new SqItemValue(value, ref, options);
  };

  function isValueWithOperator(arg) {
    return (
      Array.isArray(arg) &&
      arg.length === 2 &&
      arg[1] != null &&
      maybeOperator(arg[1])
    );
  }

  const SqItem = function(left, right, operator, options) {
    if (arguments.length < 3) {
      throw new Error('SqItem constructor takes 3 or 4 arguments');
    }
    this.options = this._normalizeOptions(options);
    this.left = this._parseValue(left);
    this.right = this._parseValue(right);
    this.operator = this._normalizeOperator(operator);
  };

  SqItem.prototype = {

    _normalizeOptions(opts = {}) {
      return Object.assign({}, { dialect: config.defaultDialect }, opts);
    },

    _normalizeOperator(op) {
      let dialect = this.getDialect();
      return dialect.getOperator(op || 'equal');
    },

    getDialect() {
      return this.options.dialect;
    },

    getOperator() {
      if (this.operator instanceof SqOperator) {
        return this.operator;
      } else {
        return this.getDialect().getOperator(this.operator);
      }
    },

    filter(model) {
      let dialect = this.getDialect();
      let left = this.left.getValue(model, dialect);
      let right = this.right.getValue(model);
      return this.compare(left, right);
    },

    compare(left, right) {
      let operator = this.getOperator();
      return (operator && operator.filter(left, right)) || false;
    },

    toJSON() {
      return [this.left.toJSON(), this.right.toJSON(), this.operator.id];
    },

    toString(options = {}) {
      let dialect = options.dialect || this.getDialect();
      if (dialect.itemToString) {
        return dialect.itemToString(this, options);
      } else {
        return JSON.stringify(this, null, '\t');
      }
    },

    _parseValue(value) {
      return SqItemValue.parse(value, this.options);
    },

  };

  SqItem.extend = extend;

  SqItem.parse = function(...args) {
    let [left, right, operator, options] = args;
    if (left instanceof SqItem) return left;
    if (left == null) return;

    if (args.length == 4) {
      if (!(isSimpleValue(left) || isSimpleValue(right))) {
        return;
      }
      try {
        return new SqItem(left, right, operator, options);
      } catch (e) {
        return;
      }
    }

    if (args.length == 3) {
      if (!maybeOperator(operator)) {
        options = operator;
        operator = void 0;
      }

      if (!Array.isArray(left) && isValueWithOperator(right)) {
        operator = right[1];
        right = right[0];
      }

      if (maybeOperator(operator)) {
        return this.parse(left, right, operator, options);
      } else {
        return;
      }
    }

    if (args.length === 2) {
      if (isSimpleValue(left) && isValueWithOperator(right)) {
        operator = right[1];
        right = right[0];
        return this.parse(left, right, operator, options);
      }

      if (
        Array.isArray(left) &&
        left.length >= 2 &&
        (maybeOperator(left[2]) || isValueWithOperator(left[1]))
      ) {
        options = right;
        operator = left[2];
        right = left[1];
        left = left[0];
        if (isValueWithOperator(right)) {
          operator = right[1];
          right = right[0];
        }
        return this.parse(left, right, operator, options);
      }
      return;
    }

    if (
      args.length === 1 &&
      Array.isArray(left) &&
      left.length >= 2 &&
      maybeOperator(left[2])
    ) {
      return this.parse(left, options);
    }

    return;

  };

  const SqGroup = function(val, options = {}) {
    if (!Array.isArray(val)) {
      throw new Error('First argument must be an array or object');
    }
    this.options = this._normalizeOptions(options);
    this.isAny = this.options.isAny;
    this.items = this._normalizeItems(val);
  };

  SqGroup.prototype = {

    _normalizeIsAny(values) {
      let { anyWord, everyWord, isAny } = this.options;
      if (values[anyWord] != null) {
        return true;
      } else if (values[everyWord] != null) {
        return false;
      }
      return isAny;
    },

    _normalizeOptions(options = {}) {
      let {
        isAny = config.defaultIsAny,
        anyWord = config.anyWord,
        everyWord = config.everyWord,
        dialect = config.defaultDialect
      } = options;
      let word = isAny ? anyWord : everyWord;
      return { isAny, word, anyWord, everyWord, dialect };
    },

    _normalizeItems(values) {
      if (values == null || typeof values !== 'object') return [];

      if (!Array.isArray(values)) {
        let word = this.isAny ? this.options.anyWord : this.options.everyWord;
        return this._normalizeItems(values[word]);
      }

      let result = values.reduce((memo, item) => {
        let instance = this._normalizeItem(item);
        if (instance == null) return memo;

        if (instance instanceof SqGroup && this.isAny === instance.isAny) {
          memo.push(...instance.items);
        } else {
          memo.push(instance);
        }
        return memo;
      }, []);

      if (result.length === 1 && result[0] instanceof SqGroup) {
        return result[0].items;
      }

      return result;
    },

    _normalizeItem(raw) {
      let sqitem = SqItem.parse(raw, this.options);
      if (sqitem) {
        return sqitem;
      }
      let sqgroup = SqGroup.parse(raw, this.options);
      if (sqgroup) {
        return sqgroup;
      }
    },

    getDialect() {
      return this.options.dialect;
    },

    toJSON() {
      let { anyWord, everyWord } = this.options;
      let word = this.isAny ? anyWord : everyWord;
      let items = (this.items || []).map(item => {
        return item.toJSON();
      });
      if (items === 1) {
        return items[0];
      } else {
        if (this.isAny === config.defaultIsAny) {
          return items;
        } else {
          return {
            [word]: items
          };
        }
      }
    },

    toString(options = {}) {
      let dialect = options.dialect || this.getDialect();
      if (dialect && dialect.groupToString) {
        return dialect.groupToString(this, options);
      } else {
        return JSON.stringify(this, null, '\t');
      }
    },

    toSql(options = {}) {
      !options.params && (options.params = []);
      let values = options.params;
      let text = this.toString(options);
      return { text, values };
    },

    filter(model, options) {
      let result = false;
      for (let x = 0; x < this.items.length; x++) {
        let item = this.items[x];
        result = item.filter(model, options);
        if ((result && this.isAny) || (!result && !this.isAny)) {
          return result;
        }
      }
      return result;
    },

    _join(arg, isAny) {
      if (this.isAny === isAny) {
        let items = this._normalizeItems(arg);
        this.items.push(items);
      } else {
        let opts = Object.assign({}, this.options, { isAny });
        return SqGroup.parse([arg, this], opts);
      }
    },

    or(arg) {
      return this._join(arg, true);
    },

    and(arg) {
      return this._join(arg, false);
    },

  };

  SqGroup.extend = extend;

  SqGroup.parse = function(val, options = {}) {
    let { dialect = config.defaultDialect } = options;
    //console.log('dialect', dialect);
    if (val instanceof SqGroup || val == null) return val;
    if (typeof val !== 'object') return;

    if (val instanceof SqItem) {
      return new SqGroup([val], options);
    }

    let sqitem = SqItem.parse(val, options);
    if (sqitem) {
      return new SqGroup([val], options);
    }

    if (Array.isArray(val)) {
      try {
        return new SqGroup(val, options);
      } catch (e) {
        return;
      }
    }

    let keys = Object.keys(val);
    let { anyWord = config.anyWord, everyWord = config.everyWord } = options;
    let arr = val[anyWord] || val[everyWord];
    if (keys.length === 1 && arr) {
      let opts = Object.assign({}, options, { isAny: !!val[anyWord] });
      return SqGroup.parse(arr, opts);
    }

    arr = keys.map(key => {
      let value = val[key];
      if (dialect.parseOptions.leftSideAsReference) {
        key = dialect.wrapReferenceValue(key);
      }
      return [key, value];
    });
    try {
      return new SqGroup(arr, options);
    } catch (e) {
      return;
    }
  };

  SqGroup.filter = function(data, options = {}) {
    let sq = this.parse(data, options);
    if (!sq) {
      if (options.throwError !== false) {
        return () => true;
      } else {
        throw new Error('Unable to parse SqGroup from provided data');
      }
    }
    return model => sq.filter(model, options.filterOptions);
  };

  function sqParse(data, options) {
    return SqGroup.parse(data, options);
  }

  function sqFilter(data, options) {
    let grp = sqParse(data, options);
    if (!grp) return () => false;
    return model => grp.filter(model);
  }

  exports.SqDialect = SqDialect;
  exports.SqGroup = SqGroup;
  exports.SqItem = SqItem;
  exports.SqItemValue = SqItemValue;
  exports.SqOperator = SqOperator;
  exports.config = config;
  exports.extend = extend;
  exports.isSimpleValue = isSimpleValue;
  exports.merge = merge;
  exports.pick = pick;
  exports.sqFilter = sqFilter;
  exports.sqParse = sqParse;
  exports.tabulate = tabulate;

  return exports;

}({}));
