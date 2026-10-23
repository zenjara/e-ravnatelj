import { getSession } from "@/lib/session";
import { getCurrentSchool } from "@/lib/school";
import { parseStaff } from "@/lib/ucitelji/parse";

// xlsx parsing + session (node:crypto) need the Node.js runtime.
export const runtime = "nodejs";

/**
 * POST /api/ucitelji/parse — multipart body: { file }
 *
 * Parses an uploaded e-Matica staff export into an editable {prezime, ime,
 * radno_mjesto} preview. Nothing is persisted here; OIB is never read.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niste prijavljeni." }, { status: 401 });

  const school = await getCurrentSchool();
  if (!school) {
    return Response.json(
      { error: "Vašem računu nije dodijeljena škola. Javite se administratoru." },
      { status: 409 },
    );
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Odaberite Excel ili CSV datoteku." }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = parseStaff(buf);
    if (parsed.rows.length === 0) {
      return Response.json(
        { error: "U datoteci nije prepoznat nijedan zaposlenik. Provjerite da je to izvoz popisa djelatnika." },
        { status: 422 },
      );
    }
    return Response.json(parsed);
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "Nije moguće pročitati datoteku." },
      { status: 422 },
    );
  }
}
