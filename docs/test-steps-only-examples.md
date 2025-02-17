# testStepsOnly Configuration Option - Examples

You can control the kind of test steps included in report.

If you need full verbosity or need to have results for your test hooks, then you will need to include all the steps. However, if all you need is either test result or top level steps without any child steps like fixtures, Playwright API calls etc., then you will need to opt for inclusion of only `test.step` category steps.

You can control this behavior through `testStepsOnly` configuration option.

By default, `testStepsOnly` is set to false and therefore the report includes all the steps, that you would see on the Playwright's default HTML report. This brings the `Playwright CTRF JSON Report` to parity with `Playwright's default HTML report`, in terms of test steps reporting.

Below are some examples of how the report will look based on the `testStepsOnly` configuration.

## `testStepsOnly: false` (default)

### Simple test - No `test.step()` used.

```typescript
test('has title @title', async ({ page }) => {
  await page.goto('https://playwright.dev/')

  await expect(page).toHaveTitle(/Playwright/)
})
```

A simple test like above, will be reported as:

```json
{
  "name": "has title @title",
  "status": "passed",
  "duration": 646,
  "start": 1729438996,
  "stop": 1729438997,
  "rawStatus": "passed",
  "tags": [
    "@title"
  ],
  "type": "e2e",
  "filePath": "/path-to-project-dir/tests/example.spec.ts",
  "retries": 0,
  "flaky": false,
  "steps": [
    {
      "name": "Before Hooks",
      "status": "passed",
      "extra": {
        "category": "hook",
        "duration": 139,
        "childSteps": [
          {
            "name": "fixture: browser",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 105,
              "childSteps": [
                {
                  "name": "browserType.launch",
                  "status": "passed",
                  "extra": {
                    "category": "pw:api",
                    "duration": 104,
                    "childSteps": []
                  }
                }
              ]
            }
          },
          {
            "name": "fixture: context",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 6,
              "childSteps": [
                {
                  "name": "browser.newContext",
                  "status": "passed",
                  "extra": {
                    "category": "pw:api",
                    "duration": 4,
                    "childSteps": []
                  }
                }
              ]
            }
          },
          {
            "name": "fixture: page",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 22,
              "childSteps": [
                {
                  "name": "browserContext.newPage",
                  "status": "passed",
                  "extra": {
                    "category": "pw:api",
                    "duration": 22,
                    "childSteps": []
                  }
                }
              ]
            }
          }
        ]
      }
    },
    {
      "name": "page.goto(https://playwright.dev/)",
      "status": "passed",
      "extra": {
        "category": "pw:api",
        "duration": 494,
        "location": {
          "file": "/path-to-project-dir/tests/example.spec.ts",
          "line": 4,
          "column": 14
        },
        "childSteps": []
      }
    },
    {
      "name": "expect.soft.toHaveTitle",
      "status": "passed",
      "extra": {
        "category": "expect",
        "duration": 46,
        "location": {
          "file": "/path-to-project-dir/tests/example.spec.ts",
          "line": 7,
          "column": 27
        },
        "childSteps": []
      }
    },
    {
      "name": "After Hooks",
      "status": "passed",
      "extra": {
        "category": "hook",
        "duration": 73,
        "childSteps": [
          {
            "name": "fixture: page",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 1,
              "childSteps": []
            }
          },
          {
            "name": "fixture: context",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 0,
              "childSteps": []
            }
          }
        ]
      }
    }
  ],
  "suite": "chromium > example.spec.ts",
  "extra": {
    "annotations": []
  }
},
```

### Test with nested steps - `test.step()` usage

```ts
// beforeEach hook, will be included in CTRF report.
test.beforeEach(async ({ page }) => {
  await page.goto('https://playwright.dev/')
})

test(
  'with nested steps',
  { tag: ['@steps', '@nested-steps'] },
  async ({ page }) => {
    await test.step('Verify page title contains Playwright', async () => {
      await expect.soft(page).toHaveTitle(/Playwright/)
    })

    // No test.step() usage for this step, but it will be included in CTRF report.
    await page.getByRole('link', { name: 'Get started' }).click()

    await test.step('Verify Installation heading is visible', async () => {
      await expect
        .soft(page.getByRole('heading', { name: 'Installation' }))
        .toBeVisible()
    })
  }
)
```

A test having `test.step()` as steps, will be reported as:

```json
{
  "name": "with nested steps",
  "status": "passed",
  "duration": 1050,
  "start": 1729445458,
  "stop": 1729445459,
  "rawStatus": "passed",
  "tags": [],
  "type": "e2e",
  "filePath": "/path-to-project-dir/tests/example.spec.ts",
  "retries": 0,
  "flaky": false,
  "steps": [
    {
      "name": "Before Hooks",
      "status": "passed",
      "extra": {
        "category": "hook",
        "duration": 775,
        "childSteps": [
          {
            "name": "beforeEach hook",
            "status": "passed",
            "extra": {
              "category": "hook",
              "duration": 774,
              "location": {
                "file": "/path-to-project-dir/tests/example.spec.ts",
                "line": 3,
                "column": 6
              },
              "childSteps": [
                {
                  "name": "fixture: browser",
                  "status": "passed",
                  "extra": {
                    "category": "fixture",
                    "duration": 117,
                    "childSteps": [
                      {
                        "name": "browserType.launch",
                        "status": "passed",
                        "extra": {
                          "category": "pw:api",
                          "duration": 116,
                          "childSteps": []
                        }
                      }
                    ]
                  }
                },
                {
                  "name": "fixture: context",
                  "status": "passed",
                  "extra": {
                    "category": "fixture",
                    "duration": 8,
                    "childSteps": [
                      {
                        "name": "browser.newContext",
                        "status": "passed",
                        "extra": {
                          "category": "pw:api",
                          "duration": 5,
                          "childSteps": []
                        }
                      }
                    ]
                  }
                },
                {
                  "name": "fixture: page",
                  "status": "passed",
                  "extra": {
                    "category": "fixture",
                    "duration": 23,
                    "childSteps": [
                      {
                        "name": "browserContext.newPage",
                        "status": "passed",
                        "extra": {
                          "category": "pw:api",
                          "duration": 22,
                          "childSteps": []
                        }
                      }
                    ]
                  }
                },
                {
                  "name": "page.goto(https://playwright.dev/)",
                  "status": "passed",
                  "extra": {
                    "category": "pw:api",
                    "duration": 620,
                    "location": {
                      "file": "/path-to-project-dir/tests/example.spec.ts",
                      "line": 4,
                      "column": 14
                    },
                    "childSteps": []
                  }
                }
              ]
            }
          }
        ]
      }
    },
    {
      "name": "Verify page title contains Playwright",
      "status": "passed",
      "extra": {
        "category": "test.step",
        "duration": 48,
        "location": {
          "file": "/path-to-project-dir/tests/example.spec.ts",
          "line": 29,
          "column": 14
        },
        "childSteps": [
          {
            "name": "expect.soft.toHaveTitle",
            "status": "passed",
            "extra": {
              "category": "expect",
              "duration": 45,
              "location": {
                "file": "/path-to-project-dir/tests/example.spec.ts",
                "line": 30,
                "column": 29
              },
              "childSteps": []
            }
          }
        ]
      }
    },
    {
      "name": "locator.getByRole('link', { name: 'Get started' }).click",
      "status": "passed",
      "extra": {
        "category": "pw:api",
        "duration": 80,
        "location": {
          "file": "/path-to-project-dir/tests/example.spec.ts",
          "line": 34,
          "column": 57
        },
        "childSteps": []
      }
    },
    {
      "name": "Verify Installation heading is visible",
      "status": "passed",
      "extra": {
        "category": "test.step",
        "duration": 156,
        "location": {
          "file": "/path-to-project-dir/tests/example.spec.ts",
          "line": 37,
          "column": 14
        },
        "childSteps": [
          {
            "name": "expect.soft.toBeVisible",
            "status": "passed",
            "extra": {
              "category": "expect",
              "duration": 155,
              "location": {
                "file": "/path-to-project-dir/tests/example.spec.ts",
                "line": 38,
                "column": 76
              },
              "childSteps": []
            }
          }
        ]
      }
    },
    {
      "name": "After Hooks",
      "status": "passed",
      "extra": {
        "category": "hook",
        "duration": 110,
        "childSteps": [
          {
            "name": "fixture: page",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 0,
              "childSteps": []
            }
          },
          {
            "name": "fixture: context",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 0,
              "childSteps": []
            }
          }
        ]
      }
    }
  ],
  "suite": "chromium > example.spec.ts",
  "extra": {
    "annotations": []
  }
},
}
```

### BDD Style test - using [Playwright-bdd](https://vitalets.github.io/playwright-bdd/#/)

```gherkin
@login
Feature: User Login

  Background:
      Given the User is on login page

  @locked_out_user
  Scenario: Test that a Locked out user is not able to login despite using valid login credentials
      When the User tries to login with "locked_out_user" as username and "secret_sauce" as password
      Then the User should see a locked out error message
```

A BDD styled test like the one above, will be reported as:

```json
{
  "name": "Test that a Locked out user is not able to login despite using valid login credentials",
  "status": "passed",
  "duration": 663,
  "start": 1729441890,
  "stop": 1729441891,
  "rawStatus": "passed",
  "tags": [],
  "type": "e2e",
  "filePath": "/path-to-project-dir/.features-gen/feature/login.feature.spec.js",
  "retries": 0,
  "flaky": false,
  "steps": [
    {
      "name": "Before Hooks",
      "status": "passed",
      "extra": {
        "category": "hook",
        "duration": 506,
        "childSteps": [
          {
            "name": "beforeEach hook",
            "status": "passed",
            "extra": {
              "category": "hook",
              "duration": 505,
              "location": {
                "file": "/path-to-project-dir/.features-gen/feature/login.feature.spec.js",
                "line": 6,
                "column": 8
              },
              "childSteps": [
                {
                  "name": "fixture: context",
                  "status": "passed",
                  "extra": {
                    "category": "fixture",
                    "duration": 3,
                    "childSteps": [
                      {
                        "name": "browser.newContext",
                        "status": "passed",
                        "extra": {
                          "category": "pw:api",
                          "duration": 1,
                          "childSteps": []
                        }
                      }
                    ]
                  }
                },
                {
                  "name": "fixture: page",
                  "status": "passed",
                  "extra": {
                    "category": "fixture",
                    "duration": 16,
                    "childSteps": [
                      {
                        "name": "browserContext.newPage",
                        "status": "passed",
                        "extra": {
                          "category": "pw:api",
                          "duration": 16,
                          "childSteps": []
                        }
                      }
                    ]
                  }
                },
                {
                  "name": "fixture: loginPage",
                  "status": "passed",
                  "extra": {
                    "category": "fixture",
                    "duration": 0,
                    "location": {
                      "file": "/path-to-project-dir/pages/fixtures.ts",
                      "line": 16,
                      "column": 26
                    },
                    "childSteps": []
                  }
                },
                {
                  "name": "Given the User is on login page",
                  "status": "passed",
                  "extra": {
                    "category": "test.step",
                    "duration": 484,
                    "location": {
                      "file": "/path-to-project-dir/.features-gen/feature/login.feature.spec.js",
                      "line": 7,
                      "column": 11
                    },
                    "childSteps": [
                      {
                        "name": "page.goto(https://www.saucedemo.com)",
                        "status": "passed",
                        "extra": {
                          "category": "pw:api",
                          "duration": 483,
                          "location": {
                            "file": "/path-to-project-dir/pages/login-page.ts",
                            "line": 19,
                            "column": 25,
                            "function": "LoginPage.goto"
                          },
                          "childSteps": []
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },
    {
      "name": "When the User tries to login with \"locked_out_user\" as username and \"secret_sauce\" as password",
      "status": "passed",
      "extra": {
        "category": "test.step",
        "duration": 88,
        "location": {
          "file": "/path-to-project-dir/.features-gen/feature/login.feature.spec.js",
          "line": 49,
          "column": 11
        },
        "childSteps": [
          {
            "name": "locator.fill([data-test=\"username\"])",
            "status": "passed",
            "extra": {
              "category": "pw:api",
              "duration": 21,
              "location": {
                "file": "/path-to-project-dir/pages/login-page.ts",
                "line": 23,
                "column": 29,
                "function": "LoginPage.doLogin"
              },
              "childSteps": []
            }
          },
          {
            "name": "locator.fill([data-test=\"password\"])",
            "status": "passed",
            "extra": {
              "category": "pw:api",
              "duration": 7,
              "location": {
                "file": "/path-to-project-dir/pages/login-page.ts",
                "line": 24,
                "column": 29,
                "function": "LoginPage.doLogin"
              },
              "childSteps": []
            }
          },
          {
            "name": "locator.click([data-test=\"login-button\"])",
            "status": "passed",
            "extra": {
              "category": "pw:api",
              "duration": 57,
              "location": {
                "file": "/path-to-project-dir/pages/login-page.ts",
                "line": 25,
                "column": 32,
                "function": "LoginPage.doLogin"
              },
              "childSteps": []
            }
          }
        ]
      }
    },
    {
      "name": "Then the User should see a locked out error message",
      "status": "passed",
      "extra": {
        "category": "test.step",
        "duration": 8,
        "location": {
          "file": "/path-to-project-dir/.features-gen/feature/login.feature.spec.js",
          "line": 50,
          "column": 11
        },
        "childSteps": [
          {
            "name": "expect.toBeVisible",
            "status": "passed",
            "extra": {
              "category": "expect",
              "duration": 3,
              "location": {
                "file": "/path-to-project-dir/step-definitions/login.steps.ts",
                "line": 13,
                "column": 42,
                "function": "Object.<anonymous>"
              },
              "childSteps": []
            }
          },
          {
            "name": "locator.textContent([data-test=\"error\"])",
            "status": "passed",
            "extra": {
              "category": "pw:api",
              "duration": 2,
              "location": {
                "file": "/path-to-project-dir/step-definitions/login.steps.ts",
                "line": 15,
                "column": 52,
                "function": "Object.<anonymous>"
              },
              "childSteps": []
            }
          },
          {
            "name": "expect.toEqual",
            "status": "passed",
            "extra": {
              "category": "expect",
              "duration": 1,
              "location": {
                "file": "/path-to-project-dir/step-definitions/login.steps.ts",
                "line": 16,
                "column": 23,
                "function": "Object.<anonymous>"
              },
              "childSteps": []
            }
          }
        ]
      }
    },
    {
      "name": "After Hooks",
      "status": "passed",
      "extra": {
        "category": "hook",
        "duration": 61,
        "childSteps": [
          {
            "name": "fixture: loginPage",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 0,
              "location": {
                "file": "/path-to-project-dir/pages/fixtures.ts",
                "line": 16,
                "column": 26
              },
              "childSteps": []
            }
          },
          {
            "name": "fixture: page",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 0,
              "childSteps": []
            }
          },
          {
            "name": "fixture: context",
            "status": "passed",
            "extra": {
              "category": "fixture",
              "duration": 0,
              "childSteps": []
            }
          }
        ]
      }
    }
  ],
  "suite": "chromium > feature/login.feature.spec.js > User Login",
  "extra": {
    "annotations": []
  }
}
```

## `testStepsOnly: true`

### Simple test - No `test.step()` used.

```ts
test('has title @title', async ({ page }) => {
  await page.goto('https://playwright.dev/')

  await expect(page).toHaveTitle(/Playwright/)
})
```

Simple test above will be reported as:

> ⚠️ Notice that no steps are reported in CTRF JSON, as both the steps belong to 'pw:api' and 'expect' categories, respectively.

```json
{
  "name": "has title @title",
  "status": "passed",
  "duration": 1140,
  "start": 1729428643,
  "stop": 1729428644,
  "rawStatus": "passed",
  "tags": [
    "@title"
  ],
  "type": "e2e",
  "filePath": "/path-to-project-dir/tests/example.spec.ts",
  "retries": 0,
  "flaky": false,
  "steps": [],
  "suite": "chromium > example.spec.ts",
  "extra": {
    "annotations": []
  }
},
```

### Test with nested steps - `test.step()` usage

```ts
// beforeEach hook, will NOT be included in CTRF report.
test.beforeEach(async ({ page }) => {
  await page.goto('https://playwright.dev/')
})

test(
  'with nested steps',
  { tag: ['@steps', '@nested-steps'] },
  async ({ page }) => {
    await test.step('Navigate to Playwright homepage', async () => {
      await page.goto('https://playwright.dev/')
    })

    await test.step('Verify page title contains Playwright', async () => {
      await expect(page).toHaveTitle(/Playwright/)
    })

    // No test.step() used for this step, it will NOT be included in CTRF report.
    await page.getByRole('link', { name: 'Get started' }).click()

    await test.step('Verify Installation heading is visible', async () => {
      await expect(
        page.getByRole('heading', { name: 'Installation' })
      ).toBeVisible()
    })
  }
)
```

A test with `test.step()` usage, will be reported as:

> ⚠️ Notice that the step inside 'beforeEach' hook is not included as it is a child step of 'beforeEach' hook (which belongs to 'hook' category), and the step where 'test.step()' is not used inside the test, is also omitted because it belongs to 'pw:api' category. Similarly, all steps inside the 'beforeAll/afterAll/afterEach' hooks will not be included.

```json
{
  "name": "with nested steps",
  "status": "passed",
  "duration": 917,
  "start": 1729442874,
  "stop": 1729442875,
  "rawStatus": "passed",
  "tags": [],
  "type": "e2e",
  "filePath": "/path-to-project-dir/tests/example.spec.ts",
  "retries": 0,
  "flaky": false,
  "steps": [
    {
      "name": "Verify page title contains Playwright",
      "status": "passed",
      "extra": {
        "category": "test.step",
        "duration": 45,
        "location": {
          "file": "/path-to-project-dir/tests/example.spec.ts",
          "line": 29,
          "column": 14
        },
        "childSteps": []
      }
    },
    {
      "name": "Verify Installation heading is visible",
      "status": "passed",
      "extra": {
        "category": "test.step",
        "duration": 363,
        "location": {
          "file": "/path-to-project-dir/tests/example.spec.ts",
          "line": 37,
          "column": 14
        },
        "childSteps": []
      }
    }
  ],
  "suite": "chromium > example.spec.ts",
  "extra": {
    "annotations": []
  }
}
```

### BDD Style test - using [Playwright-bdd](https://vitalets.github.io/playwright-bdd/#/)

```gherkin
@login
Feature: User Login

  Background:
      Given the User is on login page

  @locked_out_user
  Scenario: Test that a Locked out user is not able to login despite using valid login credentials
      When the User tries to login with "locked_out_user" as username and "secret_sauce" as password
      Then the User should see a locked out error message
```

A BDD styled test like the one above, is reported as shown below.

> ⚠️ Notice that the step in the 'Background' hook is not included. Similarly, any steps or fixtures executed as part of 'After' hooks will be omitted as well.

```json
{
  "name": "Test that a Locked out user is not able to login despite using valid login credentials",
  "status": "passed",
  "duration": 644,
  "start": 1729431624,
  "stop": 1729431625,
  "rawStatus": "passed",
  "tags": [],
  "type": "e2e",
  "filePath": "/path-to-project-dir/.features-gen/feature/login.feature.spec.js",
  "retries": 0,
  "flaky": false,
  "steps": [
    {
      "name": "When the User tries to login with \"locked_out_user\" as username and \"secret_sauce\" as password",
      "status": "passed",
      "extra": {
        "category": "test.step",
        "duration": 69,
        "location": {
          "file": "/path-to-project-dir/.features-gen/feature/login.feature.spec.js",
          "line": 49,
          "column": 11
        },
        "childSteps": []
      }
    },
    {
      "name": "Then the User should see a locked out error message",
      "status": "passed",
      "extra": {
        "category": "test.step",
        "duration": 7,
        "location": {
          "file": "/path-to-project-dir/.features-gen/feature/login.feature.spec.js",
          "line": 50,
          "column": 11
        },
        "childSteps": []
      }
    }
  ],
  "suite": "chromium > feature/login.feature.spec.js > User Login",
  "extra": {
    "annotations": []
  }
}
```

## BDD styled tests with [Cucumber](https://cucumber.io/docs/guides/overview/)

BDD styled tests that use cucumber as test runner are not supported. Only [playwright-bdd](https://vitalets.github.io/playwright-bdd/#/) is supported because it uses [Playwright Test](https://playwright.dev/docs/test-configuration) as a test runner to execute the tests.
