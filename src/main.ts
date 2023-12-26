import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  try {
    const { GITHUB_SHA, GITHUB_TOKEN } = process.env;
    const tagName = core.getInput('tag_name');
    const ref: string | undefined = core.getInput('ref') || GITHUB_SHA;
    if (!ref) {
      core.setFailed('Missing GITHUB_SHA');
      return;
    }

    if (!GITHUB_TOKEN) {
      core.setFailed('Missing GITHUB_TOKEN');
      return;
    }

    if (!tagName) {
      core.setFailed('Missing tag_name');
      return;
    }

    const octokit = github.getOctokit(GITHUB_TOKEN);

    let commitSha = ref;
    if (commitSha.length !== 40) {
      try {
        const refs = await octokit.rest.git.listMatchingRefs({
          ...github.context.repo,
          ref,
        });
        if (refs.data.length === 0) {
          core.setFailed(`No matching refs found for ${ref}`);
          return;
        }
        commitSha = refs.data[0].object.sha; // Use the first match
      } catch (e) {
        core.setFailed(e.message || e);
      }
    }
    console.log(`😬 Update tag with ref hash ${commitSha}.`);
    let tagRef;
    try {
      tagRef = await octokit.rest.git.getRef({
        ...github.context.repo,
        ref: `tags/${tagName}`,
      });
    } catch (e) {
      if (e.status === 404) {
        // Ignore tag not existing
      } else {
        throw e;
      }
    }
    if (!tagRef) {
      console.log(`😕 Tag ${tagName} does not exist. Creating...`);
      await octokit.rest.git.createRef({
        ...github.context.repo,
        ref: `refs/tags/${tagName}`,
        sha: commitSha,
      });
    } else {
      await octokit.rest.git.updateRef({
        ...github.context.repo,
        ref: `tags/${tagName}`,
        sha: commitSha,
      });
    }
    console.log(`😊 Tag ${tagName} updated.`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
