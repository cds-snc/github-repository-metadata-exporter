const fs = require("fs");

const queryBranchProtection = async (octokit, owner, repo, branch = "main") => {
  const response = await octokit.rest.repos.getBranchProtection({
    branch: branch,
    owner: owner,
    repo: repo,
  });
  switch (response.status) {
    case 404:
      return {
        metadata_owner: owner,
        metadata_repo: repo,
        metadata_query: "branch_protection",
        metadata_branch: branch,
        enabled: false,
      };

    case 200:
      return {
        metadata_owner: owner,
        metadata_repo: repo,
        metadata_query: "branch_protection",
        metadata_branch: branch,
        ...response.data,
      };

    default:
      throw new Error(
        `Failed to get branch protection for ${branch} on ${owner}/${repo}: ${response.status}`
      );
  }
};

const queryCommitCount = async (octokit, owner, repo, timeInDays = 60) => {
  let date = new Date();
  let pastDate = new Date(
    date - timeInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  let commits = [];

  // Loop though all the pages of commits
  await octokit
    .paginate(octokit.rest.repos.listCommits, {
      owner: owner,
      repo: repo,
      since: pastDate,
    })
    .then((listedCommits) => {
      for (const commit of listedCommits) {
        commits.push({
          author: commit.author.login,
          date: commit.commit.author.date,
          verified: commit.commit.verification.verified,
          verified_reason: commit.commit.verification.reason,
        });
      }
    });

  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "commit_count",
    metadata_time_in_days: timeInDays,
    metadata_since: pastDate,
    commit_count: commits,
  };
};

const queryDependabotAlerts = async (octokit, owner, repo) => {
  let alerts = [];

  // Loop though all the pages of alerts
  await octokit
    .paginate(octokit.rest.dependabot.listAlertsForRepo, {
      owner: owner,
      repo: repo,
    })
    .then((listedAlerts) => {
      console.log(listedAlerts);
      for (const alert of listedAlerts) {
        if ("number" in alert) {
          alerts.push({
            id: alert.number,
            dependency: alert.dependency,
            ghsa_id: alert.security_advisory.ghsa_id,
            cve_id: alert.security_advisory.cve_id,
            severity: alert.security_advisory.severity,
            cvss: alert.security_advisory.cvss,
            cwes: alert.security_advisory.cwes,
            created_at: alert.created_at,
          });
        }
      }
    });

  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "dependabot_alerts",
    dependabot_alerts: alerts,
  };
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
  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "repository",
    ...response.data,
  };
};

const queryRequiredFiles = async (owner, repo) => {
  // Check if files exist on the current branch

  const files = [
    "README.md",
    "LICENSE",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
  ];

  let inventory = {};
  for (let file of files) {
    // To prevent the below path traversal attack, we explicitly define the
    // path to the file we want to check vs. passing them into the function
    //eslint-disable-next-line security/detect-non-literal-fs-filename
    inventory[String(file)] = fs.existsSync(file);
  }
  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "required_files",
    ...inventory,
  };
};

module.exports = {
  queryBranchProtection: queryBranchProtection,
  queryCommitCount: queryCommitCount,
  queryDependabotAlerts: queryDependabotAlerts,
  queryRepository: queryRepository,
  queryRequiredFiles: queryRequiredFiles,
};
