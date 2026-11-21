import { test, expect } from '../../src/fixtures/testFixture';

test.describe('Manual Baseline — Login & Authentication', () => {
  test('Manual: Valid user signs in and loads movie catalog @smoke @regression', async ({
    loginPage,
    movieListPage,
  }) => {
    await loginPage.goto();
    await loginPage.login('alice@cinebook.com', 'Cinema@123');
    await movieListPage.waitForView('movies');
    expect(await movieListPage.getMovieCount()).toBe(6);
  });

  test('Manual: Empty and invalid credentials show error message [BUG-05] @regression', async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.login('', '');
    const err = await loginPage.getErrorBanner();
    await expect(err, 'BUG-05: Empty login must be rejected with error banner').toBeVisible();
  });
});
