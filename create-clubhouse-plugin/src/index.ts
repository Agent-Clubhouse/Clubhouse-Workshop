#!/usr/bin/env node

import prompts from "prompts";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, "..", "templates");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface Answers {
  name: string;
  scope: "project" | "app" | "dual";
  layout: "full" | "sidebar-content";
  permissions: string[];
  template: "basic" | "with-sidebar" | "app-scoped" | "agent-workflow";
}

const allPermissions = [
  { title: "logging", value: "logging", selected: true },
  { title: "storage", value: "storage", selected: true },
  { title: "notifications", value: "notifications" },
  { title: "files", value: "files" },
  { title: "git", value: "git" },
  { title: "agents", value: "agents" },
  { title: "terminal", value: "terminal" },
  { title: "process", value: "process" },
  { title: "commands", value: "commands" },
  { title: "events", value: "events" },
  { title: "settings", value: "settings" },
  { title: "navigation", value: "navigation" },
  { title: "widgets", value: "widgets" },
  { title: "projects (app/dual scope only)", value: "projects" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  Create a new Clubhouse plugin\n");

  const response = await prompts(
    [
      {
        type: "text",
        name: "name",
        message: "Plugin name",
        initial: "my-plugin",
        validate: (v: string) => (v.trim() ? true : "Name is required"),
      },
      {
        type: "select",
        name: "scope",
        message: "Scope",
        choices: [
          { title: "project — lives in a project tab", value: "project" },
          { title: "app — lives in the app sidebar rail", value: "app" },
          { title: "dual — works in both contexts", value: "dual" },
        ],
        initial: 0,
      },
      {
        type: (_, values) => (values.scope === "project" || values.scope === "dual" ? "select" : null),
        name: "layout",
        message: "Tab layout",
        choices: [
          { title: "full — single main panel", value: "full" },
          { title: "sidebar-content — sidebar + main panel", value: "sidebar-content" },
        ],
        initial: 0,
      },
      {
        type: "multiselect",
        name: "permissions",
        message: "Permissions (space to toggle)",
        choices: allPermissions,
      },
      {
        type: "select",
        name: "template",
        message: "Template",
        choices: [
          { title: "basic — minimal MainPanel", value: "basic" },
          { title: "with-sidebar — sidebar + content layout", value: "with-sidebar" },
          { title: "app-scoped — rail item, cross-project", value: "app-scoped" },
          { title: "agent-workflow — spawn quick agents, show status", value: "agent-workflow" },
        ],
        initial: 0,
      },
    ],
    { onCancel: () => process.exit(1) },
  );

  const answers = response as Answers;
  const id = toId(answers.name);
  const outDir = resolve(process.cwd(), id);

  if (existsSync(outDir)) {
    console.error(`\n  Error: directory "${id}" already exists.\n`);
    process.exit(1);
  }

  // Copy template
  const templateDir = join(templatesDir, answers.template);
  cpSync(templateDir, outDir, { recursive: true });

  // Generate manifest.json
  const manifest = {
    id,
    name: answers.name,
    version: "0.1.0",
    description: "",
    author: "",
    engine: { api: 0.5 },
    scope: answers.scope,
    main: "./dist/main.js",
    permissions: answers.permissions.length > 0 ? answers.permissions : ["logging"],
    contributes: {
      ...(answers.scope !== "app"
        ? {
            tab: {
              label: answers.name,
              icon: "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2'/></svg>",
              layout: answers.layout || "full",
            },
          }
        : {}),
      ...(answers.scope === "app" || answers.scope === "dual"
        ? {
            railItem: {
              label: answers.name,
              icon: "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2'/></svg>",
            },
          }
        : {}),
      help: {
        topics: [
          {
            id: "overview",
            title: answers.name,
            content: `# ${answers.name}\n\nDescribe your plugin here.`,
          },
        ],
      },
    },
  };

  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  // Generate package.json
  const pkg = {
    name: id,
    version: "0.1.0",
    private: true,
    description: "",
    scripts: {
      build: "esbuild src/main.tsx --bundle --format=esm --platform=browser --external:react --outfile=dist/main.js",
      watch: "esbuild src/main.tsx --bundle --format=esm --platform=browser --external:react --outfile=dist/main.js --watch",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    devDependencies: {
      "@clubhouse/plugin-types": "^0.5.0",
      "@types/react": "^19.0.0",
      esbuild: "^0.24.0",
      typescript: "^5.7.0",
      vitest: "^3.0.0",
      "@clubhouse/plugin-testing": "^0.5.0",
    },
  };

  writeFileSync(join(outDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  // Generate tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: "dist",
      declaration: false,
      noEmit: true,
    },
    include: ["src"],
  };

  writeFileSync(join(outDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2) + "\n");

  // Generate .gitignore
  writeFileSync(join(outDir, ".gitignore"), "node_modules/\ndist/\n");

  // Ensure directories exist
  mkdirSync(join(outDir, "dist"), { recursive: true });
  mkdirSync(join(outDir, "src"), { recursive: true });

  console.log(`
  Done! Created ${id}/

  Next steps:

    cd ${id}
    npm install
    npm run build

  To install for development:

    ln -s "$(pwd)" ~/.clubhouse/plugins/${id}

  Then enable in Clubhouse: Settings > Plugins > ${answers.name}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
