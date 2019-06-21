import SqItem from './SqItem';
import config from './config';

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

	toSql(options = {}) {
		!options.params && (options.params = []);
		let values = options.params;
		let text = this.toString(options);
		return { text, values };
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

	static filter(data, options = {}) {
		let sq = this.parse(data, options);
		if (!sq) {
			if (options.throwError !== false) {
				return () => true;
			} else {
				throw new Error('Unable to parse SqGroup from provided data');
			}
		}		
		return model => sq.filter(model, options.filterOptions);
	}

}


export default SqGroup;
