
// adds indentation to multiline text
export function tabulate(text, num = 1) {
  if (!text) return text;
  let tabs = '\t'.repeat(num);
  return text.replace(/^(.)/gim, tabs + '$1');
}

// merges given object with provided other objects
export function merge(mutated, ...args) {
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
export function isSimpleValue(arg) {
  if (Array.isArray(arg) || typeof arg === 'function') return false;
  if (arg == null || typeof arg !== 'object') return true;
  if (arg.valueOf && typeof arg.valueOf() !== 'object') {
    return true;
  }
  return false;
}


// takes first non undefined value from given contexts
export function pick(key, ...contexts) {
  let value;
  while (contexts.length || value === undefined) {
    let context = contexts.shift() || {};
    context && (value = context[key]);
  }
  return value;
}

// backbone's extend
export function extend(protoProps, staticProps) {
  let parent = this;
  let child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent constructor.
  if (protoProps && protoProps.hasOwnProperty('constructor')) {
    child = protoProps.constructor;
  } else {
    child = function() { return parent.apply(this, arguments); }
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
