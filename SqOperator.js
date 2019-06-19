import { merge } from './helpers';

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

		if (Object.hasOwnProperty(another, 'toString')) {
			this._bind('toString', toString);
		}

		if (Object.hasOwnProperty(another, 'filter')) {
			this._bind('filter', filter);
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

export function maybeOperator(arg)
{
	return arg == null || arg instanceof SqOperator || typeof arg === 'string';
}


export default SqOperator;
