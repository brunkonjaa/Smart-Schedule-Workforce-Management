const fullCommitPattern = /^[0-9a-f]{40}$/i;

function getReleaseCommit(environment = process.env) {
  const commit = environment.RENDER_GIT_COMMIT?.trim();

  if (!commit || !fullCommitPattern.test(commit)) {
    return null;
  }

  return commit.toLowerCase();
}

module.exports = {
  getReleaseCommit
};
