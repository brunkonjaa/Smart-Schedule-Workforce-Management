const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '../../../frontend');

describe('PWA and browser output security', () => {
  test('the service worker caches only static assets and uses a clear offline page', () => {
    const serviceWorker = fs.readFileSync(
      path.join(frontendRoot, 'public/service-worker.js'),
      'utf8'
    );
    const offlinePage = fs.readFileSync(
      path.join(frontendRoot, 'public/offline.html'),
      'utf8'
    );

    expect(serviceWorker).toContain("const OFFLINE_URL = '/offline.html'");
    expect(serviceWorker).toContain("const STATIC_PATH_PREFIXES = ['/assets/images/', '/icons/', '/src/']");
    expect(serviceWorker).toContain("event.request.mode === 'navigate'");
    expect(serviceWorker).not.toContain("cache.add('/')");
    expect(serviceWorker).not.toContain("caches.match('/')");
    expect(serviceWorker).not.toContain("'/api/'");
    expect(serviceWorker).not.toContain("'/health'");
    expect(offlinePage).toContain('The current rota and NodyChat messages are not available');
  });

  test('user-facing services use text insertion instead of innerHTML', () => {
    const servicesDirectory = path.join(frontendRoot, 'src/services');
    const unsafeFiles = fs.readdirSync(servicesDirectory)
      .filter((fileName) => fileName.endsWith('.js'))
      .filter((fileName) => {
        const source = fs.readFileSync(path.join(servicesDirectory, fileName), 'utf8');
        return /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/.test(source);
      });
    const helpers = fs.readFileSync(
      path.join(servicesDirectory, 'live-ui-helpers.js'),
      'utf8'
    );

    expect(unsafeFiles).toEqual([]);
    expect(helpers).toContain('element.textContent = text');
  });

  test('the permitted external map link is HTTPS and isolates its new tab', () => {
    const swapUi = fs.readFileSync(
      path.join(frontendRoot, 'src/services/swap-requests-ui.js'),
      'utf8'
    );

    expect(swapUi).toContain('https://www.google.com/maps/dir/');
    expect(swapUi).toMatch(/rel:\s*'noopener noreferrer',[\s\S]*target:\s*'_blank'/);
    expect(swapUi).not.toMatch(/javascript:/i);
  });
});
