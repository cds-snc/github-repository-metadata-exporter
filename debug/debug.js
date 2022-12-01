"use strict";

const github = require("@actions/github");

const { queryBranchProtection, queryRepository } = require("../src/lib/query.js");

const run = async () => {
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
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