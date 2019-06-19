module.exports = [{
	input: 'index.js',
	output: {
	  file: 'browser/predicates.esm.js',
	  format: 'esm'
	}
  },{
	input: 'index.js',
	output: {
	  file: 'browser/predicates.iife.js',
	  format: 'iife',
	  name: 'predicatesJs'
	}
}];
