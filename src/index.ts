
import { config } from "dotenv";
config();

import * as mysql from "mysql";
import fetch from "node-fetch";

const connection = mysql.createConnection({
    host: process.env.mysql_host,
    user: process.env.mysql_user,
    password: process.env.mysql_password,
    database: process.env.mysql_database,
    multipleStatements: true
});
connection.connect();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    async function doTheLoop() {
        var block = 19762757;
        var waitForSelect = true;
        connection.query("SELECT `blockNumber` FROM `transactions` WHERE `microbuddy` IS NOT NULL ORDER BY `blockNumber` DESC LIMIT 1", function(error, results, fields) {
            if (typeof results[0] !== "undefined") {
                block = results[0].blockNumber + 1;
            }
            waitForSelect = false;
        });
        while (waitForSelect) { await delay(1000); };

        while (true) {
            const response = await fetch('https://api-testnet.polygonscan.com/api?module=account&action=tokennfttx&contractaddress=0xdcfddb06af6f1a8d4be001c43b0f3e29bfbd96db&startblock=' + block.toString() + '&endblock=999999999&sort=asc');
            const data = await response.json();

            try {
                console.log("Gotten " + data.result.length.toString() + " microbuddies");
            } catch (err) {
                console.log(err);
                console.log(data);
                connection.end();
                return;
            }

            var microbuddies = [];
            for (var i = 0; i < data.result.length; i++) {
                var microbuddy = data.result[i];
                microbuddies.push([
                    microbuddy.hash,
                    microbuddy.tokenID
                ]);
            }

            var queries = [];
            for (var i = 0; i < microbuddies.length; i++) {
                if (typeof queries[Math.floor(i/100)] === "undefined") {
                    queries[Math.floor(i/100)] = "UPDATE transactions SET microbuddy=" + microbuddies[i][1].toString() + " WHERE hash='" + microbuddies[i][0] + "'";
                } else {
                    queries[Math.floor(i/100)] += "; UPDATE transactions SET microbuddy=" + microbuddies[i][1].toString() + " WHERE hash='" + microbuddies[i][0] + "'";
                }
            }
            console.log("Created " + queries.length.toString() + " queries");

            for (var i = 0; i < queries.length; i++) {
                connection.query(queries[i], (error, results, fields) => {
                    if (error) {
                        throw error;
                    }
                });
            }

            if (data.result.length < 10000) {
                break;
            }
            block = parseInt(data.result.at(-1).blockNumber)+1;
        }
    }

    while (true) {
        await doTheLoop();
        console.log("Waiting 60 seconds before searching for new transactions");
        await delay(60000);
    }
})();
