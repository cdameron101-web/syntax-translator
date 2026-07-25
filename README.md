# Syntax Translator with Kanan

A full-stack learning application that translates recognizable syntax patterns between popular programming and database languages.

## Features

- Frontend, backend, systems, scripting, data, and database language selectors
- JavaScript ↔ Python translation
- Java ↔ C# translation
- SQL/PostgreSQL/MySQL → MongoDB starter conversion
- Safe generic scaffold for language pairs without a dedicated translator
- Plain-English code explanations
- Kanan coding assistant
- Turquoise/purple, ocean-blue, and firebrick-red themes
- Animated background, text shadows, glass panels, and custom scrollbars
- Responsive mobile layout
- Browser fallback if the backend is unavailable

## Run locally

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install and run:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

## Important architecture note

No reliable system can translate *every* programming language through text replacement alone. A production version should use:

1. A parser for each source language
2. An abstract syntax tree or intermediate representation
3. A target-language code generator
4. Formatters and linters
5. Automated unit and integration tests
6. Sandboxed code execution
7. Authentication, rate limits, logging, and input-size controls

The current project is a strong portfolio-ready starter and learning tool, not a compiler replacement.

## Project structure

```text
syntax-translator-kanan/
├── main.py
├── requirements.txt
├── README.md
└── static/
    ├── index.html
    ├── styles.css
    └── app.js
```
