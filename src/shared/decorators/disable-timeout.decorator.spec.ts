import {
  IS_DISABLED_TIMEOUT,
  DisableTimeout,
} from './disable-timeout.decorator';

describe('DisableTimeout decorator', () => {
  it('should export IS_DISABLED_TIMEOUT key', () => {
    expect(IS_DISABLED_TIMEOUT).toBe('isDisabledTimeout');
  });

  it('should set metadata with IS_DISABLED_TIMEOUT key as true', () => {
    class TestClass {
      @DisableTimeout()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      IS_DISABLED_TIMEOUT,
      TestClass.prototype.testMethod,
    );
    expect(metadata).toBe(true);
  });
});
