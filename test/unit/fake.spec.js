import SqGroup from '../../SqGroup';
describe('when launching yarn test', function() {
  it('should execute tests', () => {
    expect(SqGroup).to.be.not.undefined;
  })
});
