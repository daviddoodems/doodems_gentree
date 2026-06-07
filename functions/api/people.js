const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Family-Write-Password"
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet({ env }) {
  try {
    const db = getDb(env);
    await ensureSchema(db);
    const { results } = await db.prepare(
      `SELECT *
       FROM people
       ORDER BY rowid`
    ).all();

    return json(results.map(fromRow));
  } catch (error) {
    return json({ error: "No pude leer la base de datos", detail: String(error.message || error) }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const passwordError = checkWritePassword(request, env);
    if (passwordError) return passwordError;

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON no valido" }, 400);
    }

    const people = Array.isArray(body.people) ? body.people : null;
    if (!people) return json({ error: "Formato no valido" }, 400);

    const db = getDb(env);
    await ensureSchema(db);
    if (body.replace === true) {
      await db.prepare("DELETE FROM people").run();
    }

    if (people.length) {
      const statements = people.map((person) => upsertPersonStatement(db, person));
      await db.batch(statements);
    }

    return json({ ok: true, people });
  } catch (error) {
    return json({ error: "No pude guardar en la base de datos", detail: String(error.message || error) }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const passwordError = checkWritePassword(request, env);
    if (passwordError) return passwordError;

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON no valido" }, 400);
    }

    const id = String(body.id || "");
    if (!id) return json({ error: "Falta el id de la persona" }, 400);

    const db = getDb(env);
    await ensureSchema(db);
    await db.batch([
      db.prepare("DELETE FROM people WHERE id = ?").bind(id),
      db.prepare("UPDATE people SET father_id = '' WHERE father_id = ?").bind(id),
      db.prepare("UPDATE people SET mother_id = '' WHERE mother_id = ?").bind(id),
      db.prepare("UPDATE people SET partner_id = '' WHERE partner_id = ?").bind(id)
    ]);

    return json({ ok: true, deletedId: id });
  } catch (error) {
    return json({ error: "No pude eliminar de la base de datos", detail: String(error.message || error) }, 500);
  }
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: CORS_HEADERS
  });
}

function getDb(env) {
  if (!env.DB) {
    throw new Error("Falta el binding D1 llamado DB en Cloudflare Pages.");
  }
  return env.DB;
}

function checkWritePassword(request, env) {
  if (!env.FAMILY_WRITE_PASSWORD) return null;
  const password = request.headers.get("X-Family-Write-Password") || "";
  if (password === env.FAMILY_WRITE_PASSWORD) return null;
  return json({ error: "Contrasena incorrecta" }, 401);
}

function upsertPersonStatement(db, person) {
  const clean = normalizePerson(person);
  return db.prepare(
    `INSERT INTO people
      (id, name, nickname, birth, death, place, branch, father_id, mother_id, partner_id, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      nickname = excluded.nickname,
      birth = excluded.birth,
      death = excluded.death,
      place = excluded.place,
      branch = excluded.branch,
      father_id = excluded.father_id,
      mother_id = excluded.mother_id,
      partner_id = excluded.partner_id,
      notes = excluded.notes,
      updated_at = datetime('now')`
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
    clean.partnerId,
    clean.notes
  );
}

async function ensureSchema(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      birth TEXT NOT NULL DEFAULT '',
      death TEXT NOT NULL DEFAULT '',
      place TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      father_id TEXT NOT NULL DEFAULT '',
      mother_id TEXT NOT NULL DEFAULT '',
      partner_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
  await addColumnIfMissing(db, "partner_id", "TEXT NOT NULL DEFAULT ''");
}

async function addColumnIfMissing(db, columnName, definition) {
  const { results } = await db.prepare("PRAGMA table_info(people)").all();
  const exists = results.some((column) => column.name === columnName);
  if (!exists) {
    try {
      await db.prepare(`ALTER TABLE people ADD COLUMN ${columnName} ${definition}`).run();
    } catch (error) {
      if (!String(error.message || error).toLowerCase().includes("duplicate column")) {
        throw error;
      }
    }
  }
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
    partnerId: row.partner_id || "",
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
    partnerId: String(person.partnerId || ""),
    notes: String(person.notes || "").trim()
  };
}
