let transactions = [];
let myChart;

init();

function init() {
  //! Bring all transactions and render.
  fetch("/api/transaction")
    .then(response => {
      return response.json();
    })
    .then(data => {
      transactions = data;

      populateTotal();
      populateTable();
      populateChart();

      //! Bring all draft transactions saved in IndexedDB and re-render if needed.
      loadIndexedDBAndRerender();
    });
}

function populateTotal() {
  // reduce transaction amounts to a single total value
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
      // No network, fail to fetch
      console.log("🚨 Offline! Draft transactions are saved in the browser");

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

//! IndexedDB : Save draft transactions
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
      console.log(
        "🍓 Successfully draft transactions added to IndexedDB: ",
        e.target
      );
    };
  };
}

//! Load draftTransactions from IndexedDB and return its array
async function loadIndexedDBAndRerender() {
  const openRequest = window.indexedDB.open("budget-trackerDB", 1);

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
  };

  openRequest.onsuccess = async () => {
    const db = openRequest.result;
    const transaction = db.transaction(["budgetStore"], "readwrite");
    const budgetStore = transaction.objectStore("budgetStore");

    const getRequest = budgetStore.getAll();

    getRequest.onsuccess = async function(e) {
      const draftTransactions = e.target.result;

      // console.log(
      //   "🥝 Retrieved all draft transactions from IndexedDB: ",
      //   draftTransactions
      // );
      console.log("draftTransactions: ", draftTransactions);
      if (draftTransactions.length === 0) return;

      //! 1. Add draft transactions to DOM
      //[{transaction:{name,amount..},{}..}] => [{name,amount},{}...]
      draftTransactions.forEach(el => {
        transactions.unshift(el.transaction);
      });

      populateTotal();
      populateTable();
      populateChart();

      //! 2. Try to fetch with this draft transactions
      const draftTransactionsArr = draftTransactions.map(el => el.transaction);

      await fetch("/api/transaction/bulk", {
        method: "POST",
        body: JSON.stringify(draftTransactionsArr),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        }
      })
        .then(response => {
          return response.json();
        })
        .then(async data => {
          //! Online : delete saved data from IndexedDB
        })
        .catch(err => {
          //! Offline
          console.log("💔 Offline! Currently cannot send data to server ", err);
        });

      // try {
      //   await fetch("/api/transaction/bulk", {
      //     method: "POST",
      //     body: JSON.stringify(draftTransactionsArr),
      //     headers: {
      //       Accept: "application/json, text/plain, */*",
      //       "Content-Type": "application/json"
      //     }
      //   });

      //   getRequest.onsuccess = () => {
      //     //! Online : delete saved data from IndexedDB
      //     console.log("data:", data);
      //     console.log("😇", budgetStore);
      //     const clearRequest = budgetStore.clear();

      //     console.log("😈", budgetStore, clearRequest);
      //     clearRequest.onsuccess = function(e) {
      //       console.log(
      //         "🌊 Successfully saved draft transactions to server and cleared IndexedDB."
      //       );

      //       clearRequest.onerror = e => {
      //         console.log("clear error", e);
      //       };
      //     };
      //   };
      // } catch (err) {
      //   //! Offline
      //   console.log("💔 Offline! Currently cannot send data to server ", err);
      // }
    };

    if (window.navigator.onLine) {
      console.log("😇", budgetStore);
      const clearRequest = budgetStore.clear();

      console.log("😈", clearRequest);
      clearRequest.onsuccess = function(e) {
        console.log(
          "🌊 Successfully saved draft transactions to server and cleared IndexedDB."
        );

        clearRequest.onerror = e => {
          console.log("clear error", e);
        };
      };
    }
  };
}
