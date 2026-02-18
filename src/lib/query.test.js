"use strict";

const fs = require("fs");
const { when } = require("jest-when");

const {
  queryActionDependencies,
  queryAllPRs,
  queryBranchProtection,
  queryCodeScanningAlerts,
  queryCodespaces,
  queryCommits,
  queryDependabotAlerts,
  queryRepository,
  queryRequiredFiles,
  queryRenovatePRs,
  queryUsers,
  queryWorkflows,
} = require("./query.js");

jest.mock("fs");

describe("queryActionDependencies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns action dependencies for a repository", async () => {
    const mockFiles = [{ name: "test.yml", isFile: () => true }];
    const workflowContent =
      "jobs:\n  test:\n    steps:\n      - uses: actions/checkout@v3";

    fs.promises = {
      readdir: jest.fn().mockResolvedValue(mockFiles),
      readFile: jest.fn().mockResolvedValue(workflowContent),
    };

    const result = await queryActionDependencies("owner", "repo");

    expect(result).toEqual({
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "action_dependencies",
      action_dependencies: expect.any(Array),
    });
  });

  test("parses workflow files with actions and SHAs", async () => {
    const mockFiles = [
      { name: "test.yml", isFile: () => true },
      { name: "build.yaml", isFile: () => true },
    ];

    const workflowContent1 = `
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3 # Checkout code
      - uses: actions/setup-node@8f152de45cc393bb48ce5d89d36b731f54556e65
`;

    const workflowContent2 = `
name: Build
jobs:
  build:
    steps:
      - uses: docker/build-push-action@v2
`;

    fs.promises = {
      readdir: jest.fn().mockResolvedValue(mockFiles),
      readFile: jest
        .fn()
        .mockResolvedValueOnce(workflowContent1)
        .mockResolvedValueOnce(workflowContent2),
    };

    const result = await queryActionDependencies("owner", "repo");

    expect(result.action_dependencies).toHaveLength(3);
    expect(result.action_dependencies).toContainEqual({
      name: "actions/checkout",
      ref: "v3",
      comment: "Checkout code",
      file_name: "test.yml",
    });
    expect(result.action_dependencies).toContainEqual({
      name: "actions/setup-node",
      ref: "8f152de45cc393bb48ce5d89d36b731f54556e65",
      comment: null,
      file_name: "test.yml",
    });
    expect(result.action_dependencies).toContainEqual({
      name: "docker/build-push-action",
      ref: "v2",
      comment: null,
      file_name: "build.yaml",
    });
  });

  test("handles actions without version refs", async () => {
    const mockFiles = [{ name: "test.yml", isFile: () => true }];
    const workflowContent = `
jobs:
  test:
    steps:
      - uses: local-action
`;

    fs.promises = {
      readdir: jest.fn().mockResolvedValue(mockFiles),
      readFile: jest.fn().mockResolvedValue(workflowContent),
    };

    const result = await queryActionDependencies("owner", "repo");

    expect(result.action_dependencies).toContainEqual({
      name: "local-action",
      ref: null,
      comment: null,
      file_name: "test.yml",
    });
  });

  test("filters out non-yml/yaml files", async () => {
    const mockFiles = [
      { name: "test.yml", isFile: () => true },
      { name: "readme.md", isFile: () => true },
      { name: "config.json", isFile: () => true },
      { name: "build.yaml", isFile: () => true },
    ];

    fs.promises = {
      readdir: jest.fn().mockResolvedValue(mockFiles),
      readFile: jest
        .fn()
        .mockResolvedValue(
          "jobs:\n  test:\n    steps:\n      - uses: action@v1"
        ),
    };

    await queryActionDependencies("owner", "repo");

    expect(fs.promises.readFile).toHaveBeenCalledTimes(2);
  });

  test("handles empty workflow directory", async () => {
    fs.promises = {
      readdir: jest.fn().mockResolvedValue([]),
    };

    const result = await queryActionDependencies("owner", "repo");

    expect(result.action_dependencies).toEqual([]);
  });
});

describe("queryAllPRs", () => {
  test("returns all PRs updated in last 24 hours", async () => {
    const now = new Date("2025-11-21T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const mockPRs = [
      {
        id: 1,
        number: 10,
        title: "PR 1",
        state: "open",
        created_at: "2025-11-20T10:00:00Z",
        updated_at: "2025-11-20T12:00:00Z",
        closed_at: null,
        html_url: "https://github.com/owner/repo/pull/10",
        labels: [{ name: "bug" }, { name: "urgent" }],
      },
      {
        id: 2,
        number: 11,
        title: "PR 2",
        state: "closed",
        created_at: "2025-11-19T10:00:00Z",
        updated_at: "2025-11-20T14:00:00Z",
        closed_at: "2025-11-20T14:00:00Z",
        html_url: "https://github.com/owner/repo/pull/11",
        labels: [],
      },
    ];

    const octokit = {
      paginate: {
        iterator: jest.fn().mockImplementation(async function* () {
          yield { data: mockPRs };
        }),
      },
      rest: {
        pulls: {
          list: jest.fn(),
        },
      },
    };

    const result = await queryAllPRs(octokit, "owner", "repo");

    expect(result).toEqual({
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "all_prs",
      prs: [
        {
          id: 1,
          number: 10,
          title: "PR 1",
          state: "open",
          created_at: "2025-11-20T10:00:00Z",
          updated_at: "2025-11-20T12:00:00Z",
          closed_at: null,
          html_url: "https://github.com/owner/repo/pull/10",
          labels: ["bug", "urgent"],
        },
        {
          id: 2,
          number: 11,
          title: "PR 2",
          state: "closed",
          created_at: "2025-11-19T10:00:00Z",
          updated_at: "2025-11-20T14:00:00Z",
          closed_at: "2025-11-20T14:00:00Z",
          html_url: "https://github.com/owner/repo/pull/11",
          labels: [],
        },
      ],
    });
  });

  test("filters out PRs not updated on target date", async () => {
    const now = new Date("2025-11-21T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const mockPRsPage1 = [
      {
        id: 1,
        number: 10,
        title: "Recent PR",
        state: "open",
        created_at: "2025-11-20T10:00:00Z",
        updated_at: "2025-11-20T12:00:00Z",
        closed_at: null,
        html_url: "https://github.com/owner/repo/pull/10",
        labels: [],
      },
    ];

    const mockPRsPage2 = [
      {
        id: 2,
        number: 9,
        title: "Old PR",
        state: "open",
        created_at: "2025-11-19T10:00:00Z",
        updated_at: "2025-11-19T12:00:00Z",
        closed_at: null,
        html_url: "https://github.com/owner/repo/pull/9",
        labels: [],
      },
    ];

    const octokit = {
      paginate: {
        iterator: jest.fn().mockImplementation(async function* () {
          yield { data: mockPRsPage1 };
          yield { data: mockPRsPage2 };
        }),
      },
      rest: {
        pulls: {
          list: jest.fn(),
        },
      },
    };

    const result = await queryAllPRs(octokit, "owner", "repo");

    expect(result.prs).toHaveLength(1);
    expect(result.prs[0].number).toBe(10);
  });

  test("stops early when PRs are older than target date", async () => {
    const now = new Date("2025-11-21T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const mockPRsPage1 = [
      {
        id: 1,
        number: 10,
        title: "PR 1",
        state: "open",
        created_at: "2025-11-20T10:00:00Z",
        updated_at: "2025-11-20T12:00:00Z",
        closed_at: null,
        html_url: "https://github.com/owner/repo/pull/10",
        labels: [],
      },
      {
        id: 2,
        number: 9,
        title: "Old PR",
        state: "open",
        created_at: "2025-11-18T10:00:00Z",
        updated_at: "2025-11-18T12:00:00Z",
        closed_at: null,
        html_url: "https://github.com/owner/repo/pull/9",
        labels: [],
      },
    ];

    let pageCount = 0;
    const octokit = {
      paginate: {
        iterator: jest.fn().mockImplementation(async function* () {
          pageCount++;
          yield { data: mockPRsPage1 };
        }),
      },
      rest: {
        pulls: {
          list: jest.fn(),
        },
      },
    };

    await queryAllPRs(octokit, "owner", "repo");

    expect(pageCount).toBe(1);
  });

  test("handles PRs with missing labels", async () => {
    const now = new Date("2025-11-21T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const mockPRs = [
      {
        id: 1,
        number: 10,
        title: "PR without labels",
        state: "open",
        created_at: "2025-11-20T10:00:00Z",
        updated_at: "2025-11-20T12:00:00Z",
        closed_at: null,
        html_url: "https://github.com/owner/repo/pull/10",
        labels: null,
      },
    ];

    const octokit = {
      paginate: {
        iterator: jest.fn().mockImplementation(async function* () {
          yield { data: mockPRs };
        }),
      },
      rest: {
        pulls: {
          list: jest.fn(),
        },
      },
    };

    const result = await queryAllPRs(octokit, "owner", "repo");

    expect(result.prs[0].labels).toEqual([]);
  });
});

describe("queryWorkflows", () => {
  test("returns workflows from yesterday", async () => {
    const now = new Date("2025-11-21T12:00:00Z");
    const yesterday = "2025-11-20";
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const mockWorkflows = [
      {
        id: 1,
        name: "Test Workflow",
        workflow_id: 123,
        run_number: 45,
        event: "push",
        status: "completed",
        conclusion: "success",
        created_at: "2025-11-20T10:30:00Z",
        updated_at: "2025-11-20T10:35:00Z",
        html_url: "https://github.com/owner/repo/actions/runs/1",
      },
      {
        id: 2,
        name: "Build",
        workflow_id: 124,
        run_number: 12,
        event: "pull_request",
        status: "completed",
        conclusion: "failure",
        created_at: "2025-11-20T14:00:00Z",
        updated_at: "2025-11-20T14:05:00Z",
        html_url: "https://github.com/owner/repo/actions/runs/2",
      },
    ];

    const octokit = {
      paginate: jest.fn().mockResolvedValue(mockWorkflows),
      rest: {
        actions: {
          listWorkflowRunsForRepo: jest.fn(),
        },
      },
    };

    const result = await queryWorkflows(octokit, "owner", "repo");

    expect(octokit.paginate).toHaveBeenCalledWith(
      octokit.rest.actions.listWorkflowRunsForRepo,
      {
        owner: "owner",
        repo: "repo",
        created: `${yesterday}T00:00:00Z..${yesterday}T23:59:59Z`,
      }
    );

    expect(result).toEqual({
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "workflows",
      workflows: mockWorkflows,
    });
  });

  test("filters out workflows not created on yesterday", async () => {
    const now = new Date("2025-11-21T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const mockWorkflows = [
      {
        id: 1,
        name: "Yesterday Workflow",
        workflow_id: 123,
        run_number: 45,
        event: "push",
        status: "completed",
        conclusion: "success",
        created_at: "2025-11-20T10:30:00Z",
        updated_at: "2025-11-20T10:35:00Z",
        html_url: "https://github.com/owner/repo/actions/runs/1",
      },
      {
        id: 2,
        name: "Today Workflow",
        workflow_id: 124,
        run_number: 12,
        event: "push",
        status: "in_progress",
        conclusion: null,
        created_at: "2025-11-21T08:00:00Z",
        updated_at: "2025-11-21T08:05:00Z",
        html_url: "https://github.com/owner/repo/actions/runs/2",
      },
    ];

    const octokit = {
      paginate: jest.fn().mockResolvedValue(mockWorkflows),
      rest: {
        actions: {
          listWorkflowRunsForRepo: jest.fn(),
        },
      },
    };

    const result = await queryWorkflows(octokit, "owner", "repo");

    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0].id).toBe(1);
  });

  test("returns empty array when no workflows from yesterday", async () => {
    const now = new Date("2025-11-21T12:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const octokit = {
      paginate: jest.fn().mockResolvedValue([]),
      rest: {
        actions: {
          listWorkflowRunsForRepo: jest.fn(),
        },
      },
    };

    const result = await queryWorkflows(octokit, "owner", "repo");

    expect(result.workflows).toEqual([]);
  });
});

describe("queryBranchProtection", () => {
  test("returns branch protection data if the request succeeds", async () => {
    const octokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
        },
      },
    };

    const response = {
      status: 200,
      data: {
        id: "123",
      },
    };

    const owner = "owner";
    const repo = "repo";
    const branch = "main";

    when(octokit.rest.repos.getBranchProtection)
      .calledWith({ branch: branch, owner: owner, repo: repo })
      .mockReturnValue(response);

    const result = await queryBranchProtection(octokit, owner, repo, branch);
    expect(result).toEqual({
      id: "123",
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "branch_protection",
      metadata_branch: "main",
    });
  });

  test("returns branch protection data false if 404", async () => {
    const octokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
        },
      },
    };

    const response = {
      status: 404,
    };

    const owner = "owner";
    const repo = "repo";
    const branch = "main";

    when(octokit.rest.repos.getBranchProtection)
      .calledWith({ branch: branch, owner: owner, repo: repo })
      .mockRejectedValue(response);

    const result = await queryBranchProtection(octokit, owner, repo, branch);
    expect(result).toEqual({
      metadata_branch: "main",
      enabled: false,
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "branch_protection",
    });
  });

  test("throws an error if the request fails", async () => {
    const octokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
        },
      },
    };

    const response = {
      status: 400,
    };

    const owner = "owner";
    const repo = "repo";
    const branch = "main";

    when(octokit.rest.repos.getBranchProtection)
      .calledWith({ branch: branch, owner: owner, repo: repo })
      .mockRejectedValue(response);

    await expect(
      queryBranchProtection(octokit, owner, repo, branch)
    ).rejects.toThrow(
      `Failed to get branch protection for ${branch} on ${owner}/${repo}: ${response.status}`
    );
  });

  test("uses custom branch name", async () => {
    const octokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
        },
      },
    };

    const response = {
      status: 200,
      data: { id: "123" },
    };

    const customBranch = "develop";

    when(octokit.rest.repos.getBranchProtection)
      .calledWith({ branch: customBranch, owner: "owner", repo: "repo" })
      .mockReturnValue(response);

    const result = await queryBranchProtection(
      octokit,
      "owner",
      "repo",
      customBranch
    );

    expect(result.metadata_branch).toBe(customBranch);
  });
});

describe("queryCodespaces", () => {
  test("returns org codespaces data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          id: 123,
          name: "name",
          environment_id: "environment_id",
          owner: { login: "owner" },
          billable_owner: { login: "billable_owner" },
          repository: { full_name: "full_name" },
          machine: {
            name: "machine_name",
            display_name: "display_name",
            operating_system: "os",
            storage_in_bytes: 123,
            memory_in_bytes: 123,
            cpus: 123,
          },
          prebuild: "prebuild",
          devcontainer_path: "devcontainer_path",
          created_at: "created_at",
          updated_at: "updated_at",
          last_used_at: "last_used_at",
          state: "state",
          location: "location",
          idle_timeout_minutes: 123,
        },
        {
          id: 456,
          name: "name",
          environment_id: "environment_id",
          owner: { login: "owner" },
          billable_owner: { login: "billable_owner" },
          repository: { full_name: "full_name" },
          machine: {
            name: "machine_name",
            display_name: "display_name",
            operating_system: "os",
            storage_in_bytes: 123,
            memory_in_bytes: 123,
            cpus: 123,
          },
          prebuild: "prebuild",
          devcontainer_path: "devcontainer_path",
          created_at: "created_at",
          updated_at: "updated_at",
          last_used_at: "last_used_at",
          state: "state",
          location: "location",
          idle_timeout_minutes: 123,
        },
      ],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        codespaces: {
          listInOrganization: jest.fn(),
        },
      },
    };

    const owner = "owner";

    when(octokit.rest.codespaces.listInOrganization)
      .calledWith({ orgs: owner })
      .mockReturnValue(response);

    const result = await queryCodespaces(octokit, owner);

    expect(result).toEqual({
      codespaces: [
        {
          id: 123,
          name: "name",
          environment_id: "environment_id",
          owner: "owner",
          billable_owner: "billable_owner",
          repository: "full_name",
          machine_name: "machine_name",
          machine_display_name: "display_name",
          machine_os: "os",
          machine_storage_in_bytes: 123,
          machine_memory_in_bytes: 123,
          machine_cpus: 123,
          prebuild: "prebuild",
          devcontainer_path: "devcontainer_path",
          created_at: "created_at",
          updated_at: "updated_at",
          last_used_at: "last_used_at",
          state: "state",
          location: "location",
          idle_timeout_minutes: 123,
        },
        {
          id: 456,
          name: "name",
          environment_id: "environment_id",
          owner: "owner",
          billable_owner: "billable_owner",
          repository: "full_name",
          machine_name: "machine_name",
          machine_display_name: "display_name",
          machine_os: "os",
          machine_storage_in_bytes: 123,
          machine_memory_in_bytes: 123,
          machine_cpus: 123,
          prebuild: "prebuild",
          devcontainer_path: "devcontainer_path",
          created_at: "created_at",
          updated_at: "updated_at",
          last_used_at: "last_used_at",
          state: "state",
          location: "location",
          idle_timeout_minutes: 123,
        },
      ],
      metadata_owner: "owner",
      metadata_query: "codespaces",
    });
  });

  test("handles empty codespaces list", async () => {
    const octokit = {
      paginate: () => new Promise((resolve) => resolve([])),
      rest: {
        codespaces: {
          listInOrganization: jest.fn(),
        },
      },
    };

    const result = await queryCodespaces(octokit, "owner");

    expect(result.codespaces).toEqual([]);
  });

  test("handles error in pagination", async () => {
    const octokit = {
      paginate: () =>
        new Promise((_, reject) => reject(new Error("API error"))),
      rest: {
        codespaces: {
          listInOrganization: jest.fn(),
        },
      },
    };

    await expect(queryCodespaces(octokit, "owner")).rejects.toThrow(
      "API error"
    );
  });
});

describe("queryCommits", () => {
  test("returns commit count data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          author: {
            login: "author",
          },
          commit: {
            author: {
              email: "author@example.com",
              date: "date",
            },
            message: "commit message",
            tree: {
              sha: "abc123",
            },
            verification: {
              verified: true,
              reason: "reason",
            },
          },
        },
        {
          author: {
            login: "author",
          },
          commit: {
            author: {
              email: "author@example.com",
              date: "date",
            },
            message: "another commit",
            tree: {
              sha: "def456",
            },
            verification: {
              verified: false,
              reason: "bad_signature",
            },
          },
        },
      ],
    };
    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        repos: {
          listCommits: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    when(octokit.rest.repos.listCommits)
      .calledWith({ owner: owner, repo: repo, since: expect.anything() })
      .mockReturnValue(response);

    const result = await queryCommits(octokit, owner, repo);
    expect(result).toEqual({
      commit_count: [
        {
          author: "author",
          date: "date",
          verified: true,
          verified_reason: "reason",
        },
        {
          author: "author",
          date: "date",
          verified: false,
          verified_reason: "bad_signature",
        },
      ],
      commits: [
        {
          author: "author",
          author_email: "author@example.com",
          date: "date",
          message: "commit message",
          sha: "abc123",
          verified: true,
          verified_reason: "reason",
        },
        {
          author: "author",
          author_email: "author@example.com",
          date: "date",
          message: "another commit",
          sha: "def456",
          verified: false,
          verified_reason: "bad_signature",
        },
      ],
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "commit_count",
      metadata_time_in_days: 60,
      metadata_since: expect.any(String),
    });
  });

  test("uses custom timeInDays parameter", async () => {
    const response = {
      status: 200,
      data: [
        {
          author: { login: "author1" },
          commit: {
            author: {
              email: "author1@example.com",
              date: "2025-11-15T10:00:00Z",
            },
            message: "test commit",
            tree: { sha: "abc123" },
            verification: { verified: true, reason: "valid" },
          },
        },
      ],
    };

    const octokit = {
      paginate: () => new Promise((resolve) => resolve(response.data)),
      rest: {
        repos: {
          listCommits: jest.fn(),
        },
      },
    };

    const customTimeInDays = 30;

    const result = await queryCommits(
      octokit,
      "owner",
      "repo",
      customTimeInDays
    );

    expect(result.metadata_time_in_days).toBe(customTimeInDays);
  });

  test("handles commits without author login", async () => {
    const response = {
      status: 200,
      data: [
        {
          author: null,
          commit: {
            author: {
              name: "Git User Name",
              email: "test@example.com",
              date: "2025-11-15T10:00:00Z",
            },
            message: "test commit",
            tree: { sha: "abc123" },
            verification: { verified: false, reason: "unsigned" },
          },
        },
      ],
    };

    const octokit = {
      paginate: () => new Promise((resolve) => resolve(response.data)),
      rest: {
        repos: {
          listCommits: jest.fn(),
        },
      },
    };

    const result = await queryCommits(octokit, "owner", "repo");

    expect(result.commits[0].author).toBe("Git User Name");
    expect(result.commits[0].author_email).toBe("test@example.com");
  });

  test("handles empty commits array", async () => {
    const octokit = {
      paginate: () => new Promise((resolve) => resolve([])),
      rest: {
        repos: {
          listCommits: jest.fn(),
        },
      },
    };

    const result = await queryCommits(octokit, "owner", "repo");

    expect(result.commit_count).toEqual([]);
    expect(result.commits).toEqual([]);
  });
});

describe("queryRenovatePRs", () => {
  test("returns renovate prs if the requests succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          id: 1474610853,
          number: 1,
          title:
            "chore(deps): update js-devtools/npm-publish digest to e42e372 - autoclosed",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: "2022-12-07T17:08:01Z",
          pull_request: {
            html_url: "https://www.github.com/owner/repo/pull/1",
          },
        },
        {
          id: 1474610854,
          number: 2,
          title: "chore(deps): update all minor dependencies",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: null,
          pull_request: {
            html_url: "https://www.github.com/owner/repo/pull/2",
          },
        },
      ],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    const result = await queryRenovatePRs(octokit, owner, repo);
    expect(result).toEqual({
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "renovate_prs",
      renovate_prs: [
        {
          id: 1474610853,
          number: 1,
          title:
            "chore(deps): update js-devtools/npm-publish digest to e42e372 - autoclosed",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: "2022-12-07T17:08:01Z",
          html_url: "https://www.github.com/owner/repo/pull/1",
        },
        {
          id: 1474610854,
          number: 2,
          title: "chore(deps): update all minor dependencies",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: null,
          html_url: "https://www.github.com/owner/repo/pull/2",
        },
      ],
    });
  });

  test("handles empty PRs list", async () => {
    const octokit = {
      paginate: () => new Promise((resolve) => resolve([])),
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(),
        },
      },
    };

    const result = await queryRenovatePRs(octokit, "owner", "repo");

    expect(result.renovate_prs).toEqual([]);
  });

  test("handles PRs with missing fields", async () => {
    const response = {
      status: 200,
      data: [
        {
          id: 1,
          number: 1,
          title: "Complete PR",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: "2022-12-07T17:08:01Z",
          pull_request: {
            html_url: "https://www.github.com/owner/repo/pull/1",
          },
        },
        {
          id: 2,
          number: 2,
          title: "PR with null closed_at",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: null,
          pull_request: {
            html_url: "https://www.github.com/owner/repo/pull/2",
          },
        },
      ],
    };

    const octokit = {
      paginate: () => new Promise((resolve) => resolve(response.data)),
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(),
        },
      },
    };

    const result = await queryRenovatePRs(octokit, "owner", "repo");

    expect(result.renovate_prs).toHaveLength(2);
    expect(result.renovate_prs[1].closed_at).toBeNull();
  });
});

describe("queryCodeScanningAlerts", () => {
  test("returns code scanning alerts data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [{ number: 1 }, { number: 2 }],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        codeScanning: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    const result = await queryCodeScanningAlerts(octokit, owner, repo);
    expect(result).toEqual({
      code_scanning_alerts: [{ number: 1 }, { number: 2 }],
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "code_scanning_alerts",
    });
  });

  test("returns no code scanning alerts if 404", async () => {
    const octokit = {
      paginate: () =>
        new Promise((_, rejects) => {
          rejects({
            status: 404,
          });
        }),
      rest: {
        codeScanning: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    const result = await queryCodeScanningAlerts(octokit, owner, repo);
    expect(result).toEqual({
      metadata_owner: "owner",
      metadata_repo: "repo",
      code_scanning_alerts: [],
      metadata_query: "code_scanning_alerts",
    });
  });

  test("throws an error if the request fails", async () => {
    const octokit = {
      paginate: () =>
        new Promise((_, rejects) => {
          rejects({
            status: 400,
          });
        }),
      rest: {
        codeScanning: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    await expect(queryCodeScanningAlerts(octokit, owner, repo)).rejects.toThrow(
      `Failed to get code scanning alerts for ${owner}/${repo}: 400`
    );
  });

  test("returns no code scanning alerts if 403 forbidden", async () => {
    const octokit = {
      paginate: () =>
        new Promise((_, rejects) => {
          rejects({
            status: 403,
          });
        }),
      rest: {
        codeScanning: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    const result = await queryCodeScanningAlerts(octokit, owner, repo);
    expect(result).toEqual({
      metadata_owner: "owner",
      metadata_repo: "repo",
      code_scanning_alerts: [],
      metadata_query: "code_scanning_alerts",
    });
  });

  test("returns empty array when no alerts", async () => {
    const octokit = {
      paginate: () => new Promise((resolve) => resolve([])),
      rest: {
        codeScanning: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const result = await queryCodeScanningAlerts(octokit, "owner", "repo");

    expect(result.code_scanning_alerts).toEqual([]);
  });
});

describe("queryDependabotAlerts", () => {
  test("returns dependabot alerts data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          number: 1,
          dependency: {
            name: "dependency",
          },
          security_advisory: {
            ghsa_id: "ghsa_id",
            cve_id: "cve_id",
            severity: "severity",
            cvss: "cvss",
            cwes: "cwes",
          },
          created_at: "created_at",
        },
        {
          number: 2,
          dependency: {
            name: "dependency",
          },
          security_advisory: {
            ghsa_id: "ghsa_id",
            cve_id: "cve_id",
            severity: "severity",
            cvss: "cvss",
            cwes: "cwes",
          },
          created_at: "created_at",
        },
      ],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        dependabot: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    const result = await queryDependabotAlerts(octokit, owner, repo);
    expect(result).toEqual({
      dependabot_alerts: [
        {
          id: 1,
          dependency: {
            name: "dependency",
          },
          ghsa_id: "ghsa_id",
          cve_id: "cve_id",
          severity: "severity",
          cvss: "cvss",
          cwes: "cwes",
          created_at: "created_at",
        },
        {
          id: 2,
          dependency: {
            name: "dependency",
          },
          ghsa_id: "ghsa_id",
          cve_id: "cve_id",
          severity: "severity",
          cvss: "cvss",
          cwes: "cwes",
          created_at: "created_at",
        },
      ],
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "dependabot_alerts",
    });
  });

  test("handles 403 error when Dependabot is disabled", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    const octokit = {
      paginate: () =>
        new Promise((_, reject) => {
          const error = new Error("Forbidden");
          error.status = 403;
          error.response = {
            data: {
              message: "Dependabot alerts are disabled for this repository.",
            },
          };
          reject(error);
        }),
      rest: {
        dependabot: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const result = await queryDependabotAlerts(octokit, "owner", "repo");

    expect(result.dependabot_alerts).toEqual([]);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "❌ Dependabot alerts are disabled for this repository."
    );

    consoleLogSpy.mockRestore();
  });

  test("filters out alerts without number field", async () => {
    const response = {
      status: 200,
      data: [
        {
          number: 1,
          dependency: { name: "dep1" },
          security_advisory: {
            ghsa_id: "ghsa1",
            cve_id: "cve1",
            severity: "high",
            cvss: "7.5",
            cwes: "CWE-123",
          },
          created_at: "2025-01-01",
        },
        {
          // Missing number field
          dependency: { name: "dep2" },
          security_advisory: {
            ghsa_id: "ghsa2",
            cve_id: "cve2",
            severity: "low",
            cvss: "3.0",
            cwes: "CWE-456",
          },
          created_at: "2025-01-02",
        },
        {
          number: 3,
          dependency: { name: "dep3" },
          security_advisory: {
            ghsa_id: "ghsa3",
            cve_id: "cve3",
            severity: "medium",
            cvss: "5.0",
            cwes: "CWE-789",
          },
          created_at: "2025-01-03",
        },
      ],
    };

    const octokit = {
      paginate: () => new Promise((resolve) => resolve(response.data)),
      rest: {
        dependabot: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const result = await queryDependabotAlerts(octokit, "owner", "repo");

    expect(result.dependabot_alerts).toHaveLength(2);
    expect(result.dependabot_alerts.map((a) => a.id)).toEqual([1, 3]);
  });
});

describe("queryRepository", () => {
  test("returns repository data if the request succeeds", async () => {
    const octokit = {
      rest: {
        repos: {
          get: jest.fn(),
        },
      },
    };

    const response = {
      status: 200,
      data: {
        id: "123",
      },
    };

    const owner = "owner";
    const repo = "repo";

    when(octokit.rest.repos.get)
      .calledWith({ owner: owner, repo: repo })
      .mockReturnValue(response);

    const result = await queryRepository(octokit, owner, repo);
    expect(result).toEqual({
      id: "123",
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "repository",
    });
  });

  test("throws an error if the request fails", async () => {
    const octokit = {
      rest: {
        repos: {
          get: jest.fn(),
        },
      },
    };

    const response = {
      status: 400,
    };

    const owner = "owner";
    const repo = "repo";

    when(octokit.rest.repos.get)
      .calledWith({ owner: owner, repo: repo })
      .mockReturnValue(response);

    await expect(queryRepository(octokit, owner, repo)).rejects.toThrow(
      `Error querying repository ${owner}/${repo}: ${response.status}`
    );
  });
});

describe("queryRequiredFiles", () => {
  beforeEach(() => {
    // Mock fs.existsSync to return predictable results
    fs.existsSync = jest.fn((file) => {
      return file === "LICENSE" || file === "README.md";
    });
  });

  test("returns repository data if the app has access", async () => {
    const owner = "owner";
    const repo = "repo";

    const result = await queryRequiredFiles(owner, repo);
    expect(result).toEqual({
      "CODE_OF_CONDUCT.md": false,
      "CONTRIBUTING.md": false,
      LICENSE: true,
      "README.md": true,
      "SECURITY.md": false,
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "required_files",
    });
  });
});

describe("queryUsers", () => {
  test("returns org user data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          id: "123",
          login: "login",
          node_id: "node_id",
          avatar_url: "avatar_url",
          gravatar_id: "gravatar_id",
          type: "type",
          site_admin: "site_admin",
        },
        {
          id: "456",
          login: "login",
          node_id: "node_id",
          avatar_url: "avatar_url",
          gravatar_id: "gravatar_id",
          type: "type",
          site_admin: "site_admin",
        },
      ],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        orgs: {
          listMembers: jest.fn(),
        },
      },
    };

    const owner = "owner";

    when(octokit.rest.orgs.listMembers)
      .calledWith({ orgs: owner })
      .mockReturnValue(response);

    const result = await queryUsers(octokit, owner);

    expect(result).toEqual({
      users: response.data,
      metadata_owner: "owner",
      metadata_query: "users",
    });
  });

  test("handles empty users list", async () => {
    const octokit = {
      paginate: () => new Promise((resolve) => resolve([])),
      rest: {
        orgs: {
          listMembers: jest.fn(),
        },
      },
    };

    const result = await queryUsers(octokit, "owner");

    expect(result.users).toEqual([]);
  });

  test("handles error in pagination", async () => {
    const octokit = {
      paginate: () =>
        new Promise((_, reject) => reject(new Error("Org API error"))),
      rest: {
        orgs: {
          listMembers: jest.fn(),
        },
      },
    };

    await expect(queryUsers(octokit, "owner")).rejects.toThrow("Org API error");
  });
});
