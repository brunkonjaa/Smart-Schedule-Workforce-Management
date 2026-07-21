const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '../../..');
const reviewedDatabaseFixturePaths = new Set([
  '.env.example',
  '.github/workflows/backend-checks.yml',
  'backend/local-evidence.env.example',
  'backend/src/__tests__/db-config.test.js',
  'scripts/smart_schedule_test_menu.py',
  'scripts/smart_schedule_test_menu_updated.py'
]);
const highConfidencePatterns = [
  {
    label: 'database URL containing credentials',
    pattern: /postgres(?:ql)?:\/\/[^\s:'"@]+:[^\s'"@]+@/gi
  },
  {
    label: 'GitHub access token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g
  },
  {
    label: 'Brevo API key',
    pattern: /\bxkeysib-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    label: 'private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  }
];

const runGit = (args) => {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  if (result.status !== 0) {
    throw new Error(
      result.error?.message || result.stderr.trim() || `git ${args.join(' ')} failed`
    );
  }

  return result.stdout;
};

const findPatternLabels = (text, filePath) => {
  return highConfidencePatterns
    .filter(({ label, pattern }) => {
      if (
        label === 'database URL containing credentials' &&
        reviewedDatabaseFixturePaths.has(filePath)
      ) {
        return false;
      }

      pattern.lastIndex = 0;
      return pattern.test(text);
    })
    .map(({ label }) => label);
};

const scanCurrentFiles = (trackedFiles) => {
  const findings = [];

  trackedFiles.forEach((relativePath) => {
    const absolutePath = path.join(repositoryRoot, relativePath);
    let content;

    try {
      content = fs.readFileSync(absolutePath);
    } catch (error) {
      return;
    }

    if (content.includes(0)) {
      return;
    }

    findPatternLabels(content.toString('utf8'), relativePath).forEach((label) => {
      findings.push({ label, path: relativePath });
    });
  });

  return findings;
};

const scanHistory = () => {
  const history = runGit([
    'log',
    '--all',
    '--format=__COMMIT__%H',
    '--patch',
    '--no-ext-diff',
    '--no-textconv'
  ]);
  const findings = [];
  let commit = null;
  let filePath = null;

  history.split(/\r?\n/).forEach((line) => {
    if (line.startsWith('__COMMIT__')) {
      commit = line.slice('__COMMIT__'.length);
      filePath = null;
      return;
    }

    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      filePath = match ? match[2] : null;
      return;
    }

    if (!filePath || (!line.startsWith('+') && !line.startsWith('-'))) {
      return;
    }

    if (line.startsWith('+++') || line.startsWith('---')) {
      return;
    }

    findPatternLabels(line.slice(1), filePath).forEach((label) => {
      findings.push({ commit, label, path: filePath });
    });
  });

  return findings.filter((finding, index, allFindings) => {
    return allFindings.findIndex((candidate) => {
      return candidate.commit === finding.commit &&
        candidate.label === finding.label &&
        candidate.path === finding.path;
    }) === index;
  });
};

const listLargestTrackedFiles = (trackedFiles, count = 15) => {
  return trackedFiles
    .map((relativePath) => {
      const absolutePath = path.join(repositoryRoot, relativePath);
      try {
        return { bytes: fs.statSync(absolutePath).size, path: relativePath };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, count);
};

const trackedFiles = runGit(['ls-files', '-z']).split('\0').filter(Boolean);
const currentFindings = scanCurrentFiles(trackedFiles);
const historyFindings = scanHistory();

console.log('Tracked-file secret scan');
console.log(currentFindings.length === 0
  ? 'No high-confidence secret pattern was found in the current tracked files.'
  : `${currentFindings.length} high-confidence pattern match(es) need review.`);
currentFindings.forEach((finding) => {
  console.log(`- ${finding.label}: ${finding.path}`);
});
console.log('Reviewed non-secret database URL fixtures:');
reviewedDatabaseFixturePaths.forEach((filePath) => {
  console.log(`- ${filePath}`);
});

console.log('\nGit-history secret scan');
console.log(historyFindings.length === 0
  ? 'No high-confidence secret pattern was found in Git patch history.'
  : `${historyFindings.length} historical high-confidence pattern match(es) need review.`);
historyFindings.forEach((finding) => {
  console.log(`- ${finding.label}: ${finding.path} at ${finding.commit.slice(0, 12)}`);
});

console.log('\nLargest tracked files');
listLargestTrackedFiles(trackedFiles).forEach((file) => {
  console.log(`- ${file.bytes} bytes: ${file.path}`);
});

if (currentFindings.length > 0 || historyFindings.length > 0) {
  process.exitCode = 1;
}
