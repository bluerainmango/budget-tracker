let transactions = [];
let myChart;

init();

// async function init() {
//   const response = await fetch("/api/transaction");
//   const data = await response.json();
//   console.log("result: ", response);
//   console.log("data: ", data);
//   // save db data on global variable
//   transactions = data;
//   const draftTransactions = await loadFromIndexedDB();
//   console.log("🥑 draft loaded: ", draftTransactions);

//   populateTotal();
//   populateTable();
//   populateChart();
// }

async function init() {
  fetch("/api/transaction")
    .then(response => {
      return response.json();
    })
    .then(async data => {
      // save db data on global variable
      transactions = data;

      populateTotal();
      populateTable();
      populateChart();

      loadFromIndexedDB();
    });
}

function populateTotal() {
  // reduce transaction amounts to a single total value
  console.log("🍉 init transactions arr: ", transactions);
  if (!transactions) return;

  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total Over Time",
          fill: true,
          backgroundColor: "#6666ff",
          data
        }
      ]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  } else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();

  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
    .then(response => {
      return response.json();
    })
    .then(data => {
      if (data.errors) {
        errorEl.textContent = "Missing Information";
      } else {
        // clear form
        nameEl.value = "";
        amountEl.value = "";
      }
    })
    .catch(err => {
      // fetch failed, so save in indexed db
      console.log("🚨 fetch to server api is failed");
      // saveRecord(transaction);

      //! Save failed POST reqeust to IndexedDB
      saveToIndexedDB(transaction);

      // clear form
      nameEl.value = "";
      amountEl.value = "";
    });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};

//! IndexedDB
function saveToIndexedDB(draftTransaction) {
  //! Create IndexedDB
  const request = window.indexedDB.open("budget-trackerDB", 1);

  request.onerror = function(event) {
    alert("Error occurred! Please allow my web app to use IndexedDB!");

    console.error("🧨 IndexedDB error: " + event.target.errorCode);
  };

  //! Open a transaction
  request.onsuccess = () => {
    const db = request.result;

    // Select stores to use and a transaction type
    const transaction = db.transaction(["budgetStore"], "readwrite");

    // Select a store to make a transaction
    const budgetStore = transaction.objectStore("budgetStore");

    // Send a request to add data to the store
    const addRequest = budgetStore.add({ transaction: draftTransaction });

    addRequest.onsuccess = function(e) {
      console.log("Successfully data added: ", e.target);
    };

    // Get data from the store
    // const getCursorRequest = budgetStore.openCursor();

    // getCursorRequest.onsuccess = e => {
    //   const cursor = e.target.result;

    //   if (cursor) {
    //     const budget = cursor.value;
    //     console.log("found out doc: ", budget);
    //     // cursor.update(todo);

    //     // 다음 doc으로 이동
    //     cursor.continue();
    //   }
    // };

    // getCursorRequest.onerror = err => {
    //   console.log("Error occurred curing requesting cursor: ", err);
    // };
  };
}

//! Load draftTransactions from IndexedDB and return its array
async function loadFromIndexedDB() {
  console.log("🍑 indexedDB: ", window.indexedDB);
  const openRequest = await window.indexedDB.open("budget-trackerDB", 1);

  openRequest.onerror = function(e) {
    alert("Error occurred! Please allow my web app to use IndexedDB!");

    console.error("🧨 IndexedDB error: " + e.target.errorCode);
  };

  //! Create object store and index for query
  openRequest.onupgradeneeded = async e => {
    const db = e.target.result;

    // Use auto increment store
    await db.createObjectStore("budgetStore", {
      autoIncrement: "true"
    });

    console.log("🍇 IndexedDB created");
    // Create index
    //   budgetTrackerStore.createIndex("budgetIndex", "transaction");
  };

  openRequest.onsuccess = async () => {
    const db = await openRequest.result;
    console.log("🥝 db", db);

    const transaction = await db.transaction(["budgetStore"], "readwrite");
    const budgetStore = await transaction.objectStore("budgetStore");
    const getCursorRequest = await budgetStore.openCursor();

    getCursorRequest.onsuccess = async e => {
      const cursor = e.target.result;
      console.log("🍓 cursor: ", cursor);

      // let draftTransactions = [];

      if (!cursor) return;

      // console.log("🥦 found draft transaction: ", draftTransaction);

      // draftTransactions.unshift(draftTransaction);
      // console.log("🥥🌽 draftTransactions:", draftTransactions);
      // Send a POST request to server

      const draftTransaction = cursor.value.transaction;

      fetch("/api/transaction", {
        method: "POST",
        body: JSON.stringify(draftTransaction),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        }
      })
        .then(response => {
          return response.json();
        })
        .then(data => {
          // save db data on global variable
          transactions.unshift(data);

          populateTotal();
          populateTable();
          populateChart();
        });

      await cursor.continue();

      // Clear data of store
      const clearRequest = budgetStore.clear();
      clearRequest.onsuccess = e => {
        console.log("🌊 successfully clear storage");
      };
      // if (cursor) {
      //   const draftTransaction = cursor.value;
      //   console.log("🥦 found draft transaction: ", draftTransaction);

      //   draftTransactions.unshift(draftTransaction);

      //   cursor.continue();
      // } else return;

      // return draftTransactions;
      // add draftTransactions to transactions arr re-render
      // transactions.unshift(draftTransactions);
    };

    getCursorRequest.onerror = err => {
      console.log("Error occurred curing requesting cursor: ", err);
    };
  };
}
