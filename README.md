# ICARusPox Dashboard

This is a static web dashboard meant to be served by GitHub Pages.

## Local Development

The project uses ES6 modules (`<script type="module">`) for JavaScript. Because of this, the dashboard **cannot** be opened directly by double-clicking the `index.html` file (using the `file:///` protocol) due to browser Cross-Origin Resource Sharing (CORS) security policies.

To test the site locally, you need to serve it using a local HTTP server.

### Running a local server

You can use the helper Bash scripts to start and stop the local web server:

**Start the server:**
```bash
./start_server.sh [port]   # Defaults to port 8080 if not specified
```

**Stop the server:**
```bash
./stop_server.sh [port]    # Defaults to port 8080 if not specified
```

Alternatively, you can manually run Python's built-in HTTP server:
```bash
python3 -m http.server 8080
```

Once started, open your web browser and go to: [http://localhost:8080](http://localhost:8080)

### Updating Datasets

- **ICARusPox Screen Dataset**: If you modify or replace `assets/ICARusPox_web_resource_table.tsv`, recompile `js/dataset.js` by running:
  ```bash
  ./update_dataset.sh [path_to_tsv]   # Defaults to assets/ICARusPox_web_resource_table.tsv
  ```
- **DGIdb Gene-Drug Interactions Dataset**: Download the latest release from the Drug-Gene Interaction Database (DGIdb v5) into `assets/dgidb_interactions.tsv` and compile `js/dgidb_dataset.js` by running:
  ```bash
  ./update_dgidb.sh
  ```

## License & Third-Party Credits

- **ICARusPox Project & Screen Data**: Licensed under the **[Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)**.
- **BioJS (`js/biojs-bundle.js`)**: Incorporates and adapts software from **[BioJS](https://github.com/biojs/biojs)**, licensed under the **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)**. See [`THIRD-PARTY-NOTICES.md`](file:///Users/ayakimovich/Documents/GitHub/icaruspox.github.io/THIRD-PARTY-NOTICES.md) for full license terms and notices.
- **DGIdb (`assets/dgidb_interactions.tsv` & `js/dgidb_dataset.js`)**: Incorporates interaction data from the **[Drug-Gene Interaction Database (DGIdb v5)](https://dgidb.org)**. Subject to primary source database licenses (ChEMBL, DrugBank, PharmGKB, IUPHAR, etc.). See [`assets/DGIDB-LICENSE-NOTICES.md`](file:///Users/ayakimovich/Documents/GitHub/icaruspox.github.io/assets/DGIDB-LICENSE-NOTICES.md) and [`THIRD-PARTY-NOTICES.md`](file:///Users/ayakimovich/Documents/GitHub/icaruspox.github.io/THIRD-PARTY-NOTICES.md) for full attributions.


