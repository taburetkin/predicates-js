export function tabulate(text, num) {
	if (!text) return text;
	let tabs = '\t'.repeat(num);
	return text.replace(/^(.)/gmi, tabs + '$1');
}


export function merge(mutated, ...args) {
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

export function isSimpleValue(arg) {
	if (Array.isArray(arg) || typeof arg === 'function') return false;
	if (arg == null || typeof arg !== 'object') return true;
	if (arg.valueOf && typeof arg.valueOf() !== 'object') {
		return true;
	}
	return false;
}

