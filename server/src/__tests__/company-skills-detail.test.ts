import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { agents, companies, companySkills, createDb } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companySkillService } from "../services/company-skills.js";

const mockListSkills = vi.hoisted(() => vi.fn(() => new Promise(() => {})));

vi.mock("../adapters/index.js", async () => {
  const actual = await vi.importActual<typeof import("../adapters/index.js")>("../adapters/index.js");
  return {
    ...actual,
    findActiveServerAdapter: vi.fn(() => ({
      listSkills: mockListSkills,
    })),
  };
});

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company skill detail tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("companySkillService.detail", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof companySkillService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const cleanupDirs = new Set<string>();

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-company-skills-detail-");
    db = createDb(tempDb.connectionString);
    svc = companySkillService(db);
  }, 20_000);

  afterEach(async () => {
    mockListSkills.mockClear();
    await db.delete(agents);
    await db.delete(companySkills);
    await db.delete(companies);
    await Promise.all(Array.from(cleanupDirs, (dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("reports attached agents without probing adapter runtime skill state", async () => {
    const companyId = randomUUID();
    const skillId = randomUUID();
    const skillKey = `company/${companyId}/reflection-coach`;
    const skillDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-reflection-skill-"));
    cleanupDirs.add(skillDir);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# Reflection Coach\n", "utf8");

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companySkills).values({
      id: skillId,
      companyId,
      key: skillKey,
      slug: "reflection-coach",
      name: "Reflection Coach",
      description: null,
      markdown: "# Reflection Coach\n",
      sourceType: "local_path",
      sourceLocator: skillDir,
      trustLevel: "markdown_only",
      compatibility: "compatible",
      fileInventory: [{ path: "SKILL.md", kind: "skill" }],
      metadata: { sourceKind: "local_path" },
    });
    await db.insert(agents).values({
      id: randomUUID(),
      companyId,
      name: "Reviewer",
      role: "engineer",
      adapterType: "codex_local",
      adapterConfig: {
        paperclipSkillSync: {
          desiredSkills: [skillKey],
        },
      },
    });

    const detail = await Promise.race([
      svc.detail(companyId, skillId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("skill detail timed out")), 1_000)),
    ]);

    expect(mockListSkills).not.toHaveBeenCalled();
    expect(detail?.usedByAgents).toEqual([
      expect.objectContaining({
        name: "Reviewer",
        desired: true,
        actualState: null,
      }),
    ]);
  });
});
