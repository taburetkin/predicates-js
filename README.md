# predicate-js - (not stable yet)
Was designed to be used with front-end array filter and for creating database predicates from universal data type.


## usecases
array filter
```js

const data = [
	{id: 1, name: 'Bob', gender: 'male' },
	{id: 2, name: 'John', gender: 'male' },
	{id: 3, name: 'Maria', gender: 'female' },
];

let found = data.filter(SqGroup.filter({ id: 2 }));
// [ {id: 2, name: 'John', gender: 'male' } ]
```

t-sql where clause
```js

let sql = "SELECT * from Users";
let where = SqGroup.parse({ id: 2 }).toSql();
sql += ' where ' + where.text;

//
// sql: SELECT * from Users where id = $1
// where.values - holds the array of query parameters
// sends parametriezed query, assume that database is your some database framework, f.e. pg
database.query(sql, where.values);


```

## Dialects
predicates-js may supports different t-sql dialects, the default one is postgres.
If you need another you have to describe it by your self

## Complex queries
The main thing of predicate-js is that you can build a query with any kind of complexity, combining `and` and `or`

```js

let where = SqGroup.parse({ age: [18, 'greaterOrEqual'], gender: 'male' })
.and({ age: [35, 'less'])
.or({ gender: 'male' })

let text = where.toString({ inlineValues: true });

/*

(
	age >= 18
	and
	age < 35
	and
	gender = 'female
)
or
gender = 'male'

*/


```

## The query structure
The query consist of 4 elements
1. `SqGroup` - the group of SqItem values combined with one bitwise operator
2. `SqItem` - holds left SqItemValue, right SqItemValue and SqOperator
3. `SqItemValue` - holds value and value definition (reference or provided argument)
4. `SqOperator` - holds instructions about what to do with left and right values.

the query can be written in Json like this
```
{
   "any":[
      {
         "every":[
            ['[age]', 18, 'greaterOrEqual'],
            ['[age]', 35, 'less'],
            ['[gender]', 'female'], // the default operation is equal and third argument may be skipped
         ]
      },
      ['[gender]', 'male']
   ]
}
```
The example above contains value like `[age]`, this is dialect specific indicator that the value is actually a reference. This can be redefined in dialect itself.
The default dialect treat left values as reference values.  

For comparing with both reference value:
```js
SqGroup.parse({ foo: '[bar]'});
```
The left side is reference by default and for the right side we should provide dialect specific reference indicator.

## transfering between fronend and backend
```js
// client side
const search = SqGroup.parse({ foo: 'bar' });
post('/someurl', search.toJSON());


//servier side
app.post('/someurl', (req, res) => {
   const search = SqGroup.parse(req.body);
});

```


## Operators
there are predefined dialect operators:
- `'equal'`,
- `'notEqual'`,
- `'greater'`,
- `'greaterOrEqual'`,
- `'lesser'`,
- `'lesserOrEqual'`,
- `'startsWith'`,
- `'endsWith'`,
- `'notStartsWith'`,
- `'notEndsWith'`,
- `'contains'` - for strings,
- `'notContains'` - for strings,
- `'in'` - for arrays,
- `'notIn'` - for arrays,
- `'null'` - for special handling, in js handles null and undefined: x == null, in sql: is null,
- `'notNull'` - opposite,


## Looking for help
This lib is under construction and there is a lot of things should be done and maybe some refactoring too but the concept is ready.  
Feel free to join and help to develop, especially in `documentation` and `tests`.
