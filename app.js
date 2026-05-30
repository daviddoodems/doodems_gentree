const STORAGE_KEY = "familia-arbol-v1";
const WRITE_PASSWORD_KEY = "familia-arbol-write-password";
const API_URL = "/api/people";

const examplePeople = [
  {
    id: "p1",
    name: "Jose Ramirez",
    nickname: "Pepe",
    birth: "1942-03-16",
    death: "",
    place: "Bogota, Colombia",
    branch: "Paterna",
    fatherId: "",
    motherId: "",
    partnerId: "p2",
    notes: "Primer registro de ejemplo. Puedes editarlo o eliminarlo."
  },
  {
    id: "p2",
    name: "Elena Torres",
    nickname: "Nena",
    birth: "1946-08-24",
    death: "",
    place: "Medellin, Colombia",
    branch: "Paterna",
    fatherId: "",
    motherId: "",
    partnerId: "p1",
    notes: ""
  },
  {
    id: "p3",
    name: "Carlos Ramirez Torres",
    nickname: "Carlitos",
    birth: "1971-01-08",
    death: "",
    place: "Cali, Colombia",
    branch: "Paterna",
    fatherId: "p1",
    motherId: "p2",
    partnerId: "p4",
    notes: ""
  },
  {
    id: "p4",
    name: "Marta Silva",
    nickname: "",
    birth: "1973-06-12",
    death: "",
    place: "Quito, Ecuador",
    branch: "Materna",
    fatherId: "",
    motherId: "",
    partnerId: "p3",
    notes: ""
  },
  {
    id: "p5",
    name: "Laura Ramirez Silva",
    nickname: "Lau",
    birth: "1999-11-02",
    death: "",
    place: "Bogota, Colombia",
    branch: "Nueva generacion",
    fatherId: "p3",
    motherId: "p4",
    partnerId: "",
    notes: ""
  }
];

let people = [];
let selectedId = "";
let currentView = "tree";
let usingSharedData = false;

const els = {
  addPersonBtn: document.querySelector("#addPersonBtn"),
  printBtn: document.querySelector("#printBtn"),
  searchInput: document.querySelector("#searchInput"),
  peopleList: document.querySelector("#peopleList"),
  peopleCount: document.querySelector("#peopleCount"),
  generationCount: document.querySelector("#generationCount"),
  syncStatus: document.querySelector("#syncStatus"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  treeTitle: document.querySelector("#treeTitle"),
  treeViewBtn: document.querySelector("#treeViewBtn"),
  detailViewBtn: document.querySelector("#detailViewBtn"),
  treePanel: document.querySelector("#treePanel"),
  detailPanel: document.querySelector("#detailPanel"),
  tree: document.querySelector("#tree"),
  treeLines: document.querySelector("#treeLines"),
  personForm: document.querySelector("#personForm"),
  formTitle: document.querySelector("#formTitle"),
  deleteBtn: document.querySelector("#deleteBtn"),
  nameInput: document.querySelector("#nameInput"),
  nicknameInput: document.querySelector("#nicknameInput"),
  birthInput: document.querySelector("#birthInput"),
  deathInput: document.querySelector("#deathInput"),
  placeInput: document.querySelector("#placeInput"),
  branchInput: document.querySelector("#branchInput"),
  fatherInput: document.querySelector("#fatherInput"),
  motherInput: document.querySelector("#motherInput"),
  partnerInput: document.querySelector("#partnerInput"),
  notesInput: document.querySelector("#notesInput"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  template: document.querySelector("#personCardTemplate")
};

function loadLocalPeople() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : structuredClone(examplePeople);
  } catch {
    return structuredClone(examplePeople);
  }
}

function saveLocalPeople() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

async function loadPeople() {
  setSyncStatus("Conectando datos compartidos...");
  try {
    const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("No shared API");
    people = await response.json();
    usingSharedData = true;
    selectedId = people[0]?.id || "";
    setSyncStatus("Datos compartidos activos. Los cambios se veran en otros dispositivos.");
  } catch {
    people = loadLocalPeople();
    usingSharedData = false;
    selectedId = people[0]?.id || "";
    setSyncStatus("Modo local: al publicar en Cloudflare con D1, todos veran el mismo arbol.");
  }
}

async function savePeople() {
  if (!usingSharedData) {
    saveLocalPeople();
    setSyncStatus("Guardado en este navegador. Publica con D1 para compartirlo.");
    return true;
  }

  const headers = { "Content-Type": "application/json" };
  const password = sessionStorage.getItem(WRITE_PASSWORD_KEY);
  if (password) headers["X-Family-Write-Password"] = password;

  let response = await fetch(API_URL, {
    method: "PUT",
    headers,
    body: JSON.stringify({ people })
  });

  if (response.status === 401) {
    const typedPassword = window.prompt("Escribe la contrasena familiar para guardar cambios:");
    if (!typedPassword) {
      setSyncStatus("Cambio no guardado: falta la contrasena familiar.");
      return false;
    }
    sessionStorage.setItem(WRITE_PASSWORD_KEY, typedPassword);
    response = await fetch(API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Family-Write-Password": typedPassword
      },
      body: JSON.stringify({ people })
    });
  }

  if (!response.ok) {
    setSyncStatus("No pude guardar en la base compartida. Intenta de nuevo.");
    return false;
  }

  setSyncStatus("Guardado en la base compartida.");
  return true;
}

function setSyncStatus(message) {
  if (els.syncStatus) els.syncStatus.textContent = message;
}

function createId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function formatYearRange(person) {
  const born = person.birth ? person.birth.slice(0, 4) : "?";
  const died = person.death ? person.death.slice(0, 4) : "";
  return died ? `${born}-${died}` : `N. ${born}`;
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function selectedPerson() {
  return people.find((person) => person.id === selectedId) || null;
}

function generationFor(person, cache = new Map(), seen = new Set()) {
  if (cache.has(person.id)) return cache.get(person.id);
  if (seen.has(person.id)) return 0;
  seen.add(person.id);

  const parents = [person.fatherId, person.motherId]
    .map((id) => people.find((candidate) => candidate.id === id))
    .filter(Boolean);

  const generation = parents.length
    ? Math.max(...parents.map((parent) => generationFor(parent, cache, new Set(seen)))) + 1
    : 0;

  cache.set(person.id, generation);
  return generation;
}

function getGenerations() {
  const cache = new Map();
  return people.reduce((groups, person) => {
    const generation = generationFor(person, cache);
    groups[generation] = groups[generation] || [];
    groups[generation].push(person);
    return groups;
  }, []);
}

function render() {
  renderStats();
  renderList();
  renderSelects();
  renderTree();
  renderForm();
  renderView();
}

function renderStats() {
  els.peopleCount.textContent = people.length;
  els.generationCount.textContent = getGenerations().filter(Boolean).length;
}

function renderList() {
  const query = els.searchInput.value.trim().toLowerCase();
  const visiblePeople = people
    .filter((person) => {
      const haystack = [person.name, person.nickname, person.place, person.branch, person.notes]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  els.peopleList.replaceChildren();

  if (!visiblePeople.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No hay personas que coincidan con la busqueda.";
    els.peopleList.append(empty);
    return;
  }

  visiblePeople.forEach((person) => {
    const node = els.template.content.cloneNode(true);
    const card = node.querySelector(".person-card");
    const button = node.querySelector("button");
    card.classList.toggle("selected", person.id === selectedId);
    node.querySelector(".avatar").textContent = initials(person.name);
    node.querySelector(".person-name").textContent = person.name;
    node.querySelector(".person-meta").textContent = `${formatYearRange(person)} · ${person.branch || "Sin rama"}`;
    button.addEventListener("click", () => {
      selectedId = person.id;
      currentView = "detail";
      render();
    });
    els.peopleList.append(node);
  });
}

function renderSelects() {
  const current = selectedPerson();
  const options = ['<option value="">Sin asignar</option>']
    .concat(
      people
        .filter((person) => person.id !== selectedId)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`)
    )
    .join("");

  els.fatherInput.innerHTML = options;
  els.motherInput.innerHTML = options;
  els.partnerInput.innerHTML = options;
  els.fatherInput.value = current?.fatherId || "";
  els.motherInput.value = current?.motherId || "";
  els.partnerInput.value = current?.partnerId || "";
}

function renderTree() {
  const generations = getGenerations();
  els.tree.replaceChildren();
  els.treeLines.replaceChildren();
  els.treeTitle.textContent = selectedPerson()?.name || "Familia completa";

  if (!people.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Agrega la primera persona para empezar el arbol.";
    els.tree.append(empty);
    return;
  }

  generations.forEach((group, index) => {
    if (!group?.length) return;
    const generation = document.createElement("div");
    generation.className = "generation";
    generation.dataset.generation = index;

    buildFamilyUnits(group)
      .forEach((unit) => {
        const familyUnit = document.createElement("div");
        familyUnit.className = "family-unit";
        familyUnit.dataset.unit = unit.map((person) => person.id).join("-");

        unit.forEach((person, personIndex) => {
          if (personIndex > 0) {
            const partnerLine = document.createElement("span");
            partnerLine.className = "partner-line";
            familyUnit.append(partnerLine);
          }
          familyUnit.append(createTreePerson(person));
        });

        generation.append(familyUnit);
      });

    els.tree.append(generation);
  });

  requestAnimationFrame(drawLines);
}

function buildFamilyUnits(group) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const groupIds = new Set(group.map((person) => person.id));
  const used = new Set();
  const units = [];

  group
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .forEach((person) => {
      if (used.has(person.id)) return;

      const partner = person.partnerId ? byId.get(person.partnerId) : null;
      if (partner && groupIds.has(partner.id) && !used.has(partner.id)) {
        units.push([person, partner].sort((a, b) => a.name.localeCompare(b.name, "es")));
        used.add(person.id);
        used.add(partner.id);
        return;
      }

      units.push([person]);
      used.add(person.id);
    });

  return units;
}

function createTreePerson(person) {
  const item = document.createElement("article");
  const partner = person.partnerId ? people.find((candidate) => candidate.id === person.partnerId) : null;
  item.className = "tree-person";
  item.dataset.id = person.id;
  item.classList.toggle("selected", person.id === selectedId);
  item.innerHTML = `
    <button type="button">
      <strong>${escapeHtml(person.name)}</strong>
      <small>${escapeHtml(formatYearRange(person))}</small>
      <small>${escapeHtml(person.place || person.branch || "Sin lugar")}</small>
      ${partner ? `<small>Pareja: ${escapeHtml(partner.name)}</small>` : ""}
    </button>
  `;
  item.querySelector("button").addEventListener("click", () => {
    selectedId = person.id;
    currentView = "detail";
    render();
  });
  return item;
}

function drawLines() {
  const panelBox = els.treePanel.getBoundingClientRect();
  const height = Math.max(els.tree.scrollHeight + 80, panelBox.height);
  const width = Math.max(els.tree.scrollWidth + 80, panelBox.width);

  els.treeLines.setAttribute("viewBox", `0 0 ${width} ${height}`);
  els.treeLines.setAttribute("width", width);
  els.treeLines.setAttribute("height", height);
  els.treeLines.replaceChildren();

  people.forEach((child) => {
    [child.fatherId, child.motherId].filter(Boolean).forEach((parentId) => {
      const parentNode = els.tree.querySelector(`[data-id="${CSS.escape(parentId)}"]`);
      const childNode = els.tree.querySelector(`[data-id="${CSS.escape(child.id)}"]`);
      if (!parentNode || !childNode) return;

      const parentBox = parentNode.getBoundingClientRect();
      const childBox = childNode.getBoundingClientRect();
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", parentBox.left - panelBox.left + els.treePanel.scrollLeft + parentBox.width / 2);
      line.setAttribute("y1", parentBox.bottom - panelBox.top + els.treePanel.scrollTop);
      line.setAttribute("x2", childBox.left - panelBox.left + els.treePanel.scrollLeft + childBox.width / 2);
      line.setAttribute("y2", childBox.top - panelBox.top + els.treePanel.scrollTop);
      els.treeLines.append(line);
    });
  });
}

function renderForm() {
  const person = selectedPerson();
  els.deleteBtn.disabled = !person;
  els.formTitle.textContent = person ? person.name : "Nueva persona";
  els.nameInput.value = person?.name || "";
  els.nicknameInput.value = person?.nickname || "";
  els.birthInput.value = person?.birth || "";
  els.deathInput.value = person?.death || "";
  els.placeInput.value = person?.place || "";
  els.branchInput.value = person?.branch || "";
  els.fatherInput.value = person?.fatherId || "";
  els.motherInput.value = person?.motherId || "";
  els.partnerInput.value = person?.partnerId || "";
  els.notesInput.value = person?.notes || "";
}

function renderView() {
  const isTree = currentView === "tree";
  els.treePanel.classList.toggle("hidden", !isTree);
  els.detailPanel.classList.toggle("hidden", isTree);
  els.treeViewBtn.classList.toggle("active", isTree);
  els.detailViewBtn.classList.toggle("active", !isTree);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char];
  });
}

function readForm() {
  return {
    id: selectedId || createId(),
    name: els.nameInput.value.trim(),
    nickname: els.nicknameInput.value.trim(),
    birth: els.birthInput.value,
    death: els.deathInput.value,
    place: els.placeInput.value.trim(),
    branch: els.branchInput.value.trim(),
    fatherId: els.fatherInput.value,
    motherId: els.motherInput.value,
    partnerId: els.partnerInput.value,
    notes: els.notesInput.value.trim()
  };
}

function syncPartnerLinks(person) {
  const partnerId = person.partnerId;
  people = people.map((item) => {
    if (item.id === person.id) return item;
    if (item.partnerId === person.id && item.id !== partnerId) {
      return { ...item, partnerId: "" };
    }
    if (partnerId && item.partnerId === partnerId && item.id !== person.id) {
      return { ...item, partnerId: "" };
    }
    if (partnerId && item.id === partnerId) {
      return { ...item, partnerId: person.id };
    }
    return item;
  });
}

els.addPersonBtn.addEventListener("click", () => {
  selectedId = "";
  currentView = "detail";
  render();
  els.nameInput.focus();
});

els.personForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const person = readForm();
  if (!person.name) return;

  const index = people.findIndex((item) => item.id === person.id);
  const previousPeople = structuredClone(people);
  if (index >= 0) {
    people[index] = person;
  } else {
    people.push(person);
  }
  syncPartnerLinks(person);
  selectedId = person.id;
  const saved = await savePeople();
  if (!saved) {
    people = previousPeople;
    selectedId = people[0]?.id || "";
    render();
    return;
  }
  currentView = "tree";
  render();
});

els.deleteBtn.addEventListener("click", async () => {
  const person = selectedPerson();
  if (!person) return;
  const confirmed = window.confirm(`Eliminar a ${person.name}? Esta accion tambien quitara sus enlaces como padre o madre.`);
  if (!confirmed) return;

  const previousPeople = structuredClone(people);
  people = people
    .filter((item) => item.id !== person.id)
    .map((item) => ({
      ...item,
      fatherId: item.fatherId === person.id ? "" : item.fatherId,
      motherId: item.motherId === person.id ? "" : item.motherId,
      partnerId: item.partnerId === person.id ? "" : item.partnerId
    }));
  selectedId = people[0]?.id || "";
  const saved = await savePeople();
  if (!saved) {
    people = previousPeople;
    selectedId = person.id;
    render();
    return;
  }
  currentView = "tree";
  render();
});

els.cancelEditBtn.addEventListener("click", () => {
  currentView = "tree";
  render();
});

els.searchInput.addEventListener("input", renderList);

els.treeViewBtn.addEventListener("click", () => {
  currentView = "tree";
  render();
});

els.detailViewBtn.addEventListener("click", () => {
  if (!selectedId && people.length) selectedId = people[0].id;
  currentView = "detail";
  render();
});

els.printBtn.addEventListener("click", () => window.print());

els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(people, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "arbol-familiar.json";
  link.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Formato no valido");
    const previousPeople = structuredClone(people);
    people = imported.map((person) => ({
      id: person.id || createId(),
      name: person.name || "Sin nombre",
      nickname: person.nickname || "",
      birth: person.birth || "",
      death: person.death || "",
      place: person.place || "",
      branch: person.branch || "",
      fatherId: person.fatherId || "",
      motherId: person.motherId || "",
      partnerId: person.partnerId || "",
      notes: person.notes || ""
    }));
    selectedId = people[0]?.id || "";
    const saved = await savePeople();
    if (!saved) {
      people = previousPeople;
      selectedId = people[0]?.id || "";
    }
    render();
  } catch {
    window.alert("No pude importar ese archivo. Revisa que sea un JSON exportado desde esta app.");
  } finally {
    event.target.value = "";
  }
});

window.addEventListener("resize", drawLines);
els.treePanel.addEventListener("scroll", drawLines);

loadPeople().then(render);
