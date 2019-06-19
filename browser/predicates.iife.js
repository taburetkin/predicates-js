var predicatesJs = (function (exports) {
	'use strict';

	function tabulate(text, num) {
		if (!text) return text;
		let tabs = '\t'.repeat(num);
		return text.replace(/^(.)/gmi, tabs + '$1');
	}


	function merge(mutated, ...args) {
		if (!args || !args.length) return mutated;
		let skipUndefined = true;
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

	function isSimpleValue(arg) {
		if (Array.isArray(arg) || typeof arg === 'function') return false;
		if (arg == null || typeof arg !== 'object') return true;
		if (arg.valueOf && typeof arg.valueOf() !== 'object') {
			return true;
		}
		return false;
	}

	class SqOperator {

		constructor(options = {}) {
			let { id, sign, separator } = options;
			if (id == null) {
				throw new Error('SqOperator id must be not empty and unique');
			}
			this.id = id;
			if (!separator && sign) {
				options.separator = ` ${sign} `;
			}
			this.update(options, true);

		}

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
		}

		_bind(key, method) {
			if (typeof method !== 'function') return;
			this[key] = method.bind(this);
		}

		toString(left, right) {
			return `${this.prefix || ''}${left}${this.separator || ''}${right}${this.postfix || ''}`;
		}

		filter() { }

	}

	function maybeOperator(arg)
	{
		return arg == null || arg instanceof SqOperator || typeof arg === 'string';
	}

	class SqDialect {
		constructor({ operators, operatorsOptions } = {}) {
			this._initializeReferencePattern();
			this._initializeOperators(operators, operatorsOptions);
		}

		_initializeOperators(operators, { replaceAll, merge: merge$$1 = true } = {}) {
			let rawOperators = replaceAll ? operators : this.operators;
			this.operators = this._buildOperators(rawOperators);
			if (replaceAll) return;

			let newOps = this._buildOperators(operators);
			newOps && Object.keys(newOps).forEach(key => {
				let newOp = newOps[key];
				let existOp = this.operators[key];
				if (!existOp || !merge$$1) {
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
			let [ left, right ] = this.toStringOptions.referenceWrapper;
			return `${left}${value}${right}`;
		}
		wrapReferenceValue(value) {
			let [ left, right ] = this.toStringOptions.referenceWrapper;
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
			let bitwise = group.isAny ? this.toStringOptions.orSign : this.toStringOptions.andSign;
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
			let lopts = Object.assign({}, options, { side: 'left', operator: item.operator, });
			let ropts = Object.assign({}, options, { side: 'right', operator: item.operator, });
			let res = item.operator.toString(item.left.toString(lopts), item.right.toString(ropts));
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
		leftSideAsReference: true,
	};
	SqDialect.prototype._regexSpecials = /[.*+?^${}()|[\]\\]/g;
	SqDialect.prototype.toStringOptions = {
		indentation: true,
		groupWrapper: ['(',')'],
		orSign: 'OR',
		andSign: 'AND',
		referenceWrapper: ['[',']'],

		parametrized: true,
		parameterSign: '$',
		indexedParameterSign: true,
	};
	SqDialect.prototype.operators = [
		{
			id: 'equal',
			sign: '=',
			filter: (a, b) => a == b,
		},
		{
			id: 'notEqual',
			sign: '!=',
			filter: (a, b) => a != b,
		},
		{
			id: 'greater',
			sign: '>',
			filter: (a, b) => a > b,
		},
		{
			id: 'greaterOrEqual',
			sign: '>=',
			filter: (a, b) => a >= b,
		},
		{
			id: 'lesser',
			sign: '<',
			filter: (a, b) => a < b,
		},
		{
			id: 'lesserOrEqual',
			sign: '<=',
			filter: (a, b) => a <= b,
		},
		{
			id: 'startsWith',
			sign: 'starts with',
			filter: (a, b) => a && a.startsWith && a.startsWith(b) || false,
		},
		{
			id: 'endsWith',
			sign: 'ends with',
			filter: (a, b) => a && a.endsWith && a.endsWith(b) || false,
		},
		{
			id: 'notStartsWith',
			sign: 'not starts with',
			filter: (a, b) => a && a.startsWith && !a.startsWith(b) || true,
		},
		{
			id: 'notEndsWith',
			sign: 'not ends with',
			filter: (a, b) => a && a.endsWith && !a.endsWith(b) || true,
		},
		{
			id: 'contains',
			sign: 'contains',
			filter: (a, b) => {
				return a && a.includes && a.includes(b) || false
			}
		},
		{
			id: 'notContains',
			sign: 'not contains',
			filter: (a, b) => a && a.includes && !a.includes(b) || true,
		},
		{
			id: 'in',
			sign: 'in',
			filter: (a, b) => b && b.includes && b.includes(a) || false,
		},
		{
			id: 'notIn',
			sign: 'not in',
			filter: (a, b) => b && b.includes && !b.includes(a) || true,
		},
		{
			id: 'null',
			sign: 'is null',
			filter: (a) => a == null,
		},
		{
			id: 'notNull',
			sign: 'is not null',
			filter: (a) => a != null,
		}
	];

	const config = {
		
		anyWord: 'any',
		everyWord: 'every',
		defaultIsAny: false,

		defaultDialect: new SqDialect(),

	};

	class SqItemValue {

		constructor (value, ref, options) {
			this.options = options;
			this.value = value;
			this.ref = ref;
		}

		isRef() {
			return this.ref === true;
		}

		getModelValue(model, key, dialect) {
			if (dialect && dialect.getModelValue) {
				return dialect.getModelValue(model, key);
			}
			return model && model[key];
		}

		getValue(model) {
			if (this.isRef()) {
				return this.getModelValue(model, this.value);
			} else {
				return this.value;
			}
		}
		
		getDialect() {
			return this.options.dialect || config.defaultDialect;
		}

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
		}

		toString(options = {}) {		
			let dialect = options.dialect || this.getDialect();
			if (dialect && dialect.itemValueToString) {
				return dialect.itemValueToString(this, options);
			} else {
				return this.value;
			}
		}

		compare(rightItem, { model, compareValues } = options) {

			let leftItem = this;

			let leftValue = leftItem.getValue(model);
			let rightValue = rightValue instanceof SqItemValue ? rightItem.getValue(model) : rightItem;

			let compare = compareValues || ((a,b) => a == b);
			return compare(leftValue, rightValue);
		}

		static parse(value, options = {}) {
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
		}

	}

	function isValueWithOperator(arg) {
		return Array.isArray(arg) && arg.length === 2 && arg[1] != null && maybeOperator(arg[1]);
	}


	class SqItem {
		constructor (left, right, operator, options) {
			if (arguments.length < 3) {
				throw new Error('SqItem constructor takes 3 or 4 arguments');
			}
			this.options = this._normalizeOptions(options);
			this.left = this._parseValue(left);
			this.right = this._parseValue(right);
			this.operator = this._normalizeOperator(operator);
		}

		_normalizeOptions(opts = {}) {
			return Object.assign({}, { dialect: config.defaultDialect } , opts);
		}

		_normalizeOperator(op) {
			let dialect = this.getDialect();
			return dialect.getOperator(op || 'equal');
		}

		getDialect() {
			return this.options.dialect;
		}

		getOperator() {
			if (this.operator instanceof SqOperator) {
				return this.operator;
			} else {
				return this.getDialect().getOperator(this.operator);
			}
		}

		filter(model) {
			let dialect = this.getDialect();
			let left = this.left.getValue(model, dialect);
			let right = this.right.getValue(model);
			return this.compare(left, right);
		}



		compare(left, right) {
			let operator = this.getOperator();
			return operator && operator.filter(left, right) || false;
		}

		toJSON() {
			return [
				this.left.toJSON(),
				this.right.toJSON(),
				this.operator.id
			];
		}

		toString(options = {}) {
			let dialect = options.dialect || this.getDialect();
			if (dialect.itemToString) {
				return dialect.itemToString(this, options);
			} else {
				return JSON.stringify(this, null, '\t');
			}
			// let left = this.left.toString({ ...options, operator: this.operator, side: 'left' });
			// let right = this.right.toString({ ...options, operator: this.operator, side: 'right' });
			// return dialect.itemToString(left, right, this.operator);
		}

		_parseValue(value) {
			return SqItemValue.parse(value, this.options);
		}

		static parse(...args) {
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

				if (Array.isArray(left) && left.length >= 2 && (maybeOperator(left[2]) || ( isValueWithOperator(left[1]) ))) {
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

			if (args.length === 1 && Array.isArray(left) && left.length >= 2 && maybeOperator(left[2])) {
				return this.parse(left, options);
			}


			return;

		}



	}

	class SqGroup {
		constructor(val, options = {}) {
			if (!Array.isArray(val)) {
				throw new Error('First argument must be an array or object');
			}
			this.options = this._normalizeOptions(options);
			this.isAny = this.options.isAny;
			this.items = this._normalizeItems(val);
		}

		_normalizeIsAny(values) {
			let { anyWord, everyWord, isAny } = this.options;
			if (values[anyWord] != null) {
				return true;
			} else if (values[everyWord] != null) {
				return false;
			}
			return isAny;
		}
		_normalizeOptions(options = {}) {
			let { 
				isAny = config.defaultIsAny, 
				anyWord = config.anyWord, 
				everyWord = config.everyWord, 
				dialect = config.defaultDialect
			} = options;
			let word = isAny ? anyWord : everyWord;
			return { isAny, word, anyWord, everyWord, dialect };
		}

		_normalizeItems(values) {
			
			if (values == null || typeof values !== 'object') return [];

			if (!Array.isArray(values)) {
				let word = this.isAny ? this.options.anyWord : this.options.everyWord;
				return this._normalizeItems(value[word]);
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

		}

		_normalizeItem(raw) {
			let sqitem = SqItem.parse(raw, this.options);
			if (sqitem) {
				return sqitem;
			}
			let sqgroup = SqGroup.parse(raw, this.options);
			if (sqgroup) {
				return sqgroup;
			}
		}



		getDialect() {
			return this.options.dialect;
		}

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
					}
				}
			}
		}

		toString(options = {}) {
			let dialect = options.dialect || this.getDialect();
			if (dialect && dialect.groupToString) {
				return dialect.groupToString(this, options);
			} else {
				return JSON.stringify(this, null, '\t');
			}
		}

		filter(model, options) {
			let result = false;
			for (let x =0; x < this.items.length; x++) {
				let item = this.items[x];
				result = item.filter(model, options);
				if ((result && this.isAny) || (!result && !this.isAny)) {
					return result;
				}
			}
			return result;
		}


		_join(arg, isAny) {
			if (this.isAny === isAny) {
				let items = this._normalizeItems(arg);
				this.items.push(items);
			} else {
				let opts = Object.assign({}, this.options, { isAny });
				return SqGroup.parse([arg, this], opts);
			}
		}

		or(arg) {
			return this._join(arg, true);
		}
		and(arg) {
			return this._join(arg, false);
		}

		static parse(val, options = {}) {
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
				let opts = Object.assign({}, options, { isAny: !!val[anyWord]});
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
			} catch(e) {
				return;
			}



		}


	}

	function sqParse(data, options) {
		return SqGroup.parse(data, options);
	}

	function sqFilter(data, options) {
		let grp = sqParse(data, options);
		if (!grp) return () => false;
		return model => grp.filter(model);
	}

	exports.sqParse = sqParse;
	exports.sqFilter = sqFilter;
	exports.config = config;
	exports.SqDialect = SqDialect;
	exports.SqGroup = SqGroup;
	exports.SqItem = SqItem;
	exports.SqItemValue = SqItemValue;
	exports.SqOperator = SqOperator;
	exports.tabulate = tabulate;

	return exports;

}({}));
