const languages = {
  frontend: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "JSX", "Vue", "Svelte"],
  backend: ["Python", "Java", "C#", "Go", "PHP", "Ruby", "Rust", "C", "C++", "Kotlin", "Swift"],
  database: ["SQL", "PostgreSQL", "MySQL", "SQLite", "SQL Server", "Oracle SQL", "MongoDB", "Redis"],
  data: ["R", "Julia", "MATLAB", "Bash", "PowerShell"]
};

const sourceSelect = document.querySelector("#sourceLanguage");
const targetSelect = document.querySelector("#targetLanguage");
const sourceCode = document.querySelector("#sourceCode");
const translatedCode = document.querySelector("#translatedCode code");
const explanation = document.querySelector("#explanation");
const translateButton = document.querySelector("#translateButton");
const statusMessage = document.querySelector("#statusMessage");
const chatMessages = document.querySelector("#chatMessages");

function populateLanguages() {
  Object.entries(languages).forEach(([groupName, items]) => {
    [sourceSelect, targetSelect].forEach(select => {
      const group = document.createElement("optgroup");
      group.label = groupName[0].toUpperCase() + groupName.slice(1);
      items.forEach(language => {
        const option = document.createElement("option");
        option.value = language;
        option.textContent = language;
        group.appendChild(option);
      });
      select.appendChild(group);
    });
  });

  sourceSelect.value = "JavaScript";
  targetSelect.value = "Python";

  const chipContainer = document.querySelector("#languageChips");
  [...new Set(Object.values(languages).flat())].forEach(language => {
    const chip = document.createElement("span");
    chip.className = "language-chip";
    chip.textContent = language;
    chipContainer.appendChild(chip);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function fallbackTranslation(code, source, target) {
  if (source === target) return code;

  const pairs = {
    "JavaScript->Python": value => value
      .replace(/function\s+(\w+)\s*\((.*?)\)\s*\{/g, "def $1($2):")
      .replace(/console\.log\((.*?)\);?/g, "print($1)")
      .replace(/\b(let|const|var)\s+/g, "")
      .replace(/;\s*$/gm, "")
      .replace(/^\s*}\s*$/gm, "")
      .replace(/"Hello, "\s*\+\s*(\w+)/g, 'f"Hello, {$1}"')
      .split("\n")
      .map((line, index, arr) => {
        const previousDef = arr.slice(0, index).reverse().findIndex(item => item.trim().startsWith("def "));
        if (line.trim() && index > 0 && arr[index - 1].trim().startsWith("def ")) return "    " + line.trim();
        return line;
      }).join("\n"),
    "Python->JavaScript": value => value
      .replace(/^def\s+(\w+)\((.*?)\):/gm, "function $1($2) {")
      .replace(/^\s+print\((.*?)\)$/gm, "  console.log($1);")
      .replace(/^print\((.*?)\)$/gm, "console.log($1);") + "\n}",
    "SQL->MongoDB": value => {
      const table = (value.match(/FROM\s+([a-zA-Z_]\w*)/i) || [])[1] || "collection";
      const where = (value.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|;|$)/i) || [])[1];
      return `db.${table}.find(${where ? '{ /* translate condition: ' + where.trim() + ' */ }' : '{}'});`;
    },
    "Java->C#": value => value
      .replace(/System\.out\.println/g, "Console.WriteLine")
      .replace(/public static void main\(String\[\] args\)/g, "public static void Main(string[] args)")
      .replace(/\bString\b/g, "string"),
    "C#->Java": value => value
      .replace(/Console\.WriteLine/g, "System.out.println")
      .replace(/public static void Main\(string\[\] args\)/g, "public static void main(String[] args)")
      .replace(/\bstring\b/g, "String")
  };

  const translator = pairs[`${source}->${target}`];
  if (translator) return translator(code);

  return `// ${source} → ${target} starter translation\n` +
    `// A production translator would parse the source into an AST.\n\n` +
    code
      .replace(/console\.log/g, target === "Python" ? "print" : "output")
      .replace(/\bfunction\b/g, target === "Python" ? "def" : "function");
}

function createExplanation(code, source, target) {
  const lines = code.split("\n").filter(line => line.trim()).length;
  const hasFunction = /\b(function|def|func|fn|public|private)\b/.test(code);
  const hasQuery = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(code);
  const hasLoop = /\b(for|while|foreach|map)\b/i.test(code);

  return `
    <h3>What this code contains</h3>
    <ul>
      <li><strong>${lines}</strong> non-empty line${lines === 1 ? "" : "s"} of ${escapeHtml(source)} code.</li>
      <li>${hasFunction ? "A function or method declaration was detected." : "No obvious function declaration was detected."}</li>
      <li>${hasLoop ? "A loop or collection operation appears in the snippet." : "No common loop syntax was detected."}</li>
      <li>${hasQuery ? "Database query syntax was detected." : "The snippet does not appear to be a SQL-style query."}</li>
    </ul>
    <h3>Translation approach</h3>
    <p>The app converts recognizable ${escapeHtml(source)} patterns into equivalent ${escapeHtml(target)} patterns. It also preserves unknown code so you can review it instead of silently losing behavior.</p>
    <h3>Developer note</h3>
    <p>Different languages have different type systems, libraries, runtime behavior, and error handling. Always run tests after translating code.</p>
  `;
}

async function translate() {
  const code = sourceCode.value.trim();
  if (!code) {
    statusMessage.textContent = "Enter code before translating.";
    return;
  }

  translateButton.classList.add("loading");
  translateButton.disabled = true;
  statusMessage.textContent = "Kanan is analyzing the syntax...";

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_language: sourceSelect.value,
        target_language: targetSelect.value,
        code
      })
    });

    if (!response.ok) throw new Error("Translation request failed");
    const data = await response.json();
    translatedCode.textContent = data.translation;
    explanation.innerHTML = data.explanation;
    statusMessage.textContent = "Translation complete.";
  } catch (error) {
    translatedCode.textContent = fallbackTranslation(code, sourceSelect.value, targetSelect.value);
    explanation.innerHTML = createExplanation(code, sourceSelect.value, targetSelect.value);
    statusMessage.textContent = "Using browser translation mode.";
  } finally {
    translateButton.classList.remove("loading");
    translateButton.disabled = false;
  }
}

function appendMessage(text, role) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.querySelectorAll(".theme-dot").forEach(button => {
  button.addEventListener("click", () => {
    document.body.className = button.dataset.theme;
    document.querySelectorAll(".theme-dot").forEach(dot => dot.classList.remove("active"));
    button.classList.add("active");
    localStorage.setItem("syntaxTranslatorTheme", button.dataset.theme);
  });
});

document.querySelector("#translateButton").addEventListener("click", translate);
document.querySelector("#clearButton").addEventListener("click", () => {
  sourceCode.value = "";
  translatedCode.textContent = "Your translated code will appear here.";
  explanation.textContent = "Submit code to receive a plain-English explanation, syntax notes, and learning tips.";
  statusMessage.textContent = "";
});
document.querySelector("#copyButton").addEventListener("click", async () => {
  await navigator.clipboard.writeText(translatedCode.textContent);
  statusMessage.textContent = "Translated code copied.";
});
document.querySelector("#swapButton").addEventListener("click", () => {
  [sourceSelect.value, targetSelect.value] = [targetSelect.value, sourceSelect.value];
  const previousSource = sourceCode.value;
  sourceCode.value = translatedCode.textContent.includes("Your translated") ? previousSource : translatedCode.textContent;
  translatedCode.textContent = previousSource;
});

document.querySelector("#chatForm").addEventListener("submit", async event => {
  event.preventDefault();
  const input = document.querySelector("#chatInput");
  const question = input.value.trim();
  if (!question) return;

  appendMessage(question, "user");
  input.value = "";

  try {
    const response = await fetch("/api/ask-kanan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        code: sourceCode.value,
        source_language: sourceSelect.value,
        target_language: targetSelect.value
      })
    });
    const data = await response.json();
    appendMessage(data.answer, "assistant");
  } catch {
    appendMessage("Look at the smallest unit first: inputs, output, control flow, then side effects. Paste a specific error message and I’ll break it down.", "assistant");
  }
});

populateLanguages();

const savedTheme = localStorage.getItem("syntaxTranslatorTheme");
if (savedTheme) {
  document.body.className = savedTheme;
  document.querySelectorAll(".theme-dot").forEach(dot => {
    dot.classList.toggle("active", dot.dataset.theme === savedTheme);
  });
}
