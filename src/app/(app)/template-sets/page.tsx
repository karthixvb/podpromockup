import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { requireActiveShop } from "@/lib/shop-context";

async function createSet(formData: FormData) {
  "use server";

  const { shop } = await requireActiveShop();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const set = await prisma.templateSet.create({
    data: {
      shop,
      name,
      description: String(formData.get("description") || "") || null,
    },
  });

  const templateIds = formData.getAll("templateIds").map(String);
  if (templateIds.length > 0) {
    const owned = await prisma.template.findMany({
      where: { shop, id: { in: templateIds } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((t) => t.id));
    await Promise.all(
      templateIds
        .filter((id) => ownedIds.has(id))
        .map((templateId, i) =>
          prisma.templateSetMember.create({
            data: { templateSetId: set.id, templateId, sortOrder: i },
          }),
        ),
    );
  }

  revalidatePath("/template-sets");
}

async function deleteSet(formData: FormData) {
  "use server";

  const { shop } = await requireActiveShop();
  await prisma.templateSet.deleteMany({
    where: { id: String(formData.get("id")), shop },
  });
  revalidatePath("/template-sets");
}

async function updateMembers(formData: FormData) {
  "use server";

  const { shop } = await requireActiveShop();
  const setId = String(formData.get("id"));
  const set = await prisma.templateSet.findFirst({
    where: { id: setId, shop },
  });
  if (!set) return;

  await prisma.templateSetMember.deleteMany({ where: { templateSetId: setId } });

  const templateIds = formData.getAll("templateIds").map(String);
  if (templateIds.length > 0) {
    const owned = await prisma.template.findMany({
      where: { shop, id: { in: templateIds } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((t) => t.id));
    await Promise.all(
      templateIds
        .filter((id) => ownedIds.has(id))
        .map((templateId, i) =>
          prisma.templateSetMember.create({
            data: { templateSetId: setId, templateId, sortOrder: i },
          }),
        ),
    );
  }

  revalidatePath("/template-sets");
}

export default async function TemplateSetsPage() {
  const { shop } = await requireActiveShop();

  const [sets, templates] = await Promise.all([
    prisma.templateSet.findMany({
      where: { shop },
      orderBy: { name: "asc" },
      include: {
        members: {
          include: {
            template: { include: { pricingConfig: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.template.findMany({
      where: { shop },
      orderBy: { name: "asc" },
      include: { pricingConfig: true },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Template sets
        </h1>
        <p className="text-sm text-muted mt-1">
          Group garment types for batch runs
        </p>
      </div>

      <section className="bg-panel border border-border rounded-lg p-4">
        <h2 className="text-base font-semibold mb-2">What is a Template Set?</h2>
        <p className="text-sm text-muted">
          A set groups multiple garment types (T-Shirt + Hoodie + Tank…). Each
          template has its own <strong>base price</strong> and can use its own{" "}
          <strong>pricing config</strong> for size and color adjustments. Do not
          share one base price across the whole set.
        </p>
      </section>

      <section className="bg-panel border border-border rounded-lg p-4 space-y-4">
        <h2 className="text-base font-semibold">Create set</h2>
        <form action={createSet} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Set name</span>
            <input
              name="name"
              required
              placeholder="Apparel Classic"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Description</span>
            <input
              name="description"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium">Select templates</p>
            {templates.length === 0 ? (
              <p className="text-sm text-muted">
                No templates yet. Create templates first.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {templates.map((t) => (
                  <li key={t.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="templateIds"
                        value={t.id}
                        className="rounded border-border"
                      />
                      <span>
                        {t.name} ({t.productType})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium"
          >
            Create set
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Existing sets</h2>
        {sets.length === 0 ? (
          <div className="bg-panel border border-border rounded-lg p-8 text-center text-sm text-muted">
            No sets yet.
          </div>
        ) : (
          sets.map((set) => (
            <div
              key={set.id}
              className="bg-panel border border-border rounded-lg p-4 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{set.name}</p>
                  {set.description ? (
                    <p className="text-sm text-muted mt-0.5">
                      {set.description}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted mt-1">
                    {set.members
                      .map(
                        (m) =>
                          `${m.template.productType} ($${m.template.basePrice}${
                            m.template.pricingConfig
                              ? ` · ${m.template.pricingConfig.name}`
                              : ""
                          })`,
                      )
                      .join(" · ") || "No templates"}
                  </p>
                </div>
                <form action={deleteSet}>
                  <input type="hidden" name="id" value={set.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/5"
                  >
                    Delete
                  </button>
                </form>
              </div>

              <form action={updateMembers} className="space-y-3 border-t border-border pt-3">
                <input type="hidden" name="id" value={set.id} />
                <p className="text-sm font-medium">Members</p>
                <ul className="space-y-1.5">
                  {templates.map((t) => {
                    const checked = set.members.some(
                      (m) => m.templateId === t.id,
                    );
                    return (
                      <li key={t.id}>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="templateIds"
                            value={t.id}
                            defaultChecked={checked}
                            className="rounded border-border"
                          />
                          <span>
                            {t.name} ({t.productType}, base ${t.basePrice}
                            {t.pricingConfig
                              ? `, ${t.pricingConfig.name}`
                              : ""}
                            )
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background"
                >
                  Update members
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
