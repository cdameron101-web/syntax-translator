from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="Syntax Translator API",
    description="A learning-focused syntax translator with the Kanan coding assistant.",
    version="1.0.0",
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class TranslationRequest(BaseModel):
    source_language: str = Field(min_length=1, max_length=50)
    target_language: str = Field(min_length=1, max_length=50)
    code: str = Field(min_length=1, max_length=50_000)


class KananRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2_000)
    code: str = Field(default="", max_length=50_000)
    source_language: str = Field(default="Unknown", max_length=50)
    target_language: str = Field(default="Unknown", max_length=50)


def javascript_to_python(code: str) -> str:
    translated = re.sub(
        r"function\s+([A-Za-z_]\w*)\s*\((.*?)\)\s*\{",
        r"def \1(\2):",
        code,
    )
    translated = re.sub(r"console\.log\((.*?)\);?", r"print(\1)", translated)
    translated = re.sub(r"\b(?:let|const|var)\s+", "", translated)
    translated = re.sub(r";\s*$", "", translated, flags=re.MULTILINE)
    translated = re.sub(r'(["\'][^"\']*["\'])\s*\+\s*([A-Za-z_]\w*)', r'f\1 {\2}', translated)
    translated = re.sub(r"^\s*}\s*$", "", translated, flags=re.MULTILINE)

    lines = translated.splitlines()
    result: list[str] = []
    inside_function = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("def "):
            inside_function = True
            result.append(stripped)
        elif inside_function and stripped:
            result.append("    " + stripped)
        else:
            result.append(line)

        if inside_function and not stripped:
            inside_function = False

    return "\n".join(result).strip()


def python_to_javascript(code: str) -> str:
    output: list[str] = []
    function_open = False

    for line in code.splitlines():
        stripped = line.strip()
        match = re.match(r"def\s+([A-Za-z_]\w*)\((.*?)\):", stripped)
        if match:
            if function_open:
                output.append("}")
            output.append(f"function {match.group(1)}({match.group(2)}) {{")
            function_open = True
            continue

        print_match = re.match(r"print\((.*)\)", stripped)
        if print_match:
            prefix = "  " if function_open and line.startswith((" ", "\t")) else ""
            output.append(f"{prefix}console.log({print_match.group(1)});")
        elif stripped:
            prefix = "  " if function_open and line.startswith((" ", "\t")) else ""
            output.append(prefix + stripped + (";" if not stripped.endswith(("{", "}", ";")) else ""))
        else:
            output.append("")

    if function_open:
        output.append("}")

    return "\n".join(output).strip()


def sql_to_mongodb(code: str) -> str:
    table_match = re.search(r"\bFROM\s+([A-Za-z_]\w*)", code, flags=re.IGNORECASE)
    table = table_match.group(1) if table_match else "collection"

    where_match = re.search(
        r"\bWHERE\s+(.+?)(?:\bORDER\b|\bGROUP\b|\bLIMIT\b|;|$)",
        code,
        flags=re.IGNORECASE | re.DOTALL,
    )
    condition = where_match.group(1).strip() if where_match else ""

    if condition:
        return (
            f"db.{table}.find({{\n"
            f"  // Translate this SQL condition into MongoDB query operators:\n"
            f"  // {condition}\n"
            f"}});"
        )
    return f"db.{table}.find({{}});"


def java_to_csharp(code: str) -> str:
    return (
        code.replace("System.out.println", "Console.WriteLine")
        .replace("public static void main(String[] args)", "public static void Main(string[] args)")
        .replace("String", "string")
    )


def csharp_to_java(code: str) -> str:
    return (
        code.replace("Console.WriteLine", "System.out.println")
        .replace("public static void Main(string[] args)", "public static void main(String[] args)")
        .replace("string", "String")
    )


TRANSLATORS: dict[tuple[str, str], Callable[[str], str]] = {
    ("JavaScript", "Python"): javascript_to_python,
    ("Python", "JavaScript"): python_to_javascript,
    ("SQL", "MongoDB"): sql_to_mongodb,
    ("PostgreSQL", "MongoDB"): sql_to_mongodb,
    ("MySQL", "MongoDB"): sql_to_mongodb,
    ("Java", "C#"): java_to_csharp,
    ("C#", "Java"): csharp_to_java,
}


def generic_translation(code: str, source: str, target: str) -> str:
    if source == target:
        return code

    return (
        f"// {source} → {target} learning scaffold\n"
        "// This language pair needs a dedicated parser for production accuracy.\n"
        "// Original code is preserved below so behavior is not silently removed.\n\n"
        f"{code}"
    )


def build_explanation(code: str, source: str, target: str) -> str:
    line_count = sum(1 for line in code.splitlines() if line.strip())
    has_function = bool(re.search(r"\b(function|def|func|fn|public|private)\b", code))
    has_loop = bool(re.search(r"\b(for|while|foreach|map)\b", code, flags=re.IGNORECASE))
    has_query = bool(re.search(r"\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b", code, flags=re.IGNORECASE))

    safe_source = html.escape(source)
    safe_target = html.escape(target)

    return f"""
      <h3>What this code contains</h3>
      <ul>
        <li><strong>{line_count}</strong> non-empty line{"s" if line_count != 1 else ""} of {safe_source} code.</li>
        <li>{"A function or method declaration was detected." if has_function else "No obvious function declaration was detected."}</li>
        <li>{"A loop or collection operation appears in the snippet." if has_loop else "No common loop syntax was detected."}</li>
        <li>{"Database query syntax was detected." if has_query else "The snippet does not appear to be a SQL-style query."}</li>
      </ul>
      <h3>Translation approach</h3>
      <p>The service converts recognizable {safe_source} patterns into equivalent {safe_target} patterns. Unknown constructs are preserved for manual review.</p>
      <h3>Developer note</h3>
      <p>Translation can change types, libraries, error handling, concurrency, and runtime behavior. Add tests before using translated code in production.</p>
    """.strip()


@app.get("/")
async def home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/languages")
async def get_languages() -> dict[str, list[str]]:
    return {
        "frontend": ["HTML", "CSS", "JavaScript", "TypeScript", "React", "JSX", "Vue", "Svelte"],
        "backend": ["Python", "Java", "C#", "Go", "PHP", "Ruby", "Rust", "C", "C++", "Kotlin", "Swift"],
        "database": ["SQL", "PostgreSQL", "MySQL", "SQLite", "SQL Server", "Oracle SQL", "MongoDB", "Redis"],
        "data": ["R", "Julia", "MATLAB", "Bash", "PowerShell"],
    }


@app.post("/api/translate")
async def translate(request: TranslationRequest) -> dict[str, str]:
    translator = TRANSLATORS.get((request.source_language, request.target_language))

    try:
        translation = (
            translator(request.code)
            if translator
            else generic_translation(
                request.code,
                request.source_language,
                request.target_language,
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not translate code: {exc}") from exc

    return {
        "translation": translation,
        "explanation": build_explanation(
            request.code,
            request.source_language,
            request.target_language,
        ),
    }


@app.post("/api/ask-kanan")
async def ask_kanan(request: KananRequest) -> dict[str, str]:
    question = request.question.lower()
    line_count = sum(1 for line in request.code.splitlines() if line.strip())

    if any(word in question for word in ("bug", "error", "wrong", "fix")):
        answer = (
            "Start with the exact error message and the line it points to. "
            "Then verify variable names, types, closing brackets, indentation, and function inputs. "
            f"Your current {request.source_language} snippet has {line_count} non-empty lines."
        )
    elif any(word in question for word in ("explain", "what does", "understand")):
        answer = (
            f"Read this {request.source_language} code in four passes: inputs, transformations, "
            "control flow, and output. The translator is targeting "
            f"{request.target_language}, so pay special attention to differences in types and libraries."
        )
    elif any(word in question for word in ("clean", "improve", "refactor")):
        answer = (
            "Use clear names, keep functions focused on one job, remove repeated logic, validate inputs, "
            "and separate business logic from input/output code. Add a small test for each behavior before refactoring."
        )
    elif any(word in question for word in ("database", "sql", "query")):
        answer = (
            "For database code, check the schema first. Select only needed columns, parameterize user input, "
            "index columns used frequently in filters or joins, and inspect the query plan before optimizing."
        )
    else:
        answer = (
            "Break the problem into inputs, expected output, and the smallest working step. "
            "Then test one assumption at a time. Ask me about a specific line, error, or language difference "
            "and I’ll make the explanation more precise."
        )

    return {"answer": answer}
