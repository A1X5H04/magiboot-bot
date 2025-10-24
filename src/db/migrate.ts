// migrate.ts
import { join } from "https://deno.land/std/path/mod.ts";

import { createTursoClient, TursoClient } from "../lib/turso.ts"

// --- Configuration ---

const MIGRATIONS_DIR = "./src/db/migrations";
const MIGRATIONS_TABLE = "_migrations";


// --- Core Functions ---

async function ensureMigrationsDir() {
  await Deno.mkdir(MIGRATIONS_DIR, { recursive: true });
}

async function ensureMigrationsTable(client: TursoClient) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(client: TursoClient): Promise<Set<string>> {
    
  const result = await client.execute(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`);
  return new Set(result.rows.map((row) => row.name as string));
}

async function getAvailableMigrations(): Promise<string[]> {
  await ensureMigrationsDir();
  const availableFiles: string[] = [];
  for await (const entry of Deno.readDir(MIGRATIONS_DIR)) {
    if (entry.isFile && entry.name.endsWith(".sql")) {
      availableFiles.push(entry.name);
    }
  }
  return availableFiles.sort((a, b) => a.localeCompare(b));
}

function parseMigrationFile(content: string): { up: string; down: string } {
  const upMatch = content.match(/-- Up\s+([\s\S]*?)(\s+-- Down|$)/);
  const downMatch = content.match(/-- Down\s+([\s\S]*)/);

  if (!upMatch || upMatch[1].trim() === "") {
    throw new Error("Could not find '-- Up' section or it is empty.");
  }
  if (!downMatch || downMatch[1].trim() === "") {
    throw new Error("Could not find '-- Down' section or it is empty.");
  }

  return { up: upMatch[1].trim(), down: downMatch[1].trim() };
}

// ✨ REMOVED: The custom `splitSqlStatements` function is no longer needed!

// --- Command Handlers ---

/**
 * `create [file_name?]`: Creates a new migration file.
 */
async function handleCreate(fileName?: string) {
  await ensureMigrationsDir();
  const existingMigrations = await getAvailableMigrations();

  if (fileName) {
    const sanitizedName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const nameExists = existingMigrations.some(existingFile => {
      const existingName = existingFile.replace(/^\d+_/, '').replace(/\.sql$/, '');
      return existingName === sanitizedName;
    });

    if (nameExists) {
      throw new Error(`A migration with the name '${sanitizedName}' already exists.`);
    }
  }

  const lastMigration = existingMigrations[existingMigrations.length - 1];
  const nextId = lastMigration ? parseInt(lastMigration.split("_")[0]) + 1 : 0;
  
  const prefix = String(nextId).padStart(4, "0");
  const randomName = () => Math.random().toString(36).substring(2, 10);
  const name = (fileName || randomName()).replace(/[^a-z0-9]/gi, '_').toLowerCase();

  const fullName = `${prefix}_${name}.sql`;
  const filePath = join(Deno.cwd(), MIGRATIONS_DIR, fullName);
  const boilerplate = `-- Up\n\n\n-- Down\n\n`;

  await Deno.writeTextFile(filePath, boilerplate);
  console.log(`✅ Created migration: ${MIGRATIONS_DIR}/${fullName}`);
}

/**
 * `apply [file_name?]`: Applies pending migrations.
 */
async function handleApply(targetFile?: string) {
  const tursoClient = createTursoClient();
  
  await ensureMigrationsTable(tursoClient);

  const appliedMigrations = await getAppliedMigrations(tursoClient);
  const availableMigrations = await getAvailableMigrations();

  if (targetFile) {
    if (!availableMigrations.includes(targetFile)) {
      throw new Error(`Migration file '${targetFile}' does not exist.`);
    }
    if (appliedMigrations.has(targetFile)) {
      console.log(`Migration '${targetFile}' has already been applied. Nothing to do.`);
      return;
    }
  }

  let migrationsToApply = availableMigrations.filter(
    (file) => !appliedMigrations.has(file)
  );
  
  if (targetFile) {
    const targetIndex = availableMigrations.indexOf(targetFile);
    migrationsToApply = migrationsToApply.filter(
        file => availableMigrations.indexOf(file) <= targetIndex
    );
  }

  if (migrationsToApply.length === 0) {
    console.log("Database is up to date. No new migrations to apply.");
    return;
  }

  console.log("Applying migrations...");
  for (const file of migrationsToApply) {
    const filePath = join(Deno.cwd(), MIGRATIONS_DIR, file);
    const content = await Deno.readTextFile(filePath);
    const { up } = parseMigrationFile(content);

    try {
        const tx = await tursoClient.transaction("write");
        
        // ✨ MODIFIED: Use `executeMultiple` to run the entire SQL block at once.
        await tx.executeMultiple(up);

        await tx.execute({
            sql: `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`,
            args: [file],
        });
        await tx.commit();
        console.log(`  ✓ Applied: ${file}`);
    } catch (error) {
        console.error(`Failed to apply migration '${file}':`, (error as Error).message);
        throw new Error("Migration failed. Please check the error above.");
    }
  }
  console.log("\n✨ Migrations applied successfully!");
}

/**
 * `revert [file_name?]`: Reverts applied migrations.
 */
async function handleRevert(targetFile?: string) {
   const tursoClient = createTursoClient();

  await ensureMigrationsTable(tursoClient);

  const result = await tursoClient.execute(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name DESC`);
  const appliedMigrations = result.rows.map((r) => r.name as string);

  if (appliedMigrations.length === 0) {
    console.log("No migrations to revert.");
    return;
  }
  
  let migrationsToRevert: string[] = [];

  if (targetFile) {
    if (!appliedMigrations.includes(targetFile)) {
      throw new Error(`Migration '${targetFile}' was not found in the applied list. Cannot revert.`);
    }
    const targetIndex = appliedMigrations.indexOf(targetFile);
    migrationsToRevert = appliedMigrations.slice(0, targetIndex + 1);
  } else {
    migrationsToRevert = [appliedMigrations[0]];
  }

  console.log("Reverting migrations...");
  for (const file of migrationsToRevert) {
    const filePath = join(Deno.cwd(), MIGRATIONS_DIR, file);
    let content: string;
    try {
      content = await Deno.readTextFile(filePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Migration file '${file}' not found locally, cannot revert.`);
      }
      throw error;
    }
    
    const { down } = parseMigrationFile(content);

    try {
        const tx = await tursoClient.transaction("write");
        
        await tx.executeMultiple(down);

        await tx.execute({
            sql: `DELETE FROM ${MIGRATIONS_TABLE} WHERE name = ?`,
            args: [file],
        });
        await tx.commit();
        console.log(`  ✓ Reverted: ${file}`);
    } catch (error) {
        console.error(`Failed to revert migration '${file}':`, (error as Error).message);
        throw new Error("Revert failed. Please check the error above.");
    }
  }
  console.log("\n✨ Migrations reverted successfully!");
}


// --- Main Execution Logic ---
function printHelp() {
  console.log(`
  Deno Migration Script for Turso/libSQL

  Usage:
    deno task migrate <command> [file_name]

  Commands:
    create [file_name]   Creates a new migration file.
    apply [file_name]    Applies all pending migrations.
    revert [file_name]   Reverts the last applied migration.
  `);
}

async function main() {
  const [command, arg] = Deno.args;
  try {
    switch (command) {
      case "create": await handleCreate(arg); break;
      case "apply": await handleApply(arg); break;
      case "revert": await handleRevert(arg); break;
      default:
        console.error(`Unknown command: '${command}'`);
        printHelp();
        Deno.exit(1);
    }
  } catch (error) {
    console.error(`\nOperation failed: ${(error as Error).message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}