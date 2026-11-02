(function () {
  "use strict";

  const storageKey = "tutsGardenPlants-v1";
  const storage = {
    get: function (key, fallback) {
      try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
      } catch (error) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        // The garden still works for this visit if browser storage is unavailable.
      }
    }
  };

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function shiftedDateKey(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }

  function localDate(value) {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function daysBetween(first, second) {
    const firstUtc = Date.UTC(first.getFullYear(), first.getMonth(), first.getDate());
    const secondUtc = Date.UTC(second.getFullYear(), second.getMonth(), second.getDate());
    return Math.round((secondUtc - firstUtc) / 86400000);
  }

  function urgencyFor(plant) {
    const lastWatered = localDate(plant.lastWatered);
    const due = new Date(lastWatered);
    due.setDate(due.getDate() + Number(plant.interval));
    return daysBetween(new Date(), due);
  }

  function dateLabel(value) {
    return localDate(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function dueLabel(daysUntil) {
    if (daysUntil < 0) {
      const daysLate = Math.abs(daysUntil);
      return "Overdue by " + daysLate + (daysLate === 1 ? " day" : " days");
    }
    if (daysUntil === 0) return "Water today";
    return "Due in " + daysUntil + (daysUntil === 1 ? " day" : " days");
  }

  const starterPlants = STARTER_PLANTS.map(function (plant) {
    return {
      id: plant.id,
      name: plant.name,
      interval: plant.interval,
      lastWatered: shiftedDateKey(-plant.daysSinceWatered)
    };
  });
  let plants = storage.get(storageKey, starterPlants);
  let activeFilter = "all";

  const plantList = document.getElementById("plant-list");
  const emptyMessage = document.getElementById("empty-message");
  const plantCount = document.getElementById("plant-count");
  const dueCount = document.getElementById("due-count");
  const form = document.getElementById("plant-form");
  const lastWateredInput = document.getElementById("last-watered");

  function savePlants() {
    storage.set(storageKey, plants);
  }

  function createPlantRow(plant) {
    const daysUntil = urgencyFor(plant);
    const row = document.createElement("article");
    row.className = "plant-row";

    const icon = document.createElement("span");
    icon.className = "plant-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "\u{1F331}";

    const details = document.createElement("div");
    details.className = "plant-details";
    const name = document.createElement("h3");
    name.textContent = plant.name;
    const schedule = document.createElement("p");
    schedule.textContent = "Every " + plant.interval + " days - Last watered " + dateLabel(plant.lastWatered);
    details.append(name, schedule);

    const status = document.createElement("span");
    status.className = "due-status";
    status.textContent = dueLabel(daysUntil);
    if (daysUntil < 0) status.classList.add("overdue");
    else if (daysUntil === 0) status.classList.add("due-today");
    else status.classList.add("upcoming");

    const actions = document.createElement("div");
    actions.className = "plant-actions";
    const waterButton = document.createElement("button");
    waterButton.type = "button";
    waterButton.className = "water-button";
    waterButton.textContent = "Watered";
    waterButton.setAttribute("aria-label", "Mark " + plant.name + " as watered today");
    waterButton.addEventListener("click", function () {
      plants = plants.map(function (item) {
        return item.id === plant.id ? Object.assign({}, item, { lastWatered: dateKey(new Date()) }) : item;
      });
      savePlants();
      renderPlants();
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", "Remove " + plant.name);
    removeButton.addEventListener("click", function () {
      plants = plants.filter(function (item) { return item.id !== plant.id; });
      savePlants();
      renderPlants();
    });

    actions.append(waterButton, removeButton);
    row.append(icon, details, status, actions);
    return row;
  }

  function renderPlants() {
    const orderedPlants = plants.slice().sort(function (first, second) {
      return urgencyFor(first) - urgencyFor(second) || first.name.localeCompare(second.name);
    });
    const visiblePlants = orderedPlants.filter(function (plant) {
      const daysUntil = urgencyFor(plant);
      if (activeFilter === "due") return daysUntil <= 0;
      if (activeFilter === "upcoming") return daysUntil > 0;
      return true;
    });
    const duePlants = plants.filter(function (plant) { return urgencyFor(plant) <= 0; }).length;

    plantList.replaceChildren.apply(plantList, visiblePlants.map(createPlantRow));
    emptyMessage.hidden = visiblePlants.length > 0;
    emptyMessage.textContent = plants.length === 0
      ? "Your garden is empty. Add a plant to get started."
      : "No plants in this view. Try another filter.";
    plantCount.textContent = String(plants.length);
    dueCount.textContent = String(duePlants);
    document.getElementById("due-summary").textContent = duePlants === 0
      ? "All clear. Nothing needs water today."
      : duePlants + (duePlants === 1 ? " plant needs" : " plants need") + " water today.";
  }

  document.querySelectorAll("[data-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeFilter = button.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (filterButton) {
        filterButton.setAttribute("aria-pressed", filterButton === button ? "true" : "false");
      });
      renderPlants();
    });
  });

  lastWateredInput.value = dateKey(new Date());
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const nameInput = document.getElementById("plant-name");
    const intervalInput = document.getElementById("watering-interval");
    const name = nameInput.value.trim();
    const interval = Number(intervalInput.value);
    if (!name || !Number.isInteger(interval) || interval < 1 || interval > 60) return;

    plants.push({
      id: String(Date.now()) + "-" + Math.random().toString(36).slice(2),
      name: name,
      interval: interval,
      lastWatered: lastWateredInput.value
    });
    savePlants();
    form.reset();
    intervalInput.value = "7";
    lastWateredInput.value = dateKey(new Date());
    activeFilter = "all";
    document.querySelector('[data-filter="all"]').click();
    nameInput.focus();
  });

  renderPlants();
})();
