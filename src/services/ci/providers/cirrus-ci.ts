import type { CIProvider } from "../../../types/ci.ts";

interface CirrusProviderConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string | undefined;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface RepositoryData {
  ownerRepository: {
    id: string;
    builds: {
      edges: Array<{
        node: {
          id: string;
          status: string;
        };
      }>;
    };
  } | null;
}

interface CreateBuildData {
  createBuild: {
    build: {
      id: string;
    };
  };
}

export const makeCirrusProvider = (config: CirrusProviderConfig): CIProvider => {
  const { owner, repo, branch, token } = config;
  const graphqlEndpoint = "https://api.cirrus-ci.com/graphql";

  // Free tier limits: typically 2 concurrent Linux tasks.
  const MAX_CONCURRENT_TASKS = 2;

  if (!token) {
    throw new Error("[CI-Cirrus]: Token not found!");
  }

  /**
   * Execute a GraphQL query against Cirrus CI API
   */
  const executeGraphQL = async <T>(
    query: string,
    variables?: Record<string, any>
  ): Promise<GraphQLResponse<T>> => {
    try {
      const response = await fetch(graphqlEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error("[CI-Cirrus] GraphQL request failed:", error.message);
      throw error;
    }
  };

  /**
   * Get repository ID (needed for triggering builds)
   */
  const getRepositoryId = async (): Promise<string> => {
    const query = `
      query GetRepositoryId($owner: String!, $name: String!) {
        ownerRepository(platform: "github", owner: $owner, name: $name) {
          id
        }
      }
    `;

    try {
      const result = await executeGraphQL<{
        ownerRepository: { id: string } | null;
      }>(query, { owner, name: repo });

      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(", ")}`);
      }

      if (!result.data?.ownerRepository) {
        throw new Error(`Repository ${owner}/${repo} not found on Cirrus CI`);
      }

      return result.data.ownerRepository.id;
    } catch (error: any) {
      console.error("[CI-Cirrus] Failed to get repository ID:", error.message);
      throw error;
    }
  };

  /**
   * Count active (running or pending) builds for the repository
   */
  const getActiveBuildCount = async (): Promise<number> => {
    const query = `
      query GetActiveBuilds($owner: String!, $name: String!) {
        ownerRepository(platform: "github", owner: $owner, name: $name) {
          id
          builds(last: 50) {
            edges {
              node {
                id
                status
              }
            }
          }
        }
      }
    `;

    try {
      const result = await executeGraphQL<RepositoryData>(query, {
        owner,
        name: repo,
      });

      if (result.errors && result.errors.length > 0) {
        console.warn(
          "[CI-Cirrus] GraphQL errors while checking builds:",
          result.errors.map(e => e.message).join(", ")
        );
        // Return conservative estimate on error
        return MAX_CONCURRENT_TASKS;
      }

      if (!result.data?.ownerRepository) {
        console.warn("[CI-Cirrus] Repository not found, assuming unavailable");
        return MAX_CONCURRENT_TASKS;
      }

      const builds = result.data.ownerRepository.builds.edges;

      // Count builds that are CREATED, EXECUTING, or TRIGGERED
      const activeStatuses = ["CREATED", "EXECUTING", "TRIGGERED"];
      const activeCount = builds.filter(({ node }) =>
        activeStatuses.includes(node.status)
      ).length;

      return activeCount;
    } catch (error: any) {
      console.error(
        "[CI-Cirrus] Failed to check active builds:",
        error.message
      );
      // Return conservative estimate on error
      return MAX_CONCURRENT_TASKS;
    }
  };

  const isAvailable: CIProvider["isAvailable"] = async () => {
    try {
      const activeBuilds = await getActiveBuildCount();
      const available = activeBuilds < MAX_CONCURRENT_TASKS;

      if (!available) {
        console.log(
          `[CI-Cirrus] Not available: ${activeBuilds} active builds (limit: ${MAX_CONCURRENT_TASKS})`
        );
      }

      return available;
    } catch (error: any) {
      console.error(
        "[CI-Cirrus] Error checking availability:",
        error.message
      );
      // Conservative approach: return false on error to avoid overloading
      return false;
    }
  };

  const triggerWorkflow: CIProvider["triggerWorkflow"] = async (inputs) => {
    console.log("[CI-Cirrus] Triggering workflow...");

    try {
      // First, get the repository ID
      const repositoryId = await getRepositoryId();

      // Prepare environment variables from inputs
      // Cirrus CI expects environment variables to be passed as a JSON object
      const envVariables: Record<string, string> = {
        TRIGGER_TASK: "process_video",
        VIDEO_FILE_ID: inputs.video || "",
        METADATA_JSON: inputs.other_metadata || "{}",
      };

      // Extract jobId if present in metadata
      try {
        const metadata = JSON.parse(inputs.other_metadata || "{}");
        if (metadata.jobId) {
          envVariables.JOB_ID = metadata.jobId;
        }
      } catch (parseError) {
        console.warn("[CI-Cirrus] Could not parse metadata for jobId");
      }

      // Mutation to trigger a new build
      const mutation = `
        mutation CreateBuild($input: RepositoryCreateBuildInput!) {
          createBuild(input: $input) {
            build {
              id
              branch
              status
            }
          }
        }
      `;

      // Format environment variables as YAML for configOverride
      const escapedMetadata = envVariables.METADATA_JSON
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "'\\''");

      const scriptOverride = `#!/bin/bash
# Inject environment variables into CIRRUS_ENV
echo "TRIGGER_TASK=${envVariables.TRIGGER_TASK}" >> "$CIRRUS_ENV"
echo "VIDEO_FILE_ID=${envVariables.VIDEO_FILE_ID}" >> "$CIRRUS_ENV"
echo "METADATA_JSON='${escapedMetadata}'" >> "$CIRRUS_ENV"
echo "JOB_ID=${envVariables.JOB_ID || ''}" >> "$CIRRUS_ENV"
`;

      const variables = {
        input: {
          repositoryId: repositoryId,
          branch: branch,
          clientMutationId: `magiboot-${Date.now()}`,
          scriptOverride,
        },
      };

      const result = await executeGraphQL<CreateBuildData>(mutation, variables);

      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => e.message).join(", ");
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      if (!result.data?.createBuild?.build) {
        throw new Error("Build trigger returned no build data");
      }

      const buildId = result.data.createBuild.build.id;

      console.log(`[CI-Cirrus] Build triggered successfully: ${buildId}`);

      return {
        success: true,
        runId: buildId,
        message: `Cirrus CI build triggered successfully (ID: ${buildId})`,
      };
    } catch (error: any) {
      console.error("[CI-Cirrus] Failed to trigger workflow:", error.message);

      return {
        success: false,
        message: `Failed to trigger Cirrus CI build: ${error.message}`,
      };
    }
  };

  return {
    id: "cirrus",
    isAvailable,
    triggerWorkflow,
  };
};