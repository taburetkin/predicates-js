import config from './config';
import SqDialect from './SqDialect';
import SqGroup from './SqGroup';
import SqItem from './SqItem';
import SqItemValue from './SqItemValue';
import SqOperator from './SqOperator';

export { tabulate } from './helpers';


export function sqParse(data, options) {
	return SqGroup.parse(data, options);
}

export function sqFilter(data, options) {
	let sqg = sq(data, options);
	if (!sqg) return () => false;
	return model => sqg.filter(model);
}


export {
	config,
	SqDialect,
	SqGroup,
	SqItem,
	SqItemValue,
	SqOperator,
}
