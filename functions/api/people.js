const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Family-Write-Password"
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet({ env }) {
  await ensureSchema(env.DB);
  const { results } = await env.DB.prepare(
    `SELECT id, name, nickname, birth, death, place, branch, father_id, mother_id, notes
     FROM people
     ORDER BY name COLLATE NOCASE`
  ).all();

  return json(results.map(fromRow));
}

export async function onRequestPut({ request, env }) {
  if (env.FAMILY_WRITE_PASSWORD) {
    const password = request.headers.get("X-Family-Write-Password") || "";
    if (password !== env.FAMILY_WRITE_PASSWORD) {
      return json({ error: "Contrasena incorrecta" }, 401);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON no valido" }, 400);
  }

  const people = Array.isArray(body.people) ? body.people : null;
  if (!people) return json({ error: "Formato no valido" }, 400);

  await ensureSchema(env.DB);
  await env.DB.prepare("DELETE FROM people").run();

  if (people.length) {
    const statements = people.map((person) => {
      const clean = normalizePerson(person);
      return env.DB.prepare(
        `INSERT INTO people
          (id, name, nickname, birth, death, place, branch, father_id, mother_id, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        clean.id,
        clean.name,
        clean.nickname,
        clean.birth,
        clean.death,
        clean.place,
        clean.branch,
        clean.fatherId,
        clean.motherId,
        clean.notes
      );
    });
    await env.DB.batch(statements);
  }

  return json({ ok: true, people });
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: CORS_HEADERS
  });
}

async function ensureSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      birth TEXT NOT NULL DEFAULT '',
      death TEXT NOT NULL DEFAULT '',
      place TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      father_id TEXT NOT NULL DEFAULT '',
      mother_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    birth: row.birth,
    death: row.death,
    place: row.place,
    branch: row.branch,
    fatherId: row.father_id,
    motherId: row.mother_id,
    notes: row.notes
  };
}

function normalizePerson(person) {
  return {
    id: String(person.id || crypto.randomUUID()),
    name: String(person.name || "Sin nombre").trim() || "Sin nombre",
    nickname: String(person.nickname || "").trim(),
    birth: String(person.birth || ""),
    death: String(person.death || ""),
    place: String(person.place || "").trim(),
    branch: String(person.branch || "").trim(),
    fatherId: String(person.fatherId || ""),
    motherId: String(person.motherId || ""),
    notes: String(person.notes || "").trim()
  };
}
