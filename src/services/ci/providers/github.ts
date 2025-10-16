// ci/github.ts
import type { CIProvider } from "~/types/ci.ts";

interface GithubProviderConfig {
  owner: string;
  repo: string;
  ref: string;
  token: string | undefined;
  workflowId: string;
}

export const makeGitHubProvider = (config: GithubProviderConfig): CIProvider => {
  const { owner, repo, ref, token, workflowId } = config;
  const baseAPIUrl = `https://api.github.com/repos/${owner}/${repo}/actions`

  if (!token) {
    throw new Error("[CI-Github]: Token not found!");
  }


  const isAvailable: CIProvider["isAvailable"] = async () => {
    const url = `${baseAPIUrl}/runs?status=in_progress&per_page=1`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "User-Agent": "Magiboot-TG-Bot"
      }
    });

    if (!res.ok) {
      const resData = await res.text();
      console.log(resData);
      throw new Error(`GitHub API error: ${res.status}`);
    }
    const data: { total_count: number } = await res.json();
    return data.total_count === 0;
  };



  const triggerWorkflow: CIProvider["triggerWorkflow"] = async (inputs) => {
    console.log('Triggering workflow.');

    const url = `${baseAPIUrl}/workflows/${workflowId}/dispatches`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Magiboot-TG-Bot"
        },
        body: JSON.stringify({ ref, inputs })
      });

      if (!res.ok) {
        const resData = await res.text();
        console.log(resData);
        throw new Error(`Status ${res.status}: ${resData}`);
      }

      // GitHub's dispatch API returns 204 No Content on success
      // and does not provide a run_id immediately.
      return {
        success: true,
        runId: null,
        message: "Workflow dispatched successfully."
      };
    } catch (error: any) {
      console.error(`Failed to dispatch GitHub workflow:`, error.message);
      return {
        success: false,
        message: error.message
      };
    }
  };

  return { id: "github", isAvailable, triggerWorkflow };
};
