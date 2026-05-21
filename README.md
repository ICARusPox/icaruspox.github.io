# ICARusPox Dashboard

This is a static web dashboard meant to be served by GitHub Pages.

## Local Development

The project uses ES6 modules (`<script type="module">`) for JavaScript. Because of this, the dashboard **cannot** be opened directly by double-clicking the `index.html` file (using the `file:///` protocol) due to browser Cross-Origin Resource Sharing (CORS) security policies.

To test the site locally, you need to serve it using a local HTTP server.

### Running a local server (macOS / Linux)

Since macOS and Linux typically come with Python pre-installed, you can easily use its built-in static server.

1. Open your terminal.
2. Navigate to this project folder.
3. Run the following command:

```bash
python3 -m http.server 8080
```

4. Open your web browser and go to: [http://localhost:8080](http://localhost:8080)
