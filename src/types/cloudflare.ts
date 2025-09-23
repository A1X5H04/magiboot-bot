export interface Env {
  BOT_TOKEN: string;
  BOT_INFO: string;
  
  D1_DB: D1Database;
  JOB_QUEUE: KVNamespace;
  // Add other environment variables here as needed

  GITHUB_TOKEN: string;
  GITHUB_REPO_SLUG: string;
}