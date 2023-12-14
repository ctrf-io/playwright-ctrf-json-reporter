# Playwright JSON Reporter - CTRF

`playwright-ctrf-json-reporter` is a Playwright test reporter that generates JSON test reports that are [CTRF](https://ctrf.io) compliant.

No matter which test framework or library you use, generate the same JSON report with [Common Test Report Format](https://ctrf.io)

## Features

- Generate detailed JSON test reports that are [CTRF](https://ctrf.io) compliant
- Customizable output options, generate minimal or comprehensive reports.
- Straightforward integration with Playwright

## Installation

```bash
npm install --save-dev playwright-ctrf-json-reporter
```

To configure the reporter, add it to your playwright.config.ts/js file.

```javascript
  reporter: [
    ['list'], // You can combine multiple reporters
    ['playwright-ctrf-json-reporter', {}]
  ],
```

## Usage

Simply run your tests:

```bash
npx playwright test
```

You'll find a JSON file named `ctrf-report.json` in the root of your project.

## Reporter Options

The reporter supports several configuration options, by default a comprehensive report is generated.

```javascript
 reporter: [
    ['playwright-ctrf-json-reporter', {
      outputFile: 'custom-name.json',
      outputDir: 'custom-directory',
      'minimal': true,
       // ... other options ...
    }]
  ],
```

You can set reporter options as follows:

| Name         | Default                   | Description                                                                                                                          |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `outputFile` | `'ctrf-report.json'`      | The name of the test reportfile.                                                                                                     |
| `outputDir`  | `'.'` (current directory) | Directory where the report file will be generated.                                                                                   |
| `minimal`    | `false`                   | Minimal report with only required CTRF properties, [more information](https://ctrf.io/docs/schema/examples#required-properties-only) |
| `start`      | `true`                    | Include the start time of each test                                                                                                  |
| `stop`       | `true`                    | Include the stop/end time of each test                                                                                               |
| `suite`      | `true`                    | Include the suite name with each test                                                                                                |
| `message`    | `true`                    | Include failure message for failed tests.                                                                                            |
| `trace`      | `true`                    | Include stack trace information for failed tests.                                                                                    |
| `rawStatus`  | `true`                    | Include the Playwright status of each test.                                                                                          |
| `tags`       | `true`                    | Includes tags with each test.                                                                                                        |
| `type`       | `true`                    | Include the type of test (e.g., 'unit', 'e2e').                                                                                      |
| `filePath`   | `true`                    | Include the file path of each test                                                                                                   |
| `retry`      | `true`                    | Include retry count of each test if retries occurred.                                                                                |
| `flake`      | `true`                    | Include flake status with each test                                                                                                  |
| `browser`    | `false`                   | Include the browser used for the test (if applicable).                                                                               |
| `screenshot` | `false`                   | Include screenshot of each test (if applicable)                                                                                      |
| `customType` | `'e2e'`                   | Specify a custom type for the tests.                                                                                                 |

## Advanced usage

Some options require additional setup or usage considerations.

### Screenshots

The `screenshots` option in the reporter configuration allows you to include base-64 screenshots in your test report, you'll need to capture and attach screenshots in your Playwright tests:

```javascript
import { test, expect } from '@playwright/test'

test('basic test', async ({ page }, testInfo) => {
  await page.goto('https://playwright.dev')
  const screenshot = await page.screenshot({ quality: 50, type: 'jpeg' })
  await testInfo.attach('screenshot', {
    body: screenshot,
    contentType: 'image/jpeg',
  })
})
```

#### Supported Formats:

Both JPEG and PNG formats are supported and only the last screenshot attached from each test will be included in the report.

#### Size Considerations:

Base64-encoded image data can greatly increase the size of your report, it's recommended to use screenshots with a lower quality setting (less than 50%) to reduce file size, particularly if you are generating JPEG images. This trade-off between image quality and file size can help keep your reports more manageable.

### Browser

The `browser` option allows you to include browser in your test report. You will need to extend Playwright's test object to capture and attach browser metadata. Here's an example of how you can do this:

```javascript
// tests/helpers.ts
import { test as _test, expect } from '@playwright/test';
import os from 'os';

export const test = _test.extend<{ _autoAttachMetadata: void }>({
    _autoAttachMetadata: [async ({ browser, browserName }, use, testInfo) => {
        // BEFORE: Generate an attachment for the test with the required info
        await testInfo.attach('metadata.json', {
            body: JSON.stringify({
                name: browserName,
                version: browser.version(),
            })
        })

        // ---------------------------------------------------------
        await use(/** our test doesn't need this fixture direcly */);
        // ---------------------------------------------------------

        // AFTER: There's nothing to cleanup in this fixutre
    }, { auto: true }],
})

export { expect };
```

Replace the standard Playwright test import with the custom test fixture in your test files:

```javascript
// tests/my-test.spec.ts
import { test, expect } from './helpers' // Adjust the path as necessary

test('example test', async ({ page }) => {
  // ... your test logic ...
})
```

The browser metadata file must be called metadata.json and contain properties name and version in the body.
