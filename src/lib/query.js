const fs = require("fs");
const path = require('path');

const queryActionDependencies = async (owner, repo) => {

  const workflowsRoot = path.join(__dirname, '/.github/workflows');

  // Find all files with a `.yml` extension in the workflows root
  const workflowFiles = await fs.promises.readdir(workflowsRoot, { withFileTypes: true })
    .then(files => files.filter(file => file.isFile() && (file.name.endsWith('.yml') || file.name.endsWith('.yaml'))))
    .then(files => files.map(file => path.join(repoRoot, file.name)));

  // Parse the contents of each workflow file and extract the `uses` values
  const usesList = [];
  for (const workflowFile of workflowFiles) {
    const workflowContent = await fs.promises.readFile(workflowFile, 'utf8');
    const lines = workflowContent.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('uses:') || line.trim().startsWith('- uses:')) {
        // Extract the name of the action and the SHA reference, if present
        const actionMatch = line.match(/uses: (.*)/);
        if (actionMatch) {
          const action = actionMatch[1];
          let name = action;
          let ref = null;
          if (action.includes('@')) {
            const parts = action.split('@');
            name = parts[0];
            ref = parts[1];
          }

          // Extract any comments denoted by a `#`
          let comment = null;
          const commentMatch = line.match(/# (.*)/);
          if (commentMatch) {
            comment = commentMatch[1];
          }

          usesList.push({ name, ref, comment });
        }
      }
    }
  }

  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "action_dependencies",
    action_dependencies: usesList,
  };


}

const queryBranchProtection = async (octokit, owner, repo, branch = "main") => {
  let response = { data: { enabled: false } };

  try {
    response = await octokit.rest.repos.getBranchProtection({
      branch: branch,
      owner: owner,
      repo: repo,
    });
  } catch (error) {
    if (error.status !== 404) {
      throw new Error(
        `Failed to get branch protection for ${branch} on ${owner}/${repo}: ${error.status}`
      );
    }
  }

  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "branch_protection",
    metadata_branch: branch,
    ...response.data,
  };
};

const queryCodeScanningAlerts = async (octokit, owner, repo) => {
  let alerts = [];
  const allowedErrors = [403, 404];

  try {
    await octokit
      .paginate(octokit.rest.codeScanning.listAlertsForRepo, {
        owner: owner,
        repo: repo,
        state: "open",
      })
      .then((listedAlerts) => {
        alerts = alerts.concat(listedAlerts);
      });
  } catch (error) {
    if (allowedErrors.includes(error.status) === false) {
      throw new Error(
        `Failed to get code scanning alerts for ${owner}/${repo}: ${error.status}`
      );
    }
  }

  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "code_scanning_alerts",
    code_scanning_alerts: alerts,
  };
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
      state: "open",
    })
    .then((listedAlerts) => {
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

const queryRenovatePRs = async (octokit, owner, repo) => {
  let prs = [];
  await octokit
    .paginate(octokit.rest.search.issuesAndPullRequests, {
      q: `is:pull-request+repo:${owner}/${repo}+label:dependencies`,
    })
    .then((listedPRs) => {
      for (const pr of listedPRs) {
        prs.push({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          closed_at: pr.closed_at,
          html_url: pr.pull_request.html_url,
        });
      }
    });
  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "renovate_prs",
    renovate_prs: prs,
  };
};

module.exports = {
  queryActionDependencies: queryActionDependencies,
  queryBranchProtection: queryBranchProtection,
  queryCodeScanningAlerts: queryCodeScanningAlerts,
  queryCommitCount: queryCommitCount,
  queryDependabotAlerts: queryDependabotAlerts,
  queryRepository: queryRepository,
  queryRequiredFiles: queryRequiredFiles,
  queryRenovatePRs: queryRenovatePRs,
};
