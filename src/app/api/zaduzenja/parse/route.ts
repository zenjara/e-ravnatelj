import { getSession } from "@/lib/session";
import { parseTable } from "@/lib/zaduzenja/parse";

// xlsx parsing + session (node:crypto) need the Node.js runtime.
export const runtime = "nodejs";

/**
 * POST /api/zaduzenja/parse — multipart body: { file }
 *
 * Reads the uploaded ministry workload table and returns a light summary
 * (school + teacher list) so the principal can confirm before generating.
 * Nothing is persisted; the file lives only for the duration of the request.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Odaberite Excel datoteku (.xlsx)." }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { school, teachers } = parseTable(buf);
    if (teachers.length === 0) {
      return Response.json(
        { error: "U tablici nije pronađen nijedan učitelj. Provjerite da je ispravna i ispunjena." },
        { status: 422 },
      );
    }
    return Response.json({
      school: {
        naziv: school.naziv,
        mjesto: school.mjesto,
        ravnatelj: school.ravnatelj,
        zupanija: school.zupanija,
      },
      teachers: teachers.map((t) => ({
        name: t.name,
        predmet: t.predmet,
        radno_vrijeme: t.radno_vrijeme,
        ukupno_tjedno: t.ukupno_tjedno,
      })),
    });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "Nije moguće pročitati tablicu." },
      { status: 422 },
    );
  }
}
