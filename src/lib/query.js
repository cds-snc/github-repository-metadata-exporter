const queryWorkflows = async (octokit, owner, repo) => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  let workflows = [];
  // List all workflow runs from yesterday
  const runs = await octokit.paginate(
    octokit.rest.actions.listWorkflowRunsForRepo,
    {
      owner,
      repo,
      created: `${yesterday}T00:00:00Z..${yesterday}T23:59:59Z`,
    }
  );
  for (const run of runs) {
    const runDate = run.created_at.slice(0, 10);
    if (runDate === yesterday) {
      workflows.push({
        id: run.id,
        name: run.name,
        workflow_id: run.workflow_id,
        run_number: run.run_number,
        event: run.event,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        updated_at: run.updated_at,
        html_url: run.html_url,
      });
    }
  }
  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "workflows",
    workflows: workflows,
  };
};
const fs = require("fs");
const path = require("path");

const queryActionDependencies = async (owner, repo) => {
  const workflowsRoot = ".github/workflows";

  // Find all files with a `.yml/.yaml` extension in the workflows root
  const workflowFiles = await fs.promises
    .readdir(workflowsRoot, { withFileTypes: true })
    .then((files) =>
      files.filter(
        (file) =>
          file.isFile() &&
          (file.name.endsWith(".yml") || file.name.endsWith(".yaml"))
      )
    )
    .then((files) => files.map((file) => path.join(workflowsRoot, file.name)));

  // Parse the contents of each workflow file and extract the `uses` values
  const usesList = [];
  for (const file of workflowFiles) {
    const workflowContent = await fs.promises.readFile(file, "utf8");
    const lines = workflowContent.split("\n");
    for (const line of lines) {
      if (
        line.trim().startsWith("uses:") ||
        line.trim().startsWith("- uses:")
      ) {
        // Extract the name of the action and the SHA reference, if present
        const actionMatch = line.match(/uses: (.*)/);
        if (actionMatch) {
          const action = actionMatch[1];
          let name = action;
          let ref = null;
          const refMatch = action.match(/@([^#]*)/);
          if (refMatch) {
            name = action.split("@")[0];
            ref = refMatch[1].trim();
          }
          // Extract any comments denoted by a `#`
          let comment = null;
          const commentMatch = line.match(/# (.*)/);
          if (commentMatch) {
            comment = commentMatch[1];
          }
          const fileName = file.split("/").pop();
          usesList.push({ name, ref, comment, file_name: fileName });
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
};

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

const queryCodespaces = async (octokit, owner) => {
  let codespaces = [];
  await octokit
    .paginate(octokit.rest.codespaces.listInOrganization, { org: owner })
    .then((listedCodespaces) => {
      for (const codespace of listedCodespaces) {
        codespaces.push({
          id: codespace.id,
          name: codespace.name,
          environment_id: codespace.environment_id,
          owner: codespace.owner.login,
          billable_owner: codespace.billable_owner.login,
          repository: codespace.repository.full_name,
          machine_name: codespace.machine.name,
          machine_display_name: codespace.machine.display_name,
          machine_os: codespace.machine.operating_system,
          machine_storage_in_bytes: codespace.machine.storage_in_bytes,
          machine_memory_in_bytes: codespace.machine.memory_in_bytes,
          machine_cpus: codespace.machine.cpus,
          prebuild: codespace.prebuild,
          devcontainer_path: codespace.devcontainer_path,
          created_at: codespace.created_at,
          updated_at: codespace.updated_at,
          last_used_at: codespace.last_used_at,
          state: codespace.state,
          location: codespace.location,
          idle_timeout_minutes: codespace.idle_timeout_minutes,
        });
      }
    });
  return {
    metadata_owner: owner,
    metadata_query: "codespaces",
    codespaces: codespaces,
  };
};

const queryCommits = async (octokit, owner, repo, timeInDays = 60) => {
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
          author_email: commit.commit.author.email,
          date: commit.commit.author.date,
          message: commit.commit.message,
          sha: commit.commit.tree.sha,
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
    commit_count: commits.map(
      ({ author, date, verified, verified_reason }) => ({
        author,
        date,
        verified,
        verified_reason,
      })
    ),
    commits: commits,
  };
};

const queryDependabotAlerts = async (octokit, owner, repo) => {
  let alerts = [];

  try {
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
  } catch (error) {
    if (
      error.status === 403 &&
      error.response &&
      error.response.data.message ===
        "Dependabot alerts are disabled for this repository."
    ) {
      // Optionally handle this case specifically, e.g., by setting alerts to a specific value or returning a custom error message
      console.log("❌ Dependabot alerts are disabled for this repository.");
    } else {
      // Handle other errors or a 403 without the specific message
      console.error("An error occurred:", error);
    }
  }

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
      q: `is:pull-request+repo:${owner}/${repo}+label:dependencies+state:open`,
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

const queryAllPRs = async (octokit, owner, repo) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  const targetDate = since.toISOString().slice(0, 10); // Get just the date part (YYYY-MM-DD)
  const prs = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.pulls.list,
    {
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 100,
    }
  )) {
    // keep only PRs updated on the same date
    const sameDate = response.data.filter(
      (pr) => pr.updated_at.slice(0, 10) === targetDate
    );
    prs.push(
      ...sameDate.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        closed_at: pr.closed_at,
        html_url: pr.html_url,
        labels: (pr.labels || []).map((l) => l.name),
      }))
    );

    // Stop early once we hit older PRs (older than target date)
    const lastPR = response.data[response.data.length - 1];
    if (lastPR.updated_at.slice(0, 10) < targetDate) break;
  }

  return {
    metadata_owner: owner,
    metadata_repo: repo,
    metadata_query: "all_prs",
    prs,
  };
};

const queryUsers = async (octokit, owner) => {
  let users = [];
  await octokit
    .paginate(octokit.rest.orgs.listMembers, { org: owner })
    .then((listedUsers) => {
      for (const user of listedUsers) {
        users.push({
          id: user.id,
          login: user.login,
          node_id: user.node_id,
          avatar_url: user.avatar_url,
          gravatar_id: user.gravatar_id,
          type: user.type,
          site_admin: user.site_admin,
        });
      }
    });
  return {
    metadata_owner: owner,
    metadata_query: "users",
    users: users,
  };
};

module.exports = {
  queryActionDependencies: queryActionDependencies,
  queryBranchProtection: queryBranchProtection,
  queryCodeScanningAlerts: queryCodeScanningAlerts,
  queryCodespaces: queryCodespaces,
  queryCommits: queryCommits,
  queryDependabotAlerts: queryDependabotAlerts,
  queryRepository: queryRepository,
  queryRequiredFiles: queryRequiredFiles,
  queryRenovatePRs: queryRenovatePRs,
  queryAllPRs: queryAllPRs,
  queryUsers: queryUsers,
  queryWorkflows: queryWorkflows,
};
