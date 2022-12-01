const queryRepository = (octokit, owner, repo) => {
  return octokit.rest.repos.get({
    owner: owner,
    repo: repo,
  });
};

module.exports = {
  queryRepository: queryRepository,
};
