import { merge, extend } from './helpers';

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
}

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
}

SqOperator.extend = extend;

export function maybeOperator(arg) {
  return arg == null || arg instanceof SqOperator || typeof arg === 'string';
}

export default SqOperator;
