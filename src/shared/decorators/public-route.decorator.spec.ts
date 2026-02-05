import { IS_PUBLIC_ROUTE, PublicRoute } from './public-route.decorator';

describe('PublicRoute decorator', () => {
  it('should export IS_PUBLIC_ROUTE key', () => {
    expect(IS_PUBLIC_ROUTE).toBe('isPublicRoute');
  });

  it('should set metadata with IS_PUBLIC_ROUTE key as true', () => {
    class TestClass {
      @PublicRoute()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      IS_PUBLIC_ROUTE,
      TestClass.prototype.testMethod,
    );
    expect(metadata).toBe(true);
  });
});
