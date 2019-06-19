import config from './config';

import SqItemValue from './SqItemValue';
import { isSimpleValue } from './helpers';
import SqOperator, { maybeOperator } from './SqOperator';


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


export default SqItem
