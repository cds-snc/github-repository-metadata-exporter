const queryBranchProtection = async (octokit, owner, repo, branch = "main") => {
  const response = await octokit.rest.repos.getBranchProtection({
    branch: branch,
    owner: owner,
    repo: repo,
  });
  switch (response.status) {
    case 404:
      return { branch: branch, enabled: false };

    case 200:
      return response.data;

    default:
      throw new Error(
        `Failed to get branch protection for ${branch} on ${owner}/${repo}: ${response.status}`
      );
  }
};

const queryRepository = async (octokit, owner, repo) => {
  const response = await octokit.rest.repos.get({
    owner: owner,
    repo: repo,
  });
  if (response.status !== 200) {
    throw new Error(
      `Error querying repository ${owner}/${repo}: ${response.status}`
    );
  }
  return response.data;
};

module.exports = {
  queryBranchProtection: queryBranchProtection,
  queryRepository: queryRepository,
};
