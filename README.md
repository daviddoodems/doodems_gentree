# Arbol familiar compartido

Esta es una app web para administrar un arbol genealogico familiar sin depender de Lovable. Usa Cloudflare Pages para la pagina, Pages Functions para la API y Cloudflare D1 para que todos vean los mismos datos.

## Como usarla

Cuando esta publicada en Cloudflare, la pagina lee y guarda los datos en `/api/people`, conectado a una base D1 compartida. Si abres `index.html` directamente en tu computador, funciona en modo local de respaldo.

Funciones incluidas:

- Crear, editar y eliminar personas.
- Asignar padre y madre.
- Buscar personas.
- Ver el arbol por generaciones.
- Exportar e importar los datos como JSON.
- Imprimir la vista del arbol.

## Archivos importantes

- `index.html`, `styles.css`, `app.js`: la web.
- `functions/api/people.js`: la API compartida.
- `schema.sql`: estructura de la base de datos.
- `wrangler.toml`: configuracion de Cloudflare.

## Publicar en Cloudflare

1. Crea una base D1 en Cloudflare llamada `familia_arbol`.
2. Copia el `database_id` de esa base.
3. Abre `wrangler.toml` y reemplaza `REEMPLAZA_CON_EL_ID_DE_TU_BASE_D1` por ese ID.
4. Desde esta carpeta, ejecuta:

```bash
npx wrangler d1 execute familia_arbol --remote --file=./schema.sql
npx wrangler pages deploy . --project-name=familia-arbol
```

5. En Cloudflare Pages, conecta tu dominio desde `Custom domains`.

## Contrasena para editar

La lectura queda abierta para la familia. Para proteger la escritura, crea una variable de entorno en Cloudflare Pages:

- Nombre: `FAMILY_WRITE_PASSWORD`
- Valor: la contrasena familiar que quieras usar

Cuando alguien intente guardar cambios, la app pedira esa contrasena.
