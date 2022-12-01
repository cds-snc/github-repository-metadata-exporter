const queryRepository = (octokit, owner, repo) => {
  const response = octokit.rest.repos.get({
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
  queryRepository: queryRepository,
};
