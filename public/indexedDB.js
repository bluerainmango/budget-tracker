//! Create IndexedDB
const request = window.indexedDB.open("budget-trackerDB", 1);

request.onerror = function(event) {
  alert("Error occurred! Please allow my web app to use IndexedDB!");

  console.error("🧨 IndexedDB error: " + event.target.errorCode);
};

//! Create object store and index for query
request.onupgradeneeded = event => {
  const db = event.target.result;

  // Use auto increment store
  const budgetTrackerStore = db.createObjectStore("budgetStore", {
    autoIncrement: "true"
  });

  // Create index
  //   budgetTrackerStore.createIndex("budgetIndex", "transaction");
};

//! Open a transaction
request.onsuccess = () => {
  const db = request.result;

  console.log("🍇 IndexedDB created");

  // Select stores to use and a transaction type
  const transaction = db.transaction(["budgetStore"], "readwrite");

  // Select a store to make a transaction
  const budgetStore = transaction.objectStore("budgetStore");

  // Send a request to add data to the store
  const addRequest = budgetStore.add({ transaction: "complete" });

  addRequest.onsuccess = function(e) {
    console.log("Successfully data added: ", e.target);
  };

  // Get data from the store
  const getCursorRequest = budgetStore.openCursor();

  getCursorRequest.onsuccess = e => {
    const cursor = e.target.result;

    if (cursor) {
      const budget = cursor.value;
      console.log("found out doc: ", budget);
      // cursor.update(todo);

      // 다음 doc으로 이동
      cursor.continue();
    }
  };

  getCursorRequest.onerror = err => {
    console.log("Error occurred curing requesting cursor: ", err);
  };
};
