"use strict";

const github = require("@actions/github");
const { createAppAuth } = require("@octokit/auth-app");

const { queryBranchProtection, queryRepository } = require("../src/lib/query.js");

const run = async () => {

    const githubAppId = process.env.GITHUB_APP_ID;
    const githubAppInstallationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const githubAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    const auth = createAppAuth({
        appId: githubAppId,
        privateKey: githubAppPrivateKey,
    });

    const installationAuthentication = await auth({
        type: "installation",
        installationId: githubAppInstallationId,
    });

    const octokit = github.getOctokit(installationAuthentication.token);

    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    // Get repository data
    const repository = await queryRepository(octokit, owner, repo);
    console.log("Repository data");
    console.log("===============");
    console.log(repository);

    // Get branch protection data for main branch
    const branchProtectionData = await queryBranchProtection(octokit, owner, repo, "main");
    console.log("Branch protection data");
    console.log("======================");
    console.log(branchProtectionData);

};

run();