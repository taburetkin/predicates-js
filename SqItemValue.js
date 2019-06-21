import config from './config';

class SqItemValue {
  constructor(value, ref, options) {
    this.options = options;
    this.value = value;
    this.ref = ref; // true or false, indicates is a value is a reference or not
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

  compare(rightItem, { model, compareValues } = {}) {
    let leftItem = this;

    let leftValue = leftItem.getValue(model);
    let rightValue =
      rightValue instanceof SqItemValue ? rightItem.getValue(model) : rightItem;

    let compare = compareValues || ((a, b) => a == b);
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

export default SqItemValue;
