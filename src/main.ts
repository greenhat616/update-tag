import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  try {
    const { GITHUB_SHA, GITHUB_TOKEN } = process.env;
    const tagName = core.getInput('tag_name');
    const ref: string | undefined = core.getInput('ref') || GITHUB_SHA;
    if (!ref) {
      core.setFailed('😨 Missing GITHUB_SHA');
      return;
    }

    if (!GITHUB_TOKEN) {
      core.setFailed('😨 Missing GITHUB_TOKEN');
      return;
    }

    if (!tagName) {
      core.setFailed('😨 Missing tag_name');
      return;
    }

    const octokit = github.getOctokit(GITHUB_TOKEN);

    let commitSha: string;

    try {
      commitSha = await getCommitSha(ref, octokit);
      if (!commitSha) {
        return;
      }
    } catch (e) {
      core.setFailed(e.message);
      return;
    }

    console.log(`👍 Update tag with ref hash ${commitSha}.`);
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

async function getCommitSha(ref: string, octokit: ReturnType<typeof github.getOctokit>): Promise<string> {
  if (ref.length === 40) {
    console.log(`👍 Ref is a commit hash.`);
    return ref;
  }
  console.log(`🤠 Checking ref: ${ref}...`);

  try {
    const defaultRef = await octokit.rest.git.getRef({
      ...github.context.repo,
      ref: ref,
    });
    if (defaultRef.data.object) {
      return defaultRef.data.object.sha;
    }
  } catch (e) {
    if (e.status === 404) {
      console.log(`😕 Ref ${ref} does not exist. Try to query as a branch...`);
    } else {
      throw e;
    }
  }

  try {
    const branchRef = await octokit.rest.git.getRef({
      ...github.context.repo,
      ref: `heads/${ref}`,
    });
    if (branchRef.data.object) {
      return branchRef.data.object.sha;
    }
  } catch (e) {
    if (e.status === 404) {
      console.log(`😕 Branch ${ref} does not exist. Try to query as a tag...`);
    } else {
      throw e;
    }
  }

  try {
    const tagRef = await octokit.rest.git.getRef({
      ...github.context.repo,
      ref: `tags/${ref}`,
    });
    if (tagRef.data.object) {
      return tagRef.data.object.sha;
    }
  } catch (e) {
    if (e.status === 404) {
      core.setFailed(`😨 Ref ${ref} does not exist.`);
    } else {
      throw e;
    }
  }
  return '';
}

run();
